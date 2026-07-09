package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
)

const Port = ":8085" // Changement du port à 8085 pour fuir la plage de CitrineOS

var (
	HasuraURL         = os.Getenv("HASURA_GRAPHQL_URL")
	HasuraAdminSecret = os.Getenv("HASURA_GRAPHQL_ADMIN_SECRET")
)

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

	// --- 1. FILTRAGE CÔTÉ GO ---
	if data.Action != "Authorize" || data.Origin != "csms" {
		w.WriteHeader(http.StatusOK) 
		return
	}

	// --- 2. EXTRACTION DU STATUT ---
	status := extractStatus(data.Message)
	
	// CORRECTION : On n'enregistre QUE les badges strictement inconnus par CitrineOS
	// OCPP 2.1 utilise souvent "Unknown", OCPP 1.6 peut utiliser "Invalid"
	if status != "Unknown" && status != "Invalid" {
		// Log optionnel pour vérifier que les badges bloqués sont bien ignorés
		if status != "Accepted" && status != "" {
			log.Printf("ℹ️ Badge connu mais refusé (Statut: %s). Ignoré pour la table UnknownBadges.", status)
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	log.Printf("⚠️ Badge strictement inconnu (Statut: %s) sur la borne %s. Recherche de l'UID...", status, data.OcppConnectionName)

	// --- 3. RECHERCHE DU BADGE DANS LE MESSAGE D'ORIGINE ---
	badgeUID, err := fetchOriginalBadgeUID(data.CorrelationID)
	if err != nil || badgeUID == "" {
		log.Printf("❌ Impossible de retrouver l'UID pour le correlationId %s: %v", data.CorrelationID, err)
		w.WriteHeader(http.StatusOK)
		return
	}

	log.Printf("🔍 UID trouvé : %s. Enregistrement en base de données...", badgeUID)

	// --- 4. ENREGISTREMENT EN DB (UPSERT) ---
	err = upsertUnknownBadge(badgeUID, data.OcppConnectionName)
	if err != nil {
		log.Printf("❌ Erreur lors de l'enregistrement du badge: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Badge %s enregistré avec succès dans UnknownBadges !", badgeUID)
	w.WriteHeader(http.StatusOK)
}

// extractStatus fouille dans le tableau JSON pour trouver le statut (Unknown, Accepted, Invalid...)
func extractStatus(msgRaw interface{}) string {
	var arr []interface{}
	switch v := msgRaw.(type) {
	case string:
		json.Unmarshal([]byte(v), &arr)
	case []interface{}:
		arr = v
	}

	if len(arr) >= 3 {
		// Vérifier que c'est bien une réponse (CallResult = 3)
		if typeID, ok := arr[0].(float64); ok && typeID == 3 {
			if payload, ok := arr[2].(map[string]interface{}); ok {
				// Format OCPP 2.1
				if idTokenInfo, ok := payload["idTokenInfo"].(map[string]interface{}); ok {
					if status, ok := idTokenInfo["status"].(string); ok {
						return status
					}
				}
				// Format OCPP 1.6
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

// fetchOriginalBadgeUID interroge Hasura pour retrouver la question posée par la borne (origin = 'cs')
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
		return "", nil // Pas de message trouvé
	}

	// Parsing du message d'origine
	var arr []interface{}
	msgRaw := resp.Data.OCPPMessages[0].Message
	switch v := msgRaw.(type) {
	case string:
		json.Unmarshal([]byte(v), &arr)
	case []interface{}:
		arr = v
	}

	if len(arr) >= 4 {
		// Vérifier que c'est bien une requête (Call = 2)
		if typeID, ok := arr[0].(float64); ok && typeID == 2 {
			if payload, ok := arr[3].(map[string]interface{}); ok {
				// Format OCPP 2.1
				if idToken, ok := payload["idToken"].(map[string]interface{}); ok {
					if id, ok := idToken["idToken"].(string); ok {
						return id, nil
					}
				}
				// Format OCPP 1.6
				if idTag, ok := payload["idTag"].(string); ok {
					return idTag, nil
				}
			}
		}
	}

	return "", nil
}

// upsertUnknownBadge ajoute ou met à jour le badge dans la DB
func upsertUnknownBadge(idToken string, stationID string) error {
	// 1. On regarde s'il existe déjà
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

	// 2. Si oui, on Update. Si non, on Insert.
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