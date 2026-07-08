package smartcharging

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strconv"
	"sync"
	"time"

	"csms/smart-charging/internal/citrineclient"
)

// --- CONFIGURATION ---
const CheckInterval = 30 * time.Second

// --- VARIABLES GLOBALES (Mémoire du service) ---
var (
	// stateMutex sécurise l'accès concurrent aux variables globales
	stateMutex sync.Mutex

	// activeLoops stocke la fonction permettant d'annuler le timer d'un bloc spécifique
	activeLoops = make(map[int]context.CancelFunc)

	// lastAppliedLimits stocke la dernière limite envoyée pour éviter le spam OCPP
	// et sert de référence pour détecter l'underloading par rapport à la "Limite Actuelle"
	lastAppliedLimits = make(map[string]float64)

	// gracePeriodCache mémorise l'heure de fin de la période de grâce d'une transaction
	// (utilisé au démarrage OU lors d'une augmentation de limite de >= 2A)
	gracePeriodCache = make(map[string]time.Time)
)

// --- STRUCTURES DES EVENEMENTS HASURA ---
type HasuraEventPayload struct {
	Event struct {
		Op   string                 `json:"op"`
		Data map[string]interface{} `json:"data"`
	} `json:"event"`
	Table struct {
		Name string `json:"name"`
	} `json:"table"`
}

type EVState struct {
	TransactionID      string
	OcppConnectionName string
	EvseID             int
	CurrentConsumption float64
	AllocatedLimit     float64
	Locked             bool
}

func floor10(val float64) float64 {
	return math.Floor(val*10) / 10
}

func HandleTransactions(client *citrineclient.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		var payload HasuraEventPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			log.Printf("❌ Erreur de décodage JSON: %v", err)
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		// RÈGLE D'OR : On n'écoute QUE les événements de la table Transactions
		if payload.Table.Name != "Transactions" && payload.Table.Name != "transactions" {
			w.WriteHeader(http.StatusOK)
			return
		}

		powerBlockID := extractPowerBlockID(client, payload)
		if powerBlockID == 0 {
			w.WriteHeader(http.StatusOK)
			return
		}

		log.Printf("🔄 Changement Topologique détecté (Tx Start/Stop). Réinitialisation du Block %d...", powerBlockID)

		// On réinitialise la boucle de manière sécurisée pour CE bloc spécifique
		resetBlockLoop(client, powerBlockID)

		w.WriteHeader(http.StatusOK)
	}
}

// resetBlockLoop tue l'ancien timer, fait une répartition égale immédiate, et lance un nouveau timer
func resetBlockLoop(client *citrineclient.Client, powerBlockID int) {
	// 1. Tuer l'ancien timer s'il existe
	stateMutex.Lock()
	if cancel, exists := activeLoops[powerBlockID]; exists {
		cancel()
		delete(activeLoops, powerBlockID)
	}
	// Création du nouveau contexte pour le timer
	ctx, cancel := context.WithCancel(context.Background())
	activeLoops[powerBlockID] = cancel
	stateMutex.Unlock()

	// 2. Action immédiate (Topologie) : On lance l'algorithme intelligent directement
	err := executeCalculation(client, powerBlockID, "Changement Topologique")
	if err != nil {
		log.Printf("❌ Erreur au changement topologique (Block %d): %v", powerBlockID, err)
	}

	// 3. Lancer le timer de 30s en tâche de fond
	go func(bID int, loopCtx context.Context) {
		ticker := time.NewTicker(CheckInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				// Action périodique : Ajustement naturel
				err := executeCalculation(client, bID, "Ajustement (Timer 30s)")
				if err != nil {
					log.Printf("❌ Erreur au check périodique (Block %d): %v", bID, err)
				}
			case <-loopCtx.Done():
				// Le timer a été tué car une nouvelle transaction a démarré/stoppé
				return
			}
		}
	}(powerBlockID, ctx)
}

