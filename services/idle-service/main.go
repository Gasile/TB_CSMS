package main

// --- IMPORTS ---
import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// --- GLOBAL VARIABLES ---
const (
	Port = ":8080"
)

var (
	GracePeriod       time.Duration
	HasuraURL         = os.Getenv("HASURA_GRAPHQL_URL")
	HasuraAdminSecret = os.Getenv("HASURA_GRAPHQL_ADMIN_SECRET")
)

/**
 * Initializes the grace period duration from environment variables, defaulting to 30 minutes if unspecified or invalid.
 */
func init() {
	graceStr := os.Getenv("GRACE_PERIOD_MINUTES")
	if graceStr != "" {
		minutes, err := strconv.Atoi(graceStr)
		if err == nil {
			GracePeriod = time.Duration(minutes) * time.Minute
		} else {
			log.Printf("⚠️ Erreur de format pour GRACE_PERIOD_MINUTES, utilisation de 30 minutes par défaut.")
			GracePeriod = 30 * time.Minute
		}
	} else {
		GracePeriod = 30 * time.Minute
	}
}

// --- STRUCTURES ---

type HasuraEventPayload struct {
	Event struct {
		Op   string `json:"op"`
		Data struct {
			New map[string]interface{} `json:"new"`
		} `json:"data"`
	} `json:"event"`
	Table struct {
		Name string `json:"name"`
	} `json:"table"`
}

// --- STATE MANAGEMENT ---

type IdleTracker struct {
	sync.Mutex
	timers map[string]*time.Timer
}

var tracker = IdleTracker{
	timers: make(map[string]*time.Timer),
}

/**
 * Starts a new grace period timer for a transaction or resets an existing one if the vehicle resumes charging.
 */
func (t *IdleTracker) startOrResetTimer(transactionID string) {
	t.Lock()
	defer t.Unlock()

	if existingTimer, exists := t.timers[transactionID]; exists {
		existingTimer.Stop()
		log.Printf("⏱️  Chrono réinitialisé pour la transaction DB ID: %s", transactionID)
	} else {
		log.Printf("⏱️  Nouveau chrono démarré (ou reprise) pour la transaction DB ID: %s", transactionID)
		go markTransactionAsLegal(transactionID)
	}

	t.timers[transactionID] = time.AfterFunc(GracePeriod, func() {
		limit := fetchAllocatedLimit(transactionID)

		if limit == 0.0 {
			log.Printf("⏸️  Délai dépassé pour la transaction %s, MAIS limite à 0A (en attente d'énergie). Chrono redémarré.", transactionID)
			t.startOrResetTimer(transactionID)
		} else {
			log.Printf("🚨 DÉLAI DÉPASSÉ ! La transaction %s (Limite: %.1fA) est maintenant en infraction.", transactionID, limit)
			markTransactionAsIllegal(transactionID)

			t.Lock()
			delete(t.timers, transactionID)
			t.Unlock()
		}
	})
}

/**
 * Stops and removes the active timer for a given transaction when the session ends.
 */
func (t *IdleTracker) stopTimer(transactionID string) {
	t.Lock()
	defer t.Unlock()

	if timer, exists := t.timers[transactionID]; exists {
		timer.Stop()
		delete(t.timers, transactionID)
		log.Printf("✅ Fin de session pour la transaction DB ID: %s. Chrono détruit.", transactionID)
	} else {
		log.Printf("✅ Fin de session pour la transaction DB ID: %s. Aucun chrono en cours (déjà expiré).", transactionID)
	}
}

// --- HASURA COMMUNICATION ---

/**
 * Retrieves the current allocated power limit for a transaction from the database.
 */
func fetchAllocatedLimit(transactionID string) float64 {
	idInt, err := strconv.Atoi(transactionID)
	if err != nil || HasuraURL == "" || HasuraAdminSecret == "" {
		return -1.0
	}

	query := `
		query GetLimit($id: Int!) {
			Transactions_by_pk(id: $id) {
				allocated_limit
			}
		}
	`
	payload := map[string]interface{}{
		"query": query,
		"variables": map[string]interface{}{
			"id": idInt,
		},
	}
	
	jsonValue, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", HasuraURL, bytes.NewBuffer(jsonValue))
	if err != nil {
		return -1.0
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-hasura-admin-secret", HasuraAdminSecret)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Erreur réseau lors de la récupération de la limite: %v", err)
		return -1.0
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	var result struct {
		Data struct {
			TransactionsByPk *struct {
				AllocatedLimit *float64 `json:"allocated_limit"`
			} `json:"Transactions_by_pk"`
		} `json:"data"`
	}

	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return -1.0
	}

	if result.Data.TransactionsByPk != nil && result.Data.TransactionsByPk.AllocatedLimit != nil {
		return *result.Data.TransactionsByPk.AllocatedLimit
	}

	return -1.0
}

/**
 * Flags a transaction as illegal in the database and records the timestamp of the infraction.
 */
