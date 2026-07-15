package citrineclient

// --- IMPORTS ---
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

// --- STRUCTURES ---

type Client struct {
	CitrineURL   string
	HasuraURL    string
	HasuraSecret string
}

type JSONFloat float64

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

type SetChargingProfile16 struct {
	ConnectorID        int                  `json:"connectorId"`
	CSChargingProfiles CSChargingProfiles16 `json:"csChargingProfiles"`
}

type CSChargingProfiles16 struct {
	ChargingProfileID      int                `json:"chargingProfileId"`
	StackLevel             int                `json:"stackLevel"`
	ChargingProfilePurpose string             `json:"chargingProfilePurpose"`
	ChargingProfileKind    string             `json:"chargingProfileKind"`
	TransactionID          *int               `json:"transactionId,omitempty"` 
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

type ChargingSchedulePeriod struct {
	StartPeriod  int       `json:"startPeriod"`
	Limit        JSONFloat `json:"limit"`
	NumberPhases int       `json:"numberPhases"`
}

// --- UTILITY FUNCTIONS ---

/**
 * Initializes and returns a new CitrineOS API client with the required connection details.
 */
func NewClient(citrineURL, hasuraURL, hasuraSecret string) *Client {
	return &Client{
		CitrineURL:   citrineURL,
		HasuraURL:    hasuraURL,
		HasuraSecret: hasuraSecret,
	}
}

/**
 * Custom JSON marshaler to ensure floats output cleanly with one decimal place if they resolve to whole numbers.
 */
func (f JSONFloat) MarshalJSON() ([]byte, error) {
	if float64(f) == float64(int64(f)) {
		return []byte(fmt.Sprintf("%.1f", f)), nil
	}
	return json.Marshal(float64(f))
}

/**
 * Constructs the appropriate SetChargingProfile payload and dispatches it to CitrineOS based on the specified OCPP protocol version.
 */
func (c *Client) SendSetChargingProfile(identifier string, protocol string, evseID int, profileID int, limit float64, purpose string, txID string) error {
	now := time.Now().UTC()
	midnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	
	startSchedule := midnight.Format(time.RFC3339)
	stackLvl := 1
	if purpose == "TxProfile" {
		startSchedule = now.Format(time.RFC3339)
		stackLvl = profileID
	}

	var url string
	var payload interface{}

	// Differentiate routing and payload structure between OCPP 1.6 and 2.1
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

/**
 * Builds and sends a request to clear an active charging profile, adjusting for protocol differences.
 */
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

/**
 * Executes the constructed HTTP POST request to the CitrineOS API and handles error parsing.
 */
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