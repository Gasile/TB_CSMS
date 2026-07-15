package main

// --- IMPORTS ---
import (
	"fmt"
	"log"
	"net/http"
	"os"

	"csms/smart-charging/internal/citrineclient"
	"csms/smart-charging/internal/provisioning"
	"csms/smart-charging/internal/smartcharging"
)

// --- GLOBAL VARIABLES ---
const Port = ":8081"

// --- HANDLERS & MAIN ---

/**
 * Initializes configuration, establishes the API client, registers webhook routes, and starts the web server.
 */
func main() {
	fmt.Println("🚀 Démarrage du service Smart Charging Webhook sur le port", Port)

	citrineURL := os.Getenv("CITRINEOS_API_URL")
	hasuraURL := os.Getenv("HASURA_GRAPHQL_URL")
	hasuraSecret := os.Getenv("HASURA_GRAPHQL_ADMIN_SECRET")

	if citrineURL == "" {
		fmt.Println("⚠️  ATTENTION: CITRINEOS_API_URL n'est pas défini (Mode Simulation)")
	}
	if hasuraURL == "" {
		fmt.Println("⚠️  ATTENTION: HASURA_GRAPHQL_URL n'est pas défini")
	}

	apiClient := citrineclient.NewClient(citrineURL, hasuraURL, hasuraSecret)

	http.HandleFunc("/webhooks/station-assignment", provisioning.HandleStationAssignment(apiClient))
	
	http.HandleFunc("/webhooks/transactions", smartcharging.HandleTransactions(apiClient))

	err := http.ListenAndServe(Port, nil)
	if err != nil {
		log.Fatalf("Échec du démarrage: %v", err)
	}
}