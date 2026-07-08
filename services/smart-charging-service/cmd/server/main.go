package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"csms/smart-charging/internal/citrineclient"
	"csms/smart-charging/internal/provisioning"
	"csms/smart-charging/internal/smartcharging"
)

const Port = ":8081"

func main() {
	fmt.Println("🚀 Démarrage du service Smart Charging Webhook sur le port", Port)

	// 1. Initialisation de la configuration
	citrineURL := os.Getenv("CITRINEOS_API_URL")
	hasuraURL := os.Getenv("HASURA_GRAPHQL_URL")
	hasuraSecret := os.Getenv("HASURA_GRAPHQL_ADMIN_SECRET")

	if citrineURL == "" {
		fmt.Println("⚠️  ATTENTION: CITRINEOS_API_URL n'est pas défini (Mode Simulation)")
	}
	if hasuraURL == "" {
		fmt.Println("⚠️  ATTENTION: HASURA_GRAPHQL_URL n'est pas défini")
	}

	// 2. Création du client partagé
	apiClient := citrineclient.NewClient(citrineURL, hasuraURL, hasuraSecret)

	// 3. Enregistrement des routes (Webhooks)
	// Module 1 : L'assignation (Filet de sécurité 0A)
	http.HandleFunc("/webhooks/station-assignment", provisioning.HandleStationAssignment(apiClient))
	
	// Module 2 : L'algorithme (Pour plus tard)
	http.HandleFunc("/webhooks/transactions", smartcharging.HandleTransactions(apiClient))

	// 4. Lancement du serveur
	err := http.ListenAndServe(Port, nil)
	if err != nil {
		log.Fatalf("Échec du démarrage: %v", err)
	}
}