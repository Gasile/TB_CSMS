package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time" // Ajout du package time pour générer le StartSchedule
)

// --- CONFIGURATION ---
const Port = ":8081" // Port différent de l'Idle Service

var (
	// URL interne de l'API CitrineOS injectée par Docker (http://citrine:8080)
	CitrineOSAPIURL   = os.Getenv("CITRINEOS_API_URL")
	HasuraURL         = os.Getenv("HASURA_GRAPHQL_URL")
	HasuraAdminSecret = os.Getenv("HASURA_GRAPHQL_ADMIN_SECRET")
)

// --- STRUCTURES POUR HASURA ---

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
	OcppConnectionName string `json:"ocppConnectionName"` // C'est l'identifiant attendu par CitrineOS (ex: cp004)
	PowerBlockID       *int   `json:"power_block_id"`     // Pointeur pour détecter le NULL (désassignation)
}

// --- STRUCTURES POUR CITRINEOS (OCPP 2.0.1 / 2.1) ---

type SetChargingProfilePayload struct {
	EvseID          int             `json:"evseId"`
	ChargingProfile ChargingProfile `json:"chargingProfile"`
}

type ChargingProfile struct {
	ID                     int                `json:"id"`
	StackLevel             int                `json:"stackLevel"`
	ChargingProfilePurpose string             `json:"chargingProfilePurpose"`
	ChargingProfileKind    string             `json:"chargingProfileKind"`
	ChargingSchedule       []ChargingSchedule `json:"chargingSchedule"`
}

type ChargingSchedule struct {
	ID                     int                      `json:"id"`
	StartSchedule          string                   `json:"startSchedule,omitempty"` // Point de départ absolu
	ChargingRateUnit       string                   `json:"chargingRateUnit"`
	ChargingSchedulePeriod []ChargingSchedulePeriod `json:"chargingSchedulePeriod"`
}

// --- FIX 2: Type personnalisé pour forcer le formatage 0.0 en JSON ---
type JSONFloat float64

func (f JSONFloat) MarshalJSON() ([]byte, error) {
	// Si le nombre n'a pas de décimale (ex: 0), on force l'affichage d'une décimale (.0)
	if float64(f) == float64(int64(f)) {
		return []byte(fmt.Sprintf("%.1f", f)), nil
	}
	return json.Marshal(float64(f))
}

type ChargingSchedulePeriod struct {
	StartPeriod  int       `json:"startPeriod"`
	Limit        JSONFloat `json:"limit"` // Utilisation du type personnalisé
	NumberPhases int       `json:"numberPhases"`
}

type ClearChargingProfilePayload struct {
	ChargingProfileID      int    `json:"chargingProfileId"`
	ChargingProfilePurpose string `json:"chargingProfilePurpose"`
	EvseID                 int    `json:"evseId,omitempty"` // Ajouté pour cibler l'EVSE spécifique lors du nettoyage
}

// --- LOGIQUE METIER & API ---

