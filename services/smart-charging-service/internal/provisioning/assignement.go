package provisioning

// --- IMPORTS ---
import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"csms/smart-charging/internal/citrineclient"
)

// --- STRUCTURES ---

type HasuraEventPayload struct {
	Event struct {
		Op   string `json:"op"`
		Data struct {
			New StationAssignment `json:"new"`
		} `json:"data"`
	} `json:"event"`
}

type StationAssignment struct {
	ID                 int    `json:"id"`
	OcppConnectionName string `json:"ocppConnectionName"`
	Protocol           string `json:"protocol"` 
	PowerBlockID       *int   `json:"power_block_id"`
	IsOnline           bool   `json:"isOnline"`
}

// --- HANDLERS ---

/**
 * Handles incoming webhooks for station assignments, applying a default 0A limit when assigned, or clearing profiles when unassigned.
 */
func HandleStationAssignment(client *citrineclient.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		var payload HasuraEventPayload
		err := json.NewDecoder(r.Body).Decode(&payload)
		if err != nil {
			log.Printf("❌ Erreur de décodage JSON: %v", err)
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		data := payload.Event.Data.New

		if data.OcppConnectionName == "" {
			log.Printf("❌ Payload invalide : ocppConnectionName manquant.")
			w.WriteHeader(http.StatusOK)
			return
		}

		evseIDs, err := fetchEvseIDs(client, data.ID)
		if err != nil {
			log.Printf("❌ Erreur lors de la récupération des EVSEs: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		if len(evseIDs) == 0 {
			log.Printf("⚠️ Aucun EVSE trouvé pour la borne %s. Assignation ignorée.", data.OcppConnectionName)
			w.WriteHeader(http.StatusOK)
			return
		}

		// If the station is offline, skip the CitrineOS REST call and rely on the reconciliation trigger later
		if !data.IsOnline {
			log.Printf("⚠️ Station %s is offline. Skipping CitrineOS call; profile will be applied upon reconnection.", data.OcppConnectionName)
			w.WriteHeader(http.StatusOK)
			return
		}

		var lastErr error
		
		// Apply safety limits or clear configurations for every connector on the assigned station
		for _, evseID := range evseIDs {
			profileID := 100 + evseID
			if data.PowerBlockID != nil {
				log.Printf("🔗 Assignation : Borne %s [%s] (EVSE %d) -> Block %d", data.OcppConnectionName, data.Protocol, evseID, *data.PowerBlockID)
				
				if err := client.SendSetChargingProfile(data.OcppConnectionName, data.Protocol, evseID, profileID, 0.0, "TxDefaultProfile", ""); err != nil {
					lastErr = err
				}
			} else {
				log.Printf("🔓 Désassignation : Borne %s [%s] (EVSE %d) libérée", data.OcppConnectionName, data.Protocol, evseID)
				
				if err := client.SendClearChargingProfile(data.OcppConnectionName, data.Protocol, evseID, profileID, "TxDefaultProfile"); err != nil {
					lastErr = err
				}
			}
		}

		if lastErr != nil {
			log.Printf("⚠️ Impossible de joindre la borne %s (EVSEs) via CitrineOS: %v", data.OcppConnectionName, lastErr)
			log.Printf("ℹ️ L'intention d'assignation est enregistrée en DB. Elle sera appliquée automatiquement à la reconnexion via le trigger.")
			
			w.WriteHeader(http.StatusOK)
			return
		}

		log.Printf("✅ Profil de charge appliqué avec succès à la borne %s", data.OcppConnectionName)
		w.WriteHeader(http.StatusOK)
	}
}

// --- UTILITY FUNCTIONS ---

/**
 * Fetches the list of EVSE type IDs belonging to a specific station from the Hasura GraphQL API.
 */
func fetchEvseIDs(client *citrineclient.Client, stationID int) ([]int, error) {
	if client.HasuraURL == "" || client.HasuraSecret == "" {
		return []int{1, 2}, nil
	}

	query := `
		query GetEvses($stationId: Int!) {
			Evses(where: {stationId: {_eq: $stationId}}) {
				evseTypeId
			}
		}
	`
	payload := map[string]interface{}{
		"query":     query,
		"variables": map[string]interface{}{"stationId": stationID},
	}

	jsonValue, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", client.HasuraURL, bytes.NewBuffer(jsonValue))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-hasura-admin-secret", client.HasuraSecret)

	resp, err := (&http.Client{}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	var graphQLResp struct {
		Data struct {
			Evses []struct {
				EvseTypeID int `json:"evseTypeId"`
			} `json:"Evses"`
		} `json:"data"`
		Errors []interface{} `json:"errors"`
	}

	if err := json.Unmarshal(bodyBytes, &graphQLResp); err != nil {
		return nil, fmt.Errorf("erreur décodage GraphQL: %v", err)
	}
	if len(graphQLResp.Errors) > 0 {
		return nil, fmt.Errorf("erreur GraphQL Hasura: %v", graphQLResp.Errors)
	}

	var evseIDs []int
	for _, evse := range graphQLResp.Data.Evses {
		evseIDs = append(evseIDs, evse.EvseTypeID)
	}

	return evseIDs, nil
}