func markTransactionAsIllegal(transactionID string) {
	idInt, _ := strconv.Atoi(transactionID)
	overtimeStart := time.Now().UTC().Format(time.RFC3339)

	query := `
		mutation UpdateTransactionToIllegal($id: Int!, $timestamp: timestamptz!) {
			update_Transactions_by_pk(
				pk_columns: { id: $id }, 
				_set: { 
					is_legal: false, 
					overtime_start_timestamp: $timestamp 
				}
			) {
				id
			}
		}
	`
	payload := map[string]interface{}{
		"query": query,
		"variables": map[string]interface{}{
			"id":        idInt,
			"timestamp": overtimeStart,
		},
	}
	sendGraphQLRequest(payload, "Mise en infraction")
}

/**
 * Restores a transaction to legal status in the database and clears the infraction timestamp.
 */
func markTransactionAsLegal(transactionID string) {
	idInt, _ := strconv.Atoi(transactionID)

	query := `
		mutation UpdateTransactionToLegal($id: Int!) {
			update_Transactions_by_pk(
				pk_columns: { id: $id }, 
				_set: { 
					is_legal: true, 
					overtime_start_timestamp: null 
				}
			) {
				id
			}
		}
	`
	payload := map[string]interface{}{
		"query": query,
		"variables": map[string]interface{}{
			"id": idInt,
		},
	}
	sendGraphQLRequest(payload, "Restauration légalité")
}

// --- UTILITY FUNCTIONS ---

/**
 * Executes a given GraphQL payload against the Hasura API and logs the response.
 */
func sendGraphQLRequest(payload map[string]interface{}, actionName string) {
	if HasuraURL == "" || HasuraAdminSecret == "" {
		log.Println("⚠️  Variables Hasura non définies.")
		return
	}

	jsonValue, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", HasuraURL, bytes.NewBuffer(jsonValue))
	if err != nil {
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-hasura-admin-secret", HasuraAdminSecret)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Erreur réseau vers Hasura: %v", err)
		return
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	bodyStr := string(bodyBytes)

	if strings.Contains(bodyStr, `"errors"`) {
		log.Printf("❌ ERREUR HASURA [%s]: %s", actionName, bodyStr)
	} else if resp.StatusCode == http.StatusOK {
		log.Printf("🗄️  Succès [%s] DB mise à jour.", actionName)
	}
}

// --- HANDLERS ---

/**
 * Processes Hasura webhooks to monitor transaction states and live meter values for idle detection.
 */
func handleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Méthode non autorisée", http.StatusMethodNotAllowed)
		return
	}

	var payload HasuraEventPayload
	err := json.NewDecoder(r.Body).Decode(&payload)
	if err != nil {
		return
	}

	tableName := payload.Table.Name
	operation := payload.Event.Op
	data := payload.Event.Data.New

	switch tableName {
	case "Transactions", "transactions":
		var txID string
		if idFloat, ok := data["id"].(float64); ok {
			txID = fmt.Sprintf("%.0f", idFloat)
		} else {
			return
		}

		if operation == "INSERT" {
			tracker.startOrResetTimer(txID)
		} else if operation == "UPDATE" {
			if isActive, ok := data["isActive"].(bool); ok {
				if !isActive {
					tracker.stopTimer(txID)
				}
			}
		}

	case "MeterValues", "meter_values":
		var txID string
		if tid, ok := data["transactionDatabaseId"].(float64); ok {
			txID = fmt.Sprintf("%.0f", tid)
		} else if tid, ok := data["transaction_id"].(float64); ok {
			txID = fmt.Sprintf("%.0f", tid)
		} else if tid, ok := data["transactionId"].(float64); ok {
			txID = fmt.Sprintf("%.0f", tid)
		}

		if txID == "" || txID == "0" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if sampledValueRaw, ok := data["sampledValue"]; ok {
			var sampledValues []interface{}
			switch v := sampledValueRaw.(type) {
			case string:
				json.Unmarshal([]byte(v), &sampledValues)
			case []interface{}:
				sampledValues = v
			}

			for _, val := range sampledValues {
				if valMap, ok := val.(map[string]interface{}); ok {
					if measurand, ok := valMap["measurand"].(string); ok && measurand == "Power.Active.Import" {
						var powerValue float64
						if vFloat, isFloat := valMap["value"].(float64); isFloat {
							powerValue = vFloat
						} else if vStr, isStr := valMap["value"].(string); isStr {
							if parsed, err := strconv.ParseFloat(vStr, 64); err == nil {
								powerValue = parsed
							}
						}

						if powerValue > 0 {
							tracker.startOrResetTimer(txID)
						} else {
							log.Printf("ℹ️  Puissance à 0 W détectée pour %s. Le chrono continue.", txID)
						}
						break
					}
				}
			}
		}
	}

	w.WriteHeader(http.StatusOK)
}

/**
 * Starts the HTTP server and registers the webhook endpoint for idle detection.
 */
func main() {
	fmt.Println("🚀 Démarrage du service d'Idle Detection (CSMS) sur le port", Port)
	fmt.Printf("⏱️  Délai de grâce configuré à : %v\n", GracePeriod)
	http.HandleFunc("/webhook", handleWebhook)
	log.Fatalf("Échec: %v", http.ListenAndServe(Port, nil))
}