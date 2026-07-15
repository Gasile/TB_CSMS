package smartcharging

// --- IMPORTS ---
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

// --- GLOBAL VARIABLES ---
var (
	stateMutex         sync.Mutex
	activeLoops        = make(map[int]context.CancelFunc)
	lastAppliedLimits  = make(map[string]float64)
	gracePeriodCache   = make(map[string]time.Time)
	sessionStartTime   = make(map[string]time.Time) 
)

// --- STRUCTURES ---

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
	Protocol           string 
	EvseID             int
	Weight             int
	CurrentConsumption float64
	AllocatedLimit     float64
	Locked             bool
	StartTime          time.Time 
}

// --- HANDLERS ---

/**
 * Listens for Hasura webhooks representing changes to topologies or transactions, extracting affected blocks to trigger load-balancing recalculations.
 */
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

		tableName := payload.Table.Name
		if tableName != "Transactions" && tableName != "transactions" &&
			tableName != "ChargingStations" && tableName != "charging_stations" &&
			tableName != "PowerBlocks" && tableName != "power_blocks" {
			w.WriteHeader(http.StatusOK)
			return
		}

		powerBlockIDs := extractPowerBlockIDs(client, payload)
		if len(powerBlockIDs) == 0 {
			w.WriteHeader(http.StatusOK)
			return
		}

		for _, powerBlockID := range powerBlockIDs {
			log.Printf("🔄 Changement détecté (Table: %s). Réinitialisation du Block %d...", tableName, powerBlockID)
			resetBlockLoop(client, powerBlockID)
		}

		w.WriteHeader(http.StatusOK)
	}
}

// --- CORE LOGIC ---

/**
 * Resets the recalculation timer loop for a given Power Block to instantly handle topology/weight changes and schedule periodic checks.
 */
func resetBlockLoop(client *citrineclient.Client, powerBlockID int) {
	stateMutex.Lock()
	if cancel, exists := activeLoops[powerBlockID]; exists {
		cancel()
		delete(activeLoops, powerBlockID)
	}
	ctx, cancel := context.WithCancel(context.Background())
	activeLoops[powerBlockID] = cancel
	stateMutex.Unlock()

	err := executeCalculation(client, powerBlockID, "Changement Topologique/Poids")
	if err != nil {
		log.Printf("❌ Erreur au changement topologique (Block %d): %v", powerBlockID, err)
	}

	// Spin up a background ticker to continually balance power distribution over time based on live consumption
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

/**
 * Orchestrates fetching the current state, calculating new power limits, enforcing grace periods, and dispatching those limits to the charging stations.
 */
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

	// Initialize tracking metadata for any newly discovered EV sessions
	stateMutex.Lock()
	for _, ev := range evStates {
		if _, exists := sessionStartTime[ev.TransactionID]; !exists {
			sessionStartTime[ev.TransactionID] = time.Now()
		}
		ev.StartTime = sessionStartTime[ev.TransactionID]

		if _, exists := gracePeriodCache[ev.TransactionID]; !exists {
			graceDuration := 90 * time.Second
			if ev.Protocol == "ocpp1.6" {
				graceDuration = 210 * time.Second
			}
			gracePeriodCache[ev.TransactionID] = time.Now().Add(graceDuration)
		}
	}
	stateMutex.Unlock()

	calculateLimits(powerBlockID, maxA, evStates)

	// Apply computed limits iteratively, avoiding redundant API calls if limits haven't changed
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

			limitIncreased := (ev.AllocatedLimit - oldLimit) >= 2.0
			isOcpp16Change := ev.Protocol == "ocpp1.6" && ev.AllocatedLimit != oldLimit

			if hadOldLimit && (limitIncreased || isOcpp16Change) {
				graceDuration := 90 * time.Second
				if ev.Protocol == "ocpp1.6" {
					graceDuration = 210 * time.Second
				}
				gracePeriodCache[ev.TransactionID] = time.Now().Add(graceDuration)
				
				log.Printf("⏳ [GRÂCE] Block %d | Borne %s passe de %.1fA à %.1fA. Période de grâce %.0fs accordée.",
					powerBlockID, ev.OcppConnectionName, oldLimit, ev.AllocatedLimit, graceDuration.Seconds())
			}
			stateMutex.Unlock()

			go updateTransactionLimitInDB(client, ev.TransactionID, ev.AllocatedLimit)

			log.Printf("✅ [%s] Block %d | Profil envoyé à %s [%s] (Tx: %s, Poids: %d) : Limite %.1fA",
				reason, powerBlockID, ev.OcppConnectionName, ev.Protocol, ev.TransactionID, ev.Weight, ev.AllocatedLimit)
		} else {
			log.Printf("❌ Echec envoi TxProfile vers %s: %v", ev.OcppConnectionName, err)
		}
	}

	return nil
}

/**
 * Distributes available power among active sessions based on user weights, vehicle consumption, and fairness constraints.
 */
func calculateLimits(powerBlockID int, maxA float64, evs []*EVState) {
	minAmpsToCharge := 6.0

	maxActiveCars := int(maxA / minAmpsToCharge)

	// If block max capacity cannot sustain even one vehicle, lock all to 0A
	if maxActiveCars == 0 {
		for _, ev := range evs {
			ev.AllocatedLimit = 0.0
			ev.Locked = true
		}
		return
	}

	// De-prioritize vehicles if capacity constraints are completely breached
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

	// Iteratively identify under-consuming vehicles to free up unused power limits for others
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

			// Respect the grace period by deferring penalization based on low consumption
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
						"Cons: %.2fA | Limite Act: %.1fA | Nvlle Limite: %.1fA",
						powerBlockID, ev.OcppConnectionName, ev.Weight, ev.CurrentConsumption, currentLimit, neededPower)

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

	if len(unlockedEVs) > 0 {
		distributeWeightedRest(unlockedEVs, unallocatedPower)
	}
}

