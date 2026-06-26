package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)

// --- CONFIGURATION ---
const (
	Port = ":8080" // Port d'écoute du serveur HTTP interne
)

// Configuration chargée dynamiquement
var (
	GracePeriod       time.Duration                     // Le délai avant qu'une session ne devienne illégale
	HasuraURL         = os.Getenv("HASURA_GRAPHQL_URL") // ex: http://hasura:8080/v1/graphql
	HasuraAdminSecret = os.Getenv("HASURA_GRAPHQL_ADMIN_SECRET")
)

// init s'exécute automatiquement au lancement du programme
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
		GracePeriod = 30 * time.Minute // Valeur par défaut
	}
}

// --- STRUCTURES DE DONNÉES (Pour parser les JSON d'Hasura) ---

// Payload générique reçu depuis un Event Trigger Hasura
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

// --- GESTIONNAIRE D'ÉTAT (Le cœur du système) ---

// IdleTracker gère les chronomètres pour chaque transaction active
type IdleTracker struct {
	sync.Mutex // Pour éviter les crashs si 2 requêtes arrivent en même temps
	timers     map[string]*time.Timer
}

var tracker = IdleTracker{
	timers: make(map[string]*time.Timer),
}

// startOrResetTimer lance un nouveau chrono ou relance le chrono existant pour une transaction
func (t *IdleTracker) startOrResetTimer(transactionID string) {
	t.Lock()         // On verrouille la Map
	defer t.Unlock() // On déverrouillera automatiquement à la fin de la fonction

	// Si un timer existe déjà pour cette transaction, on l'arrête
	if existingTimer, exists := t.timers[transactionID]; exists {
		existingTimer.Stop()
		log.Printf("⏱️  Chrono réinitialisé pour la transaction DB ID: %s", transactionID)
	} else {
		log.Printf("⏱️  Nouveau chrono démarré pour la transaction DB ID: %s", transactionID)
	}

	// On lance un nouveau timer asynchrone (Goroutine)
	t.timers[transactionID] = time.AfterFunc(GracePeriod, func() {
		// Ce code s'exécutera UNIQUEMENT si le chrono arrive à 0
		log.Printf("🚨 DÉLAI DÉPASSÉ ! La transaction %s est maintenant en infraction.", transactionID)
		markTransactionAsIllegal(transactionID)

		// On nettoie la map une fois l'action terminée
		t.Lock()
		delete(t.timers, transactionID)
		t.Unlock()
	})
}

// stopTimer arrête définitivement un chrono (quand l'utilisateur débranche sa voiture)
func (t *IdleTracker) stopTimer(transactionID string) {
	t.Lock()
	defer t.Unlock()

	if timer, exists := t.timers[transactionID]; exists {
		timer.Stop()
		delete(t.timers, transactionID)
		log.Printf("✅ Fin de session pour la transaction DB ID: %s (isActive = false). Chrono détruit.", transactionID)
	}
}

// --- COMMUNICATION AVEC HASURA (GraphQL) ---

