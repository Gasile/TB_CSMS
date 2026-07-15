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
)

// --- GLOBAL VARIABLES ---
const Port = ":8085"

var (
	HasuraURL         = os.Getenv("HASURA_GRAPHQL_URL")
	HasuraAdminSecret = os.Getenv("HASURA_GRAPHQL_ADMIN_SECRET")
)

// --- STRUCTURES ---

type HasuraEventPayload struct {
	Event struct {
		Data struct {
			New struct {
				Action             string      `json:"action"`
				Origin             string      `json:"origin"`
				CorrelationID      string      `json:"correlationId"`
				OcppConnectionName string      `json:"ocppConnectionName"`
				Message            interface{} `json:"message"`
			} `json:"new"`
		} `json:"data"`
	} `json:"event"`
}

/**
 * Initializes the Badge Detection service and starts the HTTP server to listen for webhooks.
 */
func main() {
	fmt.Println("🚀 Démarrage du service Badge Detection sur le port", Port)

	if HasuraURL == "" || HasuraAdminSecret == "" {
		fmt.Println("⚠️ ATTENTION : Variables Hasura non définies.")
	}

	http.HandleFunc("/webhooks/authorize", handleAuthorizeMessages)

	err := http.ListenAndServe(Port, nil)
	if err != nil {
		log.Fatalf("Échec du démarrage: %v", err)
	}
}

// --- HANDLERS ---

/**
 * Processes incoming webhook events from Hasura to detect and log unauthorized RFID badges.
 */
