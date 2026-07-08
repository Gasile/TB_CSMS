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
	"sort"
	"strconv"
	"sync"
	"time"

	"csms/smart-charging/internal/citrineclient"
)

// --- CONFIGURATION ---
const CheckInterval = 30 * time.Second

// --- VARIABLES GLOBALES (Mémoire du service) ---
var (
	stateMutex            sync.Mutex
	activeLoops           = make(map[int]context.CancelFunc)
	lastAppliedLimits     = make(map[string]float64)
	gracePeriodCache      = make(map[string]time.Time)
	sessionStartTime      = make(map[string]time.Time)
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
	Weight             int
	CurrentConsumption float64
	AllocatedLimit     float64
	Locked             bool
	StartTime          time.Time
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

		if payload.Table.Name != "Transactions" && payload.Table.Name != "transactions" &&
			payload.Table.Name != "ChargingStations" && payload.Table.Name != "charging_stations" {
			w.WriteHeader(http.StatusOK)
			return
		}

		powerBlockID := extractPowerBlockID(client, payload)
		if powerBlockID == 0 {
			w.WriteHeader(http.StatusOK)
			return
		}

		log.Printf("🔄 Changement Topologique/Poids détecté. Réinitialisation du Block %d...", powerBlockID)
		resetBlockLoop(client, powerBlockID)
		w.WriteHeader(http.StatusOK)
	}
}

