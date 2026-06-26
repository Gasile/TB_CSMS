package main

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

// --- CONFIGURATION ---
const (
	Port = ":8080"
)

var (
	GracePeriod       time.Duration
	HasuraURL         = os.Getenv("HASURA_GRAPHQL_URL")
	HasuraAdminSecret = os.Getenv("HASURA_GRAPHQL_ADMIN_SECRET")
)

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

// --- STRUCTURES DE DONNÉES ---
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

// --- GESTIONNAIRE D'ÉTAT ---
type IdleTracker struct {
	sync.Mutex
	timers map[string]*time.Timer
}

var tracker = IdleTracker{
	timers: make(map[string]*time.Timer),
}

func (t *IdleTracker) startOrResetTimer(transactionID string) {
	t.Lock()
	defer t.Unlock()

	if existingTimer, exists := t.timers[transactionID]; exists {
		existingTimer.Stop()
		log.Printf("⏱️  Chrono réinitialisé pour la transaction DB ID: %s", transactionID)
	} else {
		log.Printf("⏱️  Nouveau chrono démarré (ou reprise) pour la transaction DB ID: %s", transactionID)

		// Si le chrono n'existait pas, cela signifie que la charge commence ou reprend après une infraction.
		// On s'assure de nettoyer la base de données de toute infraction précédente.
		go markTransactionAsLegal(transactionID)
	}

	t.timers[transactionID] = time.AfterFunc(GracePeriod, func() {
		log.Printf("🚨 DÉLAI DÉPASSÉ ! La transaction %s est maintenant en infraction.", transactionID)
		markTransactionAsIllegal(transactionID)

		t.Lock()
		delete(t.timers, transactionID)
		t.Unlock()
	})
}

func (t *IdleTracker) stopTimer(transactionID string) {
	t.Lock()
	defer t.Unlock()

	if timer, exists := t.timers[transactionID]; exists {
		timer.Stop()
		delete(t.timers, transactionID)
		log.Printf("✅ Fin de session pour la transaction DB ID: %s. Chrono détruit.", transactionID)
	} else {
		// Ajout du log pour les transactions qui se terminent après l'infraction
		log.Printf("✅ Fin de session pour la transaction DB ID: %s. Aucun chrono en cours (déjà expiré).", transactionID)
	}
}

// --- COMMUNICATION AVEC HASURA ---

// markTransactionAsIllegal passe is_legal à false
func markTransactionAsIllegal(transactionID string) {
	idInt, _ := strconv.Atoi(transactionID)
	overtimeStart := time.Now().UTC().Format(time.RFC3339)

	// ATTENTION : J'ai mis "update_Transactions_by_pk" avec un T majuscule comme dans ta capture
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

// markTransactionAsLegal remet is_legal à true et efface le timestamp
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

// sendGraphQLRequest est une fonction utilitaire pour factoriser les appels HTTP
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

	// Lecture du corps de la réponse pour détecter les erreurs internes de GraphQL
	bodyBytes, _ := io.ReadAll(resp.Body)
	bodyStr := string(bodyBytes)

	if strings.Contains(bodyStr, `"errors"`) {
		log.Printf("❌ ERREUR HASURA [%s]: %s", actionName, bodyStr)
	} else if resp.StatusCode == http.StatusOK {
		log.Printf("🗄️  Succès [%s] DB mise à jour.", actionName)
	}
}

// --- SERVEUR HTTP ---

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

func main() {
	fmt.Println("🚀 Démarrage du service d'Idle Detection (CSMS) sur le port", Port)
	fmt.Printf("⏱️  Délai de grâce configuré à : %v\n", GracePeriod)
	http.HandleFunc("/webhook", handleWebhook)
	log.Fatalf("Échec: %v", http.ListenAndServe(Port, nil))
}
