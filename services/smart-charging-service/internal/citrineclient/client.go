package citrineclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
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

type SetChargingProfilePayload struct {
	EvseID          int             `json:"evseId"`
	ChargingProfile ChargingProfile `json:"chargingProfile"`
}

type ChargingProfile struct {
	ID                     int                `json:"id"`
	StackLevel             int                `json:"stackLevel"`
	ChargingProfilePurpose string             `json:"chargingProfilePurpose"`
	ChargingProfileKind    string             `json:"chargingProfileKind"`
	TransactionId          string             `json:"transactionId,omitempty"`
	ChargingSchedule       []ChargingSchedule `json:"chargingSchedule"`
}

type ChargingSchedule struct {
	ID                     int                      `json:"id"`
	StartSchedule          string                   `json:"startSchedule,omitempty"`
	ChargingRateUnit       string                   `json:"chargingRateUnit"`
	ChargingSchedulePeriod []ChargingSchedulePeriod `json:"chargingSchedulePeriod"`
}

type ChargingSchedulePeriod struct {
	StartPeriod  int       `json:"startPeriod"`
	Limit        JSONFloat `json:"limit"`
	NumberPhases int       `json:"numberPhases"`
}

type ClearChargingProfilePayload struct {
	ChargingProfileID      int    `json:"chargingProfileId"`
	ChargingProfilePurpose string `json:"chargingProfilePurpose"`
	EvseID                 int    `json:"evseId,omitempty"`
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
		// On n'affiche ces logs de DEBUG détaillés QUE s'il y a un problème
		log.Printf("❌ ERREUR HTTP %d sur l'action [%s]", resp.StatusCode, action)
		log.Printf("🌐 DEBUG URL : %s", url)
		log.Printf("🔍 DEBUG JSON: %s", string(jsonValue))
		return fmt.Errorf("CitrineOS API a répondu %d: %s", resp.StatusCode, string(responseBody))
	}

	// Plus de log.Printf("✅ Succès") ici, c'est le moteur (engine.go) qui s'en chargera plus proprement.
	return nil
}

func (c *Client) FetchEvseIDs(stationID int) ([]int, error) {
	if c.HasuraURL == "" || c.HasuraSecret == "" {
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
		"query": query,
		"variables": map[string]interface{}{
			"stationId": stationID,
		},
	}

	jsonValue, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", c.HasuraURL, bytes.NewBuffer(jsonValue))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-hasura-admin-secret", c.HasuraSecret)

	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
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
		return nil, fmt.Errorf("erreur Hasura: %v", graphQLResp.Errors)
	}

	var evseIDs []int
	for _, evse := range graphQLResp.Data.Evses {
		evseIDs = append(evseIDs, evse.EvseTypeID)
	}

	return evseIDs, nil
}