func handleStationAssignment(w http.ResponseWriter, r *http.Request) {
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
		w.WriteHeader(http.StatusOK) // On ignore silencieusement
		return
	}

	// 1. Récupération des EVSEs liés à cette borne depuis Hasura
	evseIDs, err := fetchEvseIDs(data.ID)
	if err != nil {
		log.Printf("❌ Erreur lors de la récupération des EVSEs: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	if len(evseIDs) == 0 {
		log.Printf("⚠️ Aucun EVSE trouvé pour la borne %s (ID: %d). Assignation ignorée.", data.OcppConnectionName, data.ID)
		w.WriteHeader(http.StatusOK)
		return
	}

	// 2. Boucle sur chaque EVSE pour envoyer la commande individuellement
	var lastErr error
	for _, evseID := range evseIDs {
		if data.PowerBlockID != nil {
			log.Printf("🔗 Assignation : Borne %s (EVSE %d) -> Block %d", data.OcppConnectionName, evseID, *data.PowerBlockID)
			if err := sendSetChargingProfile(data.OcppConnectionName, evseID); err != nil {
				lastErr = err
			}
		} else {
			log.Printf("🔓 Désassignation : Borne %s (EVSE %d) libérée", data.OcppConnectionName, evseID)
			if err := sendClearChargingProfile(data.OcppConnectionName, evseID); err != nil {
				lastErr = err
			}
		}
	}

	// Si au moins un appel a échoué, on renvoie une erreur 500 pour qu'Hasura réessaie
	if lastErr != nil {
		log.Printf("❌ Echec sur au moins un EVSE: %v", lastErr)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// fetchEvseIDs interroge Hasura en GraphQL pour lister les EVSEs d'une borne
func fetchEvseIDs(stationID int) ([]int, error) {
	if HasuraURL == "" || HasuraAdminSecret == "" {
		log.Println("⚠️ Variables Hasura non définies. Utilisation de l'EVSE 1 et 2 par défaut pour le test.")
		return []int{1, 2}, nil // Fallback si pas de config
	}

	// Mise à jour avec les noms exacts fournis : table 'Evses', colonne 'stationId'
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
	req, err := http.NewRequest("POST", HasuraURL, bytes.NewBuffer(jsonValue))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-hasura-admin-secret", HasuraAdminSecret)

	client := &http.Client{}
	resp, err := client.Do(req)
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

func sendSetChargingProfile(identifier string, evseID int) error {
	// --- FIX 1 : ID de profil UNIQUE par EVSE (ex: 101 pour l'EVSE 1, 102 pour l'EVSE 2) ---
	profileID := 100 + evseID

	// Récupération de la date du jour en UTC et forçage de l'heure à minuit (00:00:00)
	now := time.Now().UTC()
	midnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	payload := SetChargingProfilePayload{
		EvseID: evseID,
		ChargingProfile: ChargingProfile{
			ID:                     profileID, // ID unique
			StackLevel:             1,
			ChargingProfilePurpose: "TxDefaultProfile",
			ChargingProfileKind:    "Absolute",
			ChargingSchedule: []ChargingSchedule{
				{
					ID:               profileID, // Doit correspondre
					StartSchedule:    midnight.Format(time.RFC3339),
					ChargingRateUnit: "A",
					ChargingSchedulePeriod: []ChargingSchedulePeriod{
						{
							StartPeriod:  0,
							Limit:        0.0, // Le JSONFloat forcera l'affichage du .0
							NumberPhases: 3,
						},
					},
				},
			},
		},
	}

	url := fmt.Sprintf("%s/ocpp/2.1/smartcharging/setChargingProfile?identifier=%s&tenantId=1", CitrineOSAPIURL, identifier)
	return callCitrineOS(url, payload, "SetChargingProfile (0A)")
}

func sendClearChargingProfile(identifier string, evseID int) error {
	profileID := 100 + evseID // On nettoie l'ID unique correspondant

	payload := ClearChargingProfilePayload{
		ChargingProfileID:      profileID,
		ChargingProfilePurpose: "TxDefaultProfile",
		EvseID:                 evseID, // Optionnel selon la spec, mais plus sûr pour CitrineOS
	}

	url := fmt.Sprintf("%s/ocpp/2.1/smartcharging/clearChargingProfile?identifier=%s&tenantId=1", CitrineOSAPIURL, identifier)
	return callCitrineOS(url, payload, "ClearChargingProfile")
}

func callCitrineOS(url string, body interface{}, action string) error {
	if CitrineOSAPIURL == "" {
		log.Printf("⚠️ MODE TEST : Appel ignoré. CITRINEOS_API_URL manquant.")
		return nil
	}

	jsonValue, _ := json.Marshal(body)

	log.Printf("🌐 DEBUG URL [%s]: %s", action, url)
	log.Printf("🔍 DEBUG JSON envoyé vers CitrineOS [%s]: %s", action, string(jsonValue))

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonValue))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		responseBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("CitrineOS API a répondu %d: %s", resp.StatusCode, string(responseBody))
	}

	log.Printf("✅ Succès : %s envoyé à CitrineOS", action)
	return nil
}

func main() {
	fmt.Println("🚀 Démarrage du service Smart Charging Webhook sur le port", Port)
	if CitrineOSAPIURL == "" {
		fmt.Println("⚠️  ATTENTION: CITRINEOS_API_URL n'est pas défini (Mode Simulation)")
	}
	if HasuraURL == "" {
		fmt.Println("⚠️  ATTENTION: HASURA_GRAPHQL_URL n'est pas défini")
	}

	http.HandleFunc("/webhooks/station-assignment", handleStationAssignment)

	err := http.ListenAndServe(Port, nil)
	if err != nil {
		log.Fatalf("Échec du démarrage: %v", err)
	}
}