func executeCalculation(client *citrineclient.Client, powerBlockID int, reason string) error {
	maxA, evStates, err := fetchPowerBlockState(client, powerBlockID)
	if err != nil {
		return err
	}

	if len(evStates) == 0 {
		stateMutex.Lock()
		if cancel, exists := activeLoops[powerBlockID]; exists {
			log.Printf("ℹ️ Power Block %d : Plus aucune transaction active. Arrêt du timer.", powerBlockID)
			cancel()
			delete(activeLoops, powerBlockID)
		}
		stateMutex.Unlock()
		return nil
	}

	// Enregistrement de la période de grâce pour les nouvelles transactions
	stateMutex.Lock()
	for _, ev := range evStates {
		if _, exists := gracePeriodCache[ev.TransactionID]; !exists {
			gracePeriodCache[ev.TransactionID] = time.Now().Add(90 * time.Second)
		}
	}
	stateMutex.Unlock()

	// Calcul des limites (Algorithme unifié)
	calculateLimits(powerBlockID, maxA, evStates)

	for _, ev := range evStates {
		// ANTI-SPAM
		stateMutex.Lock()
		lastLimit, exists := lastAppliedLimits[ev.TransactionID]
		stateMutex.Unlock()

		if exists && lastLimit == ev.AllocatedLimit {
			continue
		}

		nextProfileID, err := getNextProfileID(client, ev.OcppConnectionName, ev.EvseID)
		if err != nil {
			nextProfileID = 500
		}

		err = sendTxProfile(client, ev, nextProfileID)
		if err == nil {
			stateMutex.Lock()
			oldLimit, hadOldLimit := lastAppliedLimits[ev.TransactionID]
			lastAppliedLimits[ev.TransactionID] = ev.AllocatedLimit

			// PÉRIODE DE GRÂCE DYNAMIQUE : Si la limite augmente d'au moins 2A, on lui redonne 90s
			if hadOldLimit && (ev.AllocatedLimit - oldLimit) >= 2.0 {
				gracePeriodCache[ev.TransactionID] = time.Now().Add(90 * time.Second)
				log.Printf("⏳ [GRÂCE] Block %d | Borne %s passe de %.1fA à %.1fA (+%.1fA). Période de grâce de 90s accordée.",
					powerBlockID, ev.OcppConnectionName, oldLimit, ev.AllocatedLimit, ev.AllocatedLimit-oldLimit)
			}
			stateMutex.Unlock()

			log.Printf("✅ [%s] Block %d | Profil envoyé à %s (Tx: %s) : Limite %.1fA",
				reason, powerBlockID, ev.OcppConnectionName, ev.TransactionID, ev.AllocatedLimit)
		} else {
			log.Printf("❌ Echec envoi TxProfile vers %s: %v", ev.OcppConnectionName, err)
		}
	}

	return nil
}

func calculateLimits(powerBlockID int, maxA float64, evs []*EVState) {
	minAmpsToCharge := 6.0

	// S'il n'y a qu'une seule transaction, elle reçoit tout (sans underloading)
	if len(evs) == 1 {
		evs[0].AllocatedLimit = floor10(maxA)
		return
	}

	unallocatedPower := maxA
	var normalEVs []*EVState

	// La part équitable théorique initiale nous sert de référence 
	// pour savoir si une borne est "en cours de remontée"
	baseFairShare := math.Floor(maxA / float64(len(evs)))
	
	var unlockedEVs []*EVState
	for _, ev := range evs {
		unlockedEVs = append(unlockedEVs, ev)
	}

	for len(unlockedEVs) > 0 {
		fairShare := math.Floor(unallocatedPower / float64(len(unlockedEVs)))
		foundUnderloaded := false

		for i, ev := range unlockedEVs {
			stateMutex.Lock()
			currentLimit, exists := lastAppliedLimits[ev.TransactionID]
			graceEnd := gracePeriodCache[ev.TransactionID]
			stateMutex.Unlock()

			if !exists {
				currentLimit = baseFairShare // Fallback si pas de limite connue
			}

			// --- PÉRIODE DE GRÂCE (90s) ---
			// Si la transaction a démarré récemment ou a reçu un boost de courant,
			// on saute l'évaluation de sa consommation (elle rejoint normalEVs).
			if time.Now().Before(graceEnd) {
				continue
			}

			// CONDITION 1 : Nouvelle chute de consommation (-2A par rapport à SA limite)
			isFreshUnderload := ev.CurrentConsumption <= (currentLimit - 2.0)
			
			// CONDITION 2 : Elle est dans un cycle de remontée (+1A à chaque fois) 
			// et n'a pas encore atteint sa part équitable globale
			isStillUnderloaded := currentLimit < baseFairShare

			if isFreshUnderload || isStillUnderloaded {
				// L'arrondi se fait au plus proche (ex: 5.97 -> 6.0) + 1A
				neededPower := math.Round(ev.CurrentConsumption) + 1.0

				if neededPower < minAmpsToCharge {
					neededPower = minAmpsToCharge
				}

				// Si la puissance demandée est inférieure à la part équitable du moment,
				// on verrouille la borne en mode "Underloaded"
				if neededPower < fairShare {
					ev.AllocatedLimit = neededPower
					ev.Locked = true
					unallocatedPower -= neededPower

					log.Printf("📉 [DEBUG UNDERLOADING] Block %d | Borne %s en sous-charge. "+
						"Cons: %.2fA | Limite Act: %.1fA | Nvlle Limite: Round(%.2f) + 1A = %.1fA",
						powerBlockID, ev.OcppConnectionName, ev.CurrentConsumption, currentLimit, ev.CurrentConsumption, neededPower)

					// On la retire de la boucle pour recalculer le reste
					unlockedEVs = append(unlockedEVs[:i], unlockedEVs[i+1:]...)
					foundUnderloaded = true
					break
				}
			}
		}

		if !foundUnderloaded {
			// Les véhicules restants ne sont pas (ou plus) en sous-charge.
			// Ils rejoignent le pool normal pour se partager le reste.
			for _, ev := range unlockedEVs {
				normalEVs = append(normalEVs, ev)
			}
			break
		}
	}

	// Phase 2 - Répartition mathématique parfaite du reste entre les bornes "Normales"
	if len(normalEVs) > 0 {
		for i, ev := range normalEVs {
			share := math.Floor(unallocatedPower / float64(len(normalEVs)-i))
			ev.AllocatedLimit = share
			ev.Locked = true
			unallocatedPower -= share
		}
	}
}

