package citrineclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"
)

type Client struct {
	CitrineURL   string
	HasuraURL    string
	HasuraSecret string
}

func NewClient(citrineURL, hasuraURL, hasuraSecret string) *Client {
	return &Client{
		CitrineURL:   citrineURL,
		HasuraURL:    hasuraURL,
		HasuraSecret: hasuraSecret,
	}
}

type JSONFloat float64

func (f JSONFloat) MarshalJSON() ([]byte, error) {
	if float64(f) == float64(int64(f)) {
		return []byte(fmt.Sprintf("%.1f", f)), nil
	}
	return json.Marshal(float64(f))
}

// ==========================================
// STRUCTURES OCPP 2.1
// ==========================================
type SetChargingProfile21 struct {
	EvseID          int               `json:"evseId"`
	ChargingProfile ChargingProfile21 `json:"chargingProfile"`
}

type ChargingProfile21 struct {
	ID                     int                  `json:"id"`
	StackLevel             int                  `json:"stackLevel"`
	ChargingProfilePurpose string               `json:"chargingProfilePurpose"`
	ChargingProfileKind    string               `json:"chargingProfileKind"`
	TransactionId          string               `json:"transactionId,omitempty"`
	ChargingSchedule       []ChargingSchedule21 `json:"chargingSchedule"`
}

type ChargingSchedule21 struct {
	ID                     int                      `json:"id"`
	StartSchedule          string                   `json:"startSchedule,omitempty"`
	ChargingRateUnit       string                   `json:"chargingRateUnit"`
	ChargingSchedulePeriod []ChargingSchedulePeriod `json:"chargingSchedulePeriod"`
}

type ClearChargingProfile21 struct {
	ChargingProfileID      int    `json:"chargingProfileId"`
	ChargingProfilePurpose string `json:"chargingProfilePurpose"`
	EvseID                 int    `json:"evseId,omitempty"`
}

// ==========================================
// STRUCTURES OCPP 1.6
// ==========================================
type SetChargingProfile16 struct {
	ConnectorID        int                  `json:"connectorId"`
	CSChargingProfiles CSChargingProfiles16 `json:"csChargingProfiles"`
}

type CSChargingProfiles16 struct {
	ChargingProfileID      int                `json:"chargingProfileId"`
	StackLevel             int                `json:"stackLevel"`
	ChargingProfilePurpose string             `json:"chargingProfilePurpose"`
	ChargingProfileKind    string             `json:"chargingProfileKind"`
	TransactionID          *int               `json:"transactionId,omitempty"` // Doit être un int en 1.6
	ChargingSchedule       ChargingSchedule16 `json:"chargingSchedule"`
}

type ChargingSchedule16 struct {
	StartSchedule          string                   `json:"startSchedule,omitempty"`
	ChargingRateUnit       string                   `json:"chargingRateUnit"`
	ChargingSchedulePeriod []ChargingSchedulePeriod `json:"chargingSchedulePeriod"`
}

type ClearChargingProfile16 struct {
	ID                     int    `json:"id"`
	ConnectorID            int    `json:"connectorId"`
	ChargingProfilePurpose string `json:"chargingProfilePurpose"`
}

// ==========================================
// STRUCTURES COMMUNES
// ==========================================
type ChargingSchedulePeriod struct {
	StartPeriod  int       `json:"startPeriod"`
	Limit        JSONFloat `json:"limit"`
	NumberPhases int       `json:"numberPhases"`
}

// ==========================================
// METHODES INTELLIGENTES D'ENVOI
// ==========================================