// markTransactionAsIllegal envoie la mutation à Hasura pour mettre à jour la DB
func markTransactionAsIllegal(transactionID string) {
	if HasuraURL == "" || HasuraAdminSecret == "" {
		log.Println("⚠️  ATTENTION: Variables Hasura non définies. Mutation ignorée (Mode Test).")
		return
	}

	// Convertir l'ID transaction (string) en entier pour Hasura (GraphQL attend un Int!)
	idInt, err := strconv.Atoi(transactionID)
	if err != nil {
		log.Printf("Erreur: Impossible de convertir le transactionID '%s' en entier: %v", transactionID, err)
		return
	}

	// Calcul du timestamp exact de la fin du délai de grâce
	overtimeStart := time.Now().UTC().Format(time.RFC3339)

	// La mutation GraphQL pour mettre à jour les colonnes
	query := `
		mutation UpdateTransactionToIllegal($id: Int!, $timestamp: timestamptz!) {
			update_transactions_by_pk(
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

	// On prépare le payload JSON pour la requête GraphQL
	payload := map[string]interface{}{
		"query": query,
		"variables": map[string]interface{}{
			"id":        idInt,
			"timestamp": overtimeStart,
		},
	}

	jsonValue, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", HasuraURL, bytes.NewBuffer(jsonValue))
	if err != nil {
		log.Printf("Erreur lors de la création de la requête Hasura: %v", err)
		return
	}

	// Ajout des Headers de sécurité pour Hasura
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-hasura-admin-secret", HasuraAdminSecret)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Erreur réseau vers Hasura: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		log.Printf("🗄️  Base de données mise à jour avec succès pour la transaction %s", transactionID)
	} else {
		log.Printf("❌ Erreur retournée par Hasura (Statut: %d)", resp.StatusCode)
	}
}

// --- SERVEUR HTTP (Points d'entrée des Webhooks) ---

// handleWebhook est la fonction appelée par Hasura lors d'un événement
func handleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Méthode non autorisée", http.StatusMethodNotAllowed)
		return
	}

	var payload HasuraEventPayload
	err := json.NewDecoder(r.Body).Decode(&payload)
	if err != nil {
		http.Error(w, "Erreur de décodage JSON", http.StatusBadRequest)
		return
	}

	tableName := payload.Table.Name
	operation := payload.Event.Op
	data := payload.Event.Data.New

	// Routage de la logique métier selon la table d'origine de l'événement
	switch tableName {
	case "Transactions", "transactions":
		// Extraction de l'ID interne de la base de données (colonne 'id' en Integer)
		var txID string
		if idFloat, ok := data["id"].(float64); ok {
			txID = fmt.Sprintf("%.0f", idFloat)
		} else {
			log.Println("⚠️  Impossible de trouver la colonne 'id' dans le payload Transactions.")
			w.WriteHeader(http.StatusOK)
			return
		}

		if operation == "INSERT" {
			tracker.startOrResetTimer(txID)
		} else if operation == "UPDATE" {
			// On observe la colonne 'isActive'
			if isActive, ok := data["isActive"].(bool); ok {
				if !isActive {
					tracker.stopTimer(txID)
				}
			}
		}

	case "MeterValues", "meter_values":
		// Extraction de l'ID de la transaction liée.
		// Note : selon CitrineOS, la Foreign Key est souvent nommée 'transactionDatabaseId' ou 'transactionId'
		var txID string
		if tid, ok := data["transactionDatabaseId"].(float64); ok {
			txID = fmt.Sprintf("%.0f", tid)
		} else if tid, ok := data["transaction_id"].(float64); ok {
			txID = fmt.Sprintf("%.0f", tid)
		} else if tid, ok := data["transactionId"].(float64); ok { // Au cas où
			txID = fmt.Sprintf("%.0f", tid)
		}

		if txID == "" || txID == "0" {
			// On ignore silencieusement les MeterValues qui ne sont pas liées à une transaction (ex: métriques globales de la borne)
			w.WriteHeader(http.StatusOK)
			return
		}

		// Décorticage du JSON "sampledValue"
		if sampledValueRaw, ok := data["sampledValue"]; ok {
			var sampledValues []interface{}

			// Hasura peut envoyer du JSONB soit sous forme de tableau (slice), soit en string sérialisé
			switch v := sampledValueRaw.(type) {
			case string:
				json.Unmarshal([]byte(v), &sampledValues)
			case []interface{}:
				sampledValues = v
			}

			// On itère dans le tableau pour trouver la puissance active importée
			for _, val := range sampledValues {
				if valMap, ok := val.(map[string]interface{}); ok {
					if measurand, ok := valMap["measurand"].(string); ok && measurand == "Power.Active.Import" {
						// On extrait et on vérifie la valeur de la puissance
						var powerValue float64

						// La valeur peut être stockée en tant que float64 (JSON Number) ou string
						if vFloat, isFloat := valMap["value"].(float64); isFloat {
							powerValue = vFloat
						} else if vStr, isStr := valMap["value"].(string); isStr {
							if parsed, err := strconv.ParseFloat(vStr, 64); err == nil {
								powerValue = parsed
							}
						}

						if powerValue > 0 {
							// On a reçu une lecture de puissance > 0, on relance le chrono !
							tracker.startOrResetTimer(txID)
						} else {
							// Puissance à 0 : On laisse le chrono tourner sans le réinitialiser.
							log.Printf("ℹ️  Puissance à 0 W détectée pour la transaction DB ID: %s. Le chrono continue.", txID)
						}
						break // Inutile de lire le reste du tableau
					}
				}
			}
		}
	}

	// On répond toujours 200 OK à Hasura pour acquitter la réception
	w.WriteHeader(http.StatusOK)
}

func main() {
	fmt.Println("🚀 Démarrage du service d'Idle Detection (CSMS) sur le port", Port)
	fmt.Printf("⏱️  Délai de grâce configuré à : %v\n", GracePeriod)

	http.HandleFunc("/webhook", handleWebhook)

	err := http.ListenAndServe(Port, nil)
	if err != nil {
		log.Fatalf("Échec du démarrage du serveur: %v", err)
	}
}