func extractPowerBlockID(client *citrineclient.Client, payload HasuraEventPayload) int {
	var data map[string]interface{}
	
	if payload.Event.Data["new"] != nil {
		data = payload.Event.Data["new"].(map[string]interface{})
	} else if payload.Event.Data["old"] != nil {
		data = payload.Event.Data["old"].(map[string]interface{})
	}

	if data == nil {
		return 0
	}

	stationIDFloat, ok := data["stationId"].(float64)
	if !ok {
		return 0
	}
	stationID := int(stationIDFloat)

	query := `
		query GetPowerBlockID($stationId: Int!) {
			ChargingStations(where: {id: {_eq: $stationId}}) {
				power_block_id
			}
		}
	`
	variables := map[string]interface{}{"stationId": stationID}

	var resp struct {
		Data struct {
			ChargingStations []struct {
				PowerBlockID *int `json:"power_block_id"`
			} `json:"ChargingStations"`
		} `json:"data"`
	}

	if err := doGraphQLQuery(client, query, variables, &resp); err == nil {
		if len(resp.Data.ChargingStations) > 0 && resp.Data.ChargingStations[0].PowerBlockID != nil {
			return *resp.Data.ChargingStations[0].PowerBlockID
		}
	}

	return 0
}

func sendTxProfile(client *citrineclient.Client, ev *EVState, profileID int) error {
	now := time.Now().UTC()

	payload := citrineclient.SetChargingProfilePayload{
		EvseID: ev.EvseID,
		ChargingProfile: citrineclient.ChargingProfile{
			ID:                     profileID,
			StackLevel:             profileID,
			ChargingProfilePurpose: "TxProfile",
			ChargingProfileKind:    "Absolute",
			TransactionId:          ev.TransactionID,
			ChargingSchedule: []citrineclient.ChargingSchedule{
				{
					ID:               profileID,
					StartSchedule:    now.Format(time.RFC3339),
					ChargingRateUnit: "A",
					ChargingSchedulePeriod: []citrineclient.ChargingSchedulePeriod{
						{
							StartPeriod:  0,
							Limit:        citrineclient.JSONFloat(ev.AllocatedLimit),
							NumberPhases: 3,
						},
					},
				},
			},
		},
	}

	url := fmt.Sprintf("%s/ocpp/2.1/smartcharging/setChargingProfile?identifier=%s&tenantId=1", client.CitrineURL, ev.OcppConnectionName)
	return client.CallCitrineOS(url, payload, "Set TxProfile")
}