/**
 * Distributes remaining unallocated power to the remaining unlocked EVs proportionally by weight.
 */
func distributeWeightedRest(evs []*EVState, remainingPower float64) {
	minAmpsToCharge := 6.0

	var unlocked []*EVState
	for _, ev := range evs {
		unlocked = append(unlocked, ev)
	}

	// Filter out EVs whose fair share would not meet the minimum charging threshold
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

		for i := 0; i < len(unlocked) && tempPower >= 1.0; i++ {
			unlocked[i].AllocatedLimit += 1.0
			tempPower -= 1.0
		}

		for _, ev := range unlocked {
			ev.Locked = true
		}
	}
}

// --- UTILITY FUNCTIONS ---

/**
 * Parses the Hasura webhook payload to identify all unique Power Block IDs affected by the event.
 */
func extractPowerBlockIDs(client *citrineclient.Client, payload HasuraEventPayload) []int {
	blockMap := make(map[int]bool)

	dataNew, _ := payload.Event.Data["new"].(map[string]interface{})
	dataOld, _ := payload.Event.Data["old"].(map[string]interface{})
	tableName := payload.Table.Name

	if tableName == "PowerBlocks" || tableName == "power_blocks" {
		if dataNew != nil {
			if id, ok := dataNew["id"].(float64); ok {
				blockMap[int(id)] = true
			}
		}
	} else if tableName == "ChargingStations" || tableName == "charging_stations" {
		if dataNew != nil {
			if pbID, ok := dataNew["power_block_id"].(float64); ok {
				blockMap[int(pbID)] = true
			}
		}
		if dataOld != nil {
			if pbID, ok := dataOld["power_block_id"].(float64); ok {
				blockMap[int(pbID)] = true
			}
		}
	} else if tableName == "Transactions" || tableName == "transactions" {
		stationID := 0
		if dataNew != nil {
			if sID, ok := dataNew["stationId"].(float64); ok {
				stationID = int(sID)
			}
		}
		if stationID == 0 && dataOld != nil {
			if sID, ok := dataOld["stationId"].(float64); ok {
				stationID = int(sID)
			}
		}

		if stationID != 0 {
			pbID := fetchPowerBlockIDForStation(client, stationID)
			if pbID != 0 {
				blockMap[pbID] = true
			}
		}
	}

	var result []int
	for id := range blockMap {
		if id != 0 {
			result = append(result, id)
		}
	}
	return result
}

/**
 * Dispatches a GraphQL mutation to record the currently allocated transaction limit into the database.
 */
func updateTransactionLimitInDB(client *citrineclient.Client, txID string, limit float64) {
	if client.HasuraURL == "" {
		return
	}
	query := `
		mutation UpdateTxLimit($txId: String!, $limit: numeric!) {
			update_Transactions(where: {transactionId: {_eq: $txId}}, _set: {allocated_limit: $limit}) {
				affected_rows
			}
		}
	`
	variables := map[string]interface{}{"txId": txID, "limit": limit}
	var resp interface{}
	_ = doGraphQLQuery(client, query, variables, &resp)
}

/**
 * Looks up the assigned Power Block ID for a specific charging station.
 */
func fetchPowerBlockIDForStation(client *citrineclient.Client, stationID int) int {
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

/**
 * Triggers the HTTP client to send a transaction-specific smart charging profile to a charging station.
 */
func sendTxProfile(client *citrineclient.Client, ev *EVState, profileID int) error {
	return client.SendSetChargingProfile(
		ev.OcppConnectionName,
		ev.Protocol,
		ev.EvseID,
		profileID,
		ev.AllocatedLimit,
		"TxProfile",
		ev.TransactionID,
	)
}

/**
 * Queries Hasura for the full hierarchy of active sessions and recent consumption metrics associated with a Power Block.
 */
func fetchPowerBlockState(client *citrineclient.Client, powerBlockID int) (float64, []*EVState, error) {
	query := `
		query GetPowerBlockState($blockId: Int!) {
			PowerBlocks(where: {id: {_eq: $blockId}}) {
				max_a
			}
			ChargingStations(where: {power_block_id: {_eq: $blockId}}) {
				ocppConnectionName
				protocol
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
				Protocol           string `json:"protocol"`
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
				Protocol:           station.Protocol,
				EvseID:             realEvseID,
				Weight:             stationWeight,
				CurrentConsumption: currentConsumption,
				Locked:             false,
			})
		}
	}

	return maxA, evs, nil
}

/**
 * Parses raw JSON metervalues from the database to identify the peak current import value.
 */
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

/**
 * Calculates a non-colliding profile ID by querying the most recently created profile on the specified EVSE.
 */
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

/**
 * Internal wrapper to securely marshal variables and execute a standard HTTP POST request to the Hasura GraphQL endpoint.
 */
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

/**
 * Rounds a float downwards specifically to the nearest first decimal place.
 */
func floor10(val float64) float64 {
	return math.Floor(val*10) / 10
}