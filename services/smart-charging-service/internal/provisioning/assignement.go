package provisioning

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"csms/smart-charging/internal/citrineclient"
)

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
	PowerBlockID       *int   `json:"power_block_id"`
}

// HandleStationAssignment retourne un Handler configuré avec le client API
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
			w.WriteHeader(http.StatusOK)
			return
		}

		evseIDs, err := client.FetchEvseIDs(data.ID)
		if err != nil {
			log.Printf("❌ Erreur GraphQL EVSEs: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		if len(evseIDs) == 0 {
			w.WriteHeader(http.StatusOK)
			return
		}

		var lastErr error
		for _, evseID := range evseIDs {
			if data.PowerBlockID != nil {
				log.Printf("🔗 Assignation : Borne %s (EVSE %d)", data.OcppConnectionName, evseID)
				if err := sendSetChargingProfile(client, data.OcppConnectionName, evseID); err != nil {
					lastErr = err
				}
			} else {
				log.Printf("🔓 Désassignation : Borne %s (EVSE %d)", data.OcppConnectionName, evseID)
				if err := sendClearChargingProfile(client, data.OcppConnectionName, evseID); err != nil {
					lastErr = err
				}
			}
		}

		if lastErr != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
	}
}

func sendSetChargingProfile(client *citrineclient.Client, identifier string, evseID int) error {
	profileID := 100 + evseID
	now := time.Now().UTC()
	midnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	payload := citrineclient.SetChargingProfilePayload{
		EvseID: evseID,
		ChargingProfile: citrineclient.ChargingProfile{
			ID:                     profileID,
			StackLevel:             1,
			ChargingProfilePurpose: "TxDefaultProfile",
			ChargingProfileKind:    "Absolute",
			ChargingSchedule: []citrineclient.ChargingSchedule{
				{
					ID:               profileID,
					StartSchedule:    midnight.Format(time.RFC3339),
					ChargingRateUnit: "A",
					ChargingSchedulePeriod: []citrineclient.ChargingSchedulePeriod{
						{
							StartPeriod:  0,
							Limit:        0.0,
							NumberPhases: 3,
						},
					},
				},
			},
		},
	}

	url := fmt.Sprintf("%s/ocpp/2.1/smartcharging/setChargingProfile?identifier=%s&tenantId=1", client.CitrineURL, identifier)
	return client.CallCitrineOS(url, payload, "SetChargingProfile (0A)")
}

func sendClearChargingProfile(client *citrineclient.Client, identifier string, evseID int) error {
	profileID := 100 + evseID
	payload := citrineclient.ClearChargingProfilePayload{
		ChargingProfileID:      profileID,
		ChargingProfilePurpose: "TxDefaultProfile",
		EvseID:                 evseID,
	}

	url := fmt.Sprintf("%s/ocpp/2.1/smartcharging/clearChargingProfile?identifier=%s&tenantId=1", client.CitrineURL, identifier)
	return client.CallCitrineOS(url, payload, "ClearChargingProfile")
}