func fetchPowerBlockState(client *citrineclient.Client, powerBlockID int) (float64, []*EVState, error) {
	// On demande les 10 dernières MeterValues pour être sûr d'avoir une valeur Periodic récente 
	// et esquiver les "Sample.Clock" polluants.
	query := `
		query GetPowerBlockState($blockId: Int!) {
			PowerBlocks(where: {id: {_eq: $blockId}}) {
				max_a
			}
			ChargingStations(where: {power_block_id: {_eq: $blockId}}) {
				ocppConnectionName
				Evses {
					id
					evseTypeId
				}
				Transactions(where: {isActive: {_eq: true}}) {
					transactionId
					evseId
					MeterValues(order_by: {timestamp: desc}, limit: 10) {
						sampledValue
					}
				}
			}
		}
	`
	variables := map[string]interface{}{"blockId": powerBlockID}

	var resp struct {
		Data struct {
			PowerBlocks []struct {
				MaxA float64 `json:"max_a"`
			} `json:"PowerBlocks"`
			ChargingStations []struct {
				OcppConnectionName string `json:"ocppConnectionName"`
				Evses              []struct {
					ID         int `json:"id"`
					EvseTypeID int `json:"evseTypeId"`
				} `json:"Evses"`
				Transactions       []struct {
					TransactionID string `json:"transactionId"`
					EvseID        int    `json:"evseId"`
					MeterValues   []struct {
						SampledValue interface{} `json:"sampledValue"`
					} `json:"MeterValues"`
				} `json:"Transactions"`
			} `json:"ChargingStations"`
		} `json:"data"`
		Errors []interface{} `json:"errors"`
	}

	if err := doGraphQLQuery(client, query, variables, &resp); err != nil {
		return 0, nil, err
	}
	if len(resp.Errors) > 0 {
		return 0, nil, fmt.Errorf("erreurs GraphQL: %v", resp.Errors)
	}

	if len(resp.Data.PowerBlocks) == 0 {
		return 0, nil, fmt.Errorf("PowerBlock %d introuvable", powerBlockID)
	}

	maxA := resp.Data.PowerBlocks[0].MaxA
	var evs []*EVState

	for _, station := range resp.Data.ChargingStations {
		evseMap := make(map[int]int)
		for _, evse := range station.Evses {
			evseMap[evse.ID] = evse.EvseTypeID
		}

		for _, tx := range station.Transactions {
			currentConsumption := 0.0

			// On parcourt l'historique récent (limit: 10) pour trouver la première valeur valide Periodic
			for _, mv := range tx.MeterValues {
				if mv.SampledValue != nil {
					if val, found := extractMaxCurrent(mv.SampledValue); found {
						currentConsumption = val
						break // Valeur trouvée ! On arrête de chercher dans les vieilles MeterValues
					}
				}
			}

			realEvseID := tx.EvseID
			if typeID, exists := evseMap[tx.EvseID]; exists {
				realEvseID = typeID
			}

			evs = append(evs, &EVState{
				TransactionID:      tx.TransactionID,
				OcppConnectionName: station.OcppConnectionName,
				EvseID:             realEvseID,
				CurrentConsumption: currentConsumption,
				Locked:             false,
			})
		}
	}

	return maxA, evs, nil
}

// extractMaxCurrent fouille le JSON et retourne (la_valeur_max, true) 
// si elle a trouvé un 'Current.Import' valide qui n'est pas un 'Sample.Clock'
func extractMaxCurrent(sampledValueRaw interface{}) (float64, bool) {
	if sampledValueRaw == nil {
		return 0.0, false
	}

	var sampledValues []interface{}
	switch v := sampledValueRaw.(type) {
	case string:
		json.Unmarshal([]byte(v), &sampledValues)
	case []interface{}:
		sampledValues = v
	}

	maxCurrent := 0.0
	foundValidMeasure := false

	for _, val := range sampledValues {
		if valMap, ok := val.(map[string]interface{}); ok {
			
			// Filtrage : Ignorer les Clock
			if contextVal, hasContext := valMap["context"].(string); hasContext {
				if contextVal == "Sample.Clock" {
					continue 
				}
			}

			if measurand, ok := valMap["measurand"].(string); ok && measurand == "Current.Import" {
				var currentVal float64
				
				if vFloat, isFloat := valMap["value"].(float64); isFloat {
					currentVal = vFloat
				} else if vStr, isStr := valMap["value"].(string); isStr {
					if parsed, err := strconv.ParseFloat(vStr, 64); err == nil {
						currentVal = parsed
					}
				}

				if currentVal > maxCurrent {
					maxCurrent = currentVal
				}
				foundValidMeasure = true
			}
		}
	}
	return maxCurrent, foundValidMeasure
}

func getNextProfileID(client *citrineclient.Client, stationName string, evseID int) (int, error) {
	if client.HasuraURL == "" {
		return 501, nil
	}

	query := `
		query GetMaxProfileID($station: String!, $evse: Int!) {
			ChargingProfiles(
				where: {ocppConnectionName: {_eq: $station}, evseId: {_eq: $evse}}, 
				order_by: {id: desc}, 
				limit: 1
			) {
				id
			}
		}
	`
	variables := map[string]interface{}{
		"station": stationName,
		"evse":    evseID,
	}

	var resp struct {
		Data struct {
			ChargingProfiles []struct {
				ID int `json:"id"`
			} `json:"ChargingProfiles"`
		} `json:"data"`
	}

	if err := doGraphQLQuery(client, query, variables, &resp); err == nil {
		if len(resp.Data.ChargingProfiles) > 0 {
			return resp.Data.ChargingProfiles[0].ID + 1, nil
		}
	}

	return 501, nil
}

func doGraphQLQuery(client *citrineclient.Client, query string, variables map[string]interface{}, response interface{}) error {
	payload := map[string]interface{}{
		"query":     query,
		"variables": variables,
	}
	jsonValue, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", client.HasuraURL, bytes.NewBuffer(jsonValue))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-hasura-admin-secret", client.HasuraSecret)

	resp, err := (&http.Client{}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	return json.Unmarshal(bodyBytes, response)
}