func handleAuthorizeMessages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload HasuraEventPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	data := payload.Event.Data.New

	// Filter to process only Authorize events originating from the CSMS
	if data.Action != "Authorize" || data.Origin != "csms" {
		w.WriteHeader(http.StatusOK)
		return
	}

	status := extractStatus(data.Message)

	// Proceed only if the authorization status is explicitly unknown or invalid
	if status != "Unknown" && status != "Invalid" {
		if status != "Accepted" && status != "" {
			log.Printf("ℹ️ Badge connu mais refusé (Statut: %s). Ignoré pour la table UnknownBadges.", status)
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	log.Printf("⚠️ Badge strictement inconnu (Statut: %s) sur la borne %s. Recherche de l'UID...", status, data.OcppConnectionName)

	badgeUID, err := fetchOriginalBadgeUID(data.CorrelationID)
	if err != nil || badgeUID == "" {
		log.Printf("❌ Impossible de retrouver l'UID pour le correlationId %s: %v", data.CorrelationID, err)
		w.WriteHeader(http.StatusOK)
		return
	}

	log.Printf("🔍 UID trouvé : %s. Enregistrement en base de données...", badgeUID)

	err = upsertUnknownBadge(badgeUID, data.OcppConnectionName)
	if err != nil {
		log.Printf("❌ Erreur lors de l'enregistrement du badge: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Badge %s enregistré avec succès dans UnknownBadges !", badgeUID)
	w.WriteHeader(http.StatusOK)
}

// --- UTILITY FUNCTIONS ---

/**
 * Parses the raw OCPP payload to extract the authorization status based on protocol version (1.6 or 2.1).
 */
func extractStatus(msgRaw interface{}) string {
	var arr []interface{}
	switch v := msgRaw.(type) {
	case string:
		json.Unmarshal([]byte(v), &arr)
	case []interface{}:
		arr = v
	}

	if len(arr) >= 3 {
		if typeID, ok := arr[0].(float64); ok && typeID == 3 {
			if payload, ok := arr[2].(map[string]interface{}); ok {
				if idTokenInfo, ok := payload["idTokenInfo"].(map[string]interface{}); ok {
					if status, ok := idTokenInfo["status"].(string); ok {
						return status
					}
				}
				if idTagInfo, ok := payload["idTagInfo"].(map[string]interface{}); ok {
					if status, ok := idTagInfo["status"].(string); ok {
						return status
					}
				}
			}
		}
	}
	return ""
}

/**
 * Retrieves the original badge UID from Hasura using the provided correlation ID.
 */
func fetchOriginalBadgeUID(correlationID string) (string, error) {
	query := `
		query GetOriginalRequest($corrId: String!) {
			OCPPMessages(where: {correlationId: {_eq: $corrId}, origin: {_eq: "cs"}}, limit: 1) {
				message
			}
		}
	`
	variables := map[string]interface{}{"corrId": correlationID}

	var resp struct {
		Data struct {
			OCPPMessages []struct {
				Message interface{} `json:"message"`
			} `json:"OCPPMessages"`
		} `json:"data"`
	}

	if err := doGraphQLQuery(query, variables, &resp); err != nil {
		return "", err
	}

	if len(resp.Data.OCPPMessages) == 0 {
		return "", nil
	}

	var arr []interface{}
	msgRaw := resp.Data.OCPPMessages[0].Message
	switch v := msgRaw.(type) {
	case string:
		json.Unmarshal([]byte(v), &arr)
	case []interface{}:
		arr = v
	}

	if len(arr) >= 4 {
		if typeID, ok := arr[0].(float64); ok && typeID == 2 {
			if payload, ok := arr[3].(map[string]interface{}); ok {
				if idToken, ok := payload["idToken"].(map[string]interface{}); ok {
					if id, ok := idToken["idToken"].(string); ok {
						return id, nil
					}
				}
				if idTag, ok := payload["idTag"].(string); ok {
					return idTag, nil
				}
			}
		}
	}

	return "", nil
}

/**
 * Inserts a new unknown badge record or increments the attempt counter if it already exists.
 */
func upsertUnknownBadge(idToken string, stationID string) error {
	queryCheck := `
		query CheckBadge($idToken: String!) {
			UnknownBadges_by_pk(id_token: $idToken) {
				attempt_count
			}
		}
	`
	variablesCheck := map[string]interface{}{"idToken": idToken}
	
	var respCheck struct {
		Data struct {
			UnknownBadgesByPk *struct {
				AttemptCount int `json:"attempt_count"`
			} `json:"UnknownBadges_by_pk"`
		} `json:"data"`
	}

	if err := doGraphQLQuery(queryCheck, variablesCheck, &respCheck); err != nil {
		return err
	}

	if respCheck.Data.UnknownBadgesByPk != nil {
		newCount := respCheck.Data.UnknownBadgesByPk.AttemptCount + 1
		mutation := `
			mutation UpdateBadge($idToken: String!, $stationId: String!, $count: Int!) {
				update_UnknownBadges_by_pk(
					pk_columns: {id_token: $idToken}, 
					_set: {station_id: $stationId, attempt_count: $count, last_seen: "now()"}
				) {
					id_token
				}
			}
		`
		variables := map[string]interface{}{"idToken": idToken, "stationId": stationID, "count": newCount}
		return doGraphQLQuery(mutation, variables, nil)
	} else {
		mutation := `
			mutation InsertBadge($idToken: String!, $stationId: String!) {
				insert_UnknownBadges_one(object: {
					id_token: $idToken, 
					station_id: $stationId, 
					attempt_count: 1
				}) {
					id_token
				}
			}
		`
		variables := map[string]interface{}{"idToken": idToken, "stationId": stationID}
		return doGraphQLQuery(mutation, variables, nil)
	}
}

/**
 * Executes a GraphQL query or mutation against the configured Hasura endpoint.
 */
func doGraphQLQuery(query string, variables map[string]interface{}, response interface{}) error {
	payload := map[string]interface{}{
		"query":     query,
		"variables": variables,
	}
	jsonValue, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", HasuraURL, bytes.NewBuffer(jsonValue))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-hasura-admin-secret", HasuraAdminSecret)

	resp, err := (&http.Client{}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if response != nil {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return json.Unmarshal(bodyBytes, response)
	}
	return nil
}