// SendSetChargingProfile construit le bon JSON et choisit la bonne URL selon le protocole
func (c *Client) SendSetChargingProfile(identifier string, protocol string, evseID int, profileID int, limit float64, purpose string, txID string) error {
	now := time.Now().UTC()
	midnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	
	startSchedule := midnight.Format(time.RFC3339)
	stackLvl := 1
	if purpose == "TxProfile" {
		startSchedule = now.Format(time.RFC3339)
		stackLvl = profileID // Plus le niveau est haut, plus il est prioritaire
	}

	var url string
	var payload interface{}

	if protocol == "ocpp1.6" {
		url = fmt.Sprintf("%s/ocpp/1.6/smartcharging/setChargingProfile?identifier=%s&tenantId=1", c.CitrineURL, identifier)
		
		var txIDInt *int
		if txID != "" {
			if val, err := strconv.Atoi(txID); err == nil {
				txIDInt = &val
			}
		}

		payload = SetChargingProfile16{
			ConnectorID: evseID,
			CSChargingProfiles: CSChargingProfiles16{
				ChargingProfileID:      profileID,
				StackLevel:             stackLvl,
				ChargingProfilePurpose: purpose,
				ChargingProfileKind:    "Absolute",
				TransactionID:          txIDInt,
				ChargingSchedule: ChargingSchedule16{
					StartSchedule:    startSchedule,
					ChargingRateUnit: "A",
					ChargingSchedulePeriod: []ChargingSchedulePeriod{
						{StartPeriod: 0, Limit: JSONFloat(limit), NumberPhases: 3},
					},
				},
			},
		}
	} else {
		// Par défaut : OCPP 2.1
		url = fmt.Sprintf("%s/ocpp/2.1/smartcharging/setChargingProfile?identifier=%s&tenantId=1", c.CitrineURL, identifier)
		
		payload = SetChargingProfile21{
			EvseID: evseID,
			ChargingProfile: ChargingProfile21{
				ID:                     profileID,
				StackLevel:             stackLvl,
				ChargingProfilePurpose: purpose,
				ChargingProfileKind:    "Absolute",
				TransactionId:          txID,
				ChargingSchedule: []ChargingSchedule21{
					{
						ID:               profileID,
						StartSchedule:    startSchedule,
						ChargingRateUnit: "A",
						ChargingSchedulePeriod: []ChargingSchedulePeriod{
							{StartPeriod: 0, Limit: JSONFloat(limit), NumberPhases: 3},
						},
					},
				},
			},
		}
	}

	return c.CallCitrineOS(url, payload, fmt.Sprintf("Set %s (%.1fA)", purpose, limit))
}

// SendClearChargingProfile efface le profil avec le bon format
func (c *Client) SendClearChargingProfile(identifier string, protocol string, evseID int, profileID int, purpose string) error {
	var url string
	var payload interface{}

	if protocol == "ocpp1.6" {
		url = fmt.Sprintf("%s/ocpp/1.6/smartcharging/clearChargingProfile?identifier=%s&tenantId=1", c.CitrineURL, identifier)
		payload = ClearChargingProfile16{
			ID:                     profileID,
			ConnectorID:            evseID,
			ChargingProfilePurpose: purpose,
		}
	} else {
		url = fmt.Sprintf("%s/ocpp/2.1/smartcharging/clearChargingProfile?identifier=%s&tenantId=1", c.CitrineURL, identifier)
		payload = ClearChargingProfile21{
			ChargingProfileID:      profileID,
			EvseID:                 evseID,
			ChargingProfilePurpose: purpose,
		}
	}

	return c.CallCitrineOS(url, payload, fmt.Sprintf("Clear %s", purpose))
}

func (c *Client) CallCitrineOS(url string, body interface{}, action string) error {
	if c.CitrineURL == "" {
		return nil
	}

	jsonValue, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonValue))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		responseBody, _ := io.ReadAll(resp.Body)
		log.Printf("❌ ERREUR HTTP %d sur l'action [%s]", resp.StatusCode, action)
		log.Printf("🌐 DEBUG URL : %s", url)
		log.Printf("🔍 DEBUG JSON: %s", string(jsonValue))
		return fmt.Errorf("CitrineOS API a répondu %d: %s", resp.StatusCode, string(responseBody))
	}

	return nil
}