func resetBlockLoop(client *citrineclient.Client, powerBlockID int) {
	stateMutex.Lock()
	if cancel, exists := activeLoops[powerBlockID]; exists {
		cancel()
		delete(activeLoops, powerBlockID)
	}
	ctx, cancel := context.WithCancel(context.Background())
	activeLoops[powerBlockID] = cancel
	stateMutex.Unlock()

	// Exécution immédiate
	err := executeCalculation(client, powerBlockID, "Changement Topologique")
	if err != nil {
		log.Printf("❌ Erreur au changement topologique (Block %d): %v", powerBlockID, err)
	}

	// Lancement du timer de 30s
	go func(bID int, loopCtx context.Context) {
		ticker := time.NewTicker(CheckInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				err := executeCalculation(client, bID, "Ajustement (Timer 30s)")
				if err != nil {
					log.Printf("❌ Erreur au check périodique (Block %d): %v", bID, err)
				}
			case <-loopCtx.Done():
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

	stateMutex.Lock()
	for _, ev := range evStates {
		if _, exists := sessionStartTime[ev.TransactionID]; !exists {
			sessionStartTime[ev.TransactionID] = time.Now()
		}
		ev.StartTime = sessionStartTime[ev.TransactionID]

		if _, exists := gracePeriodCache[ev.TransactionID]; !exists {
			gracePeriodCache[ev.TransactionID] = time.Now().Add(90 * time.Second)
		}
	}
	stateMutex.Unlock()

	// La logique d'underloading est maintenant unifiée (plus de distinction timer/topologie)
	calculateLimits(powerBlockID, maxA, evStates)

	for _, ev := range evStates {
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

			if hadOldLimit && (ev.AllocatedLimit-oldLimit) >= 2.0 {
				gracePeriodCache[ev.TransactionID] = time.Now().Add(90 * time.Second)
				log.Printf("⏳ [GRÂCE] Block %d | Borne %s passe de %.1fA à %.1fA. Période de grâce 90s accordée.",
					powerBlockID, ev.OcppConnectionName, oldLimit, ev.AllocatedLimit)
			}
			stateMutex.Unlock()

			log.Printf("✅ [%s] Block %d | Profil envoyé à %s (Tx: %s, Poids: %d) : Limite %.1fA",
				reason, powerBlockID, ev.OcppConnectionName, ev.TransactionID, ev.Weight, ev.AllocatedLimit)
		} else {
			log.Printf("❌ Echec envoi TxProfile vers %s: %v", ev.OcppConnectionName, err)
		}
	}

	return nil
}

func calculateLimits(powerBlockID int, maxA float64, evs []*EVState) {
	minAmpsToCharge := 6.0

	// --- PHASE 1 : EXCLUSION PHYSIQUE ABSOLUE ---
	maxActiveCars := int(maxA / minAmpsToCharge)

	if maxActiveCars == 0 {
		for _, ev := range evs {
			ev.AllocatedLimit = 0.0
			ev.Locked = true
		}
		return
	}

	if len(evs) > maxActiveCars {
		sort.SliceStable(evs, func(i, j int) bool {
			if evs[i].Weight != evs[j].Weight {
				return evs[i].Weight > evs[j].Weight
			}
			return evs[i].StartTime.Before(evs[j].StartTime)
		})
		for i := maxActiveCars; i < len(evs); i++ {
			evs[i].AllocatedLimit = 0.0
			evs[i].Locked = true
		}
	}

	// --- PHASE 2 : DETECTION UNDERLOADING ---
	var unlockedEVs []*EVState
	totalOriginalActiveWeight := 0
	for _, ev := range evs {
		if !ev.Locked {
			unlockedEVs = append(unlockedEVs, ev)
			totalOriginalActiveWeight += ev.Weight
		}
	}

	if len(unlockedEVs) == 0 {
		return
	}
	if len(unlockedEVs) == 1 {
		unlockedEVs[0].AllocatedLimit = floor10(maxA)
		unlockedEVs[0].Locked = true
		return
	}

	unallocatedPower := maxA

	for len(unlockedEVs) > 0 {
		currentIterationWeight := 0
		for _, ev := range unlockedEVs {
			currentIterationWeight += ev.Weight
		}

		if currentIterationWeight == 0 {
			break
		}

		if len(unlockedEVs) == 1 {
			unlockedEVs[0].AllocatedLimit = math.Floor(unallocatedPower)
			unlockedEVs[0].Locked = true
			break
		}

		foundUnderloaded := false

		for i, ev := range unlockedEVs {
			stateMutex.Lock()
			currentLimit, exists := lastAppliedLimits[ev.TransactionID]
			graceEnd := gracePeriodCache[ev.TransactionID]
			stateMutex.Unlock()

			baseFairShare := math.Floor(maxA * float64(ev.Weight) / float64(totalOriginalActiveWeight))

			if !exists {
				currentLimit = baseFairShare
			}

			if time.Now().Before(graceEnd) {
				continue
			}

			isFreshUnderload := ev.CurrentConsumption <= (currentLimit - 2.0)
			isStillUnderloaded := currentLimit < baseFairShare

			if isFreshUnderload || isStillUnderloaded {
				neededPower := math.Round(ev.CurrentConsumption) + 1.0

				if neededPower < minAmpsToCharge {
					neededPower = minAmpsToCharge
				}

				iterationFairShare := math.Floor(unallocatedPower * float64(ev.Weight) / float64(currentIterationWeight))

				if neededPower < iterationFairShare {
					ev.AllocatedLimit = neededPower
					ev.Locked = true
					unallocatedPower -= neededPower

					log.Printf("📉 [DEBUG UNDERLOADING] Block %d | %s (Poids %d) en sous-charge. "+
						"Cons: %.2fA | Limite Act: %.1fA | Nvlle Limite: Round(%.2f) + 1A = %.1fA",
						powerBlockID, ev.OcppConnectionName, ev.Weight, ev.CurrentConsumption, currentLimit, ev.CurrentConsumption, neededPower)

					unlockedEVs = append(unlockedEVs[:i], unlockedEVs[i+1:]...)
					foundUnderloaded = true
					break
				}
			}
		}

		if !foundUnderloaded {
			break
		}
	}

	// --- PHASE 3 : DISTRIBUTION MATHEMATHIQUE PROTEGEE ---
	if len(unlockedEVs) > 0 {
		distributeWeightedRest(unlockedEVs, unallocatedPower)
	}
}

// distributeWeightedRest répartit le courant au prorata du poids.
// NOUVEAUTÉ : Si la division mathématique tombe sous 6A, on verrouille la borne à 6A
// et on redistribue le reste. On ne sacrifie plus de bornes à 0A.
func distributeWeightedRest(evs []*EVState, remainingPower float64) {
	minAmpsToCharge := 6.0

	var unlocked []*EVState
	for _, ev := range evs {
		unlocked = append(unlocked, ev)
	}

	// ÉTAPE A : Sécurisation du socle vital (6.0A)
	for len(unlocked) > 0 {
		totalWeight := 0
		for _, ev := range unlocked {
			totalWeight += ev.Weight
		}

		if totalWeight == 0 {
			break
		}

		foundUnderMin := false
		for i, ev := range unlocked {
			theoreticalShare := remainingPower * float64(ev.Weight) / float64(totalWeight)
			
			// Si le pourcentage du poids lui donne moins de 6A, on force à 6A.
			if theoreticalShare < minAmpsToCharge {
				ev.AllocatedLimit = minAmpsToCharge
				ev.Locked = true
				remainingPower -= minAmpsToCharge
				
				unlocked = append(unlocked[:i], unlocked[i+1:]...)
				foundUnderMin = true
				break
			}
		}

		if !foundUnderMin {
			break
		}
	}

	// ÉTAPE B : Distribution du surplus pour les bornes "saines"
	if len(unlocked) > 0 {
		sort.SliceStable(unlocked, func(i, j int) bool {
			if unlocked[i].Weight != unlocked[j].Weight {
				return unlocked[i].Weight > unlocked[j].Weight
			}
			return unlocked[i].StartTime.Before(unlocked[j].StartTime)
		})

		totalWeight := 0
		for _, ev := range unlocked {
			totalWeight += ev.Weight
		}

		tempPower := remainingPower
		for _, ev := range unlocked {
			share := math.Floor(remainingPower * float64(ev.Weight) / float64(totalWeight))
			ev.AllocatedLimit = share
			tempPower -= share
		}

		// On donne les restes (+1A) aux bornes les plus prioritaires (début de liste)
		for i := 0; i < len(unlocked) && tempPower >= 1.0; i++ {
			unlocked[i].AllocatedLimit += 1.0
			tempPower -= 1.0
		}

		for _, ev := range unlocked {
			ev.Locked = true
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
	stationID := 0

	if ok {
		stationID = int(stationIDFloat)
	} else if idFloat, okID := data["id"].(float64); okID && (payload.Table.Name == "ChargingStations" || payload.Table.Name == "charging_stations") {
		stationID = int(idFloat)
	} else {
		return 0
	}

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
	query := `
		query GetPowerBlockState($blockId: Int!) {
			PowerBlocks(where: {id: {_eq: $blockId}}) {
				max_a
			}
			ChargingStations(where: {power_block_id: {_eq: $blockId}}) {
				ocppConnectionName
				weight
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
				Weight             *int   `json:"weight"`
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

		stationWeight := 1
		if station.Weight != nil && *station.Weight > 0 {
			stationWeight = *station.Weight
		}

		for _, tx := range station.Transactions {
			currentConsumption := 0.0

			for _, mv := range tx.MeterValues {
				if mv.SampledValue != nil {
					if val, found := extractMaxCurrent(mv.SampledValue); found {
						currentConsumption = val
						break
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
				Weight:             stationWeight,
				CurrentConsumption: currentConsumption,
				Locked:             false,
			})
		}
	}

	return maxA, evs, nil
}

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