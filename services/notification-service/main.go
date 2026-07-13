package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)

const Port = ":8084"

// --- VARIABLES D'ENVIRONNEMENT ---
var (
	SmtpHost  = os.Getenv("SMTP_HOST")  // ex: mail.hevs.ch
	SmtpPort  = os.Getenv("SMTP_PORT")  // ex: 25
	MailFrom  = os.Getenv("MAIL_FROM")  // ex: noreply.csms@hevs.ch
	AdminMail = os.Getenv("ADMIN_EMAIL")// ex: prenom.nom@hevs.ch
	
	// NOUVEAU : Variables pour requêter Hasura
	HasuraURL         = os.Getenv("HASURA_GRAPHQL_URL")
	HasuraAdminSecret = os.Getenv("HASURA_GRAPHQL_ADMIN_SECRET")
)

type HasuraWebhookPayload struct {
	Trigger struct {
		Name string `json:"name"`
	} `json:"trigger"`
	Table struct {
		Name string `json:"name"`
	} `json:"table"`
	Event struct {
		Op   string `json:"op"`
		Data struct {
			Old map[string]interface{} `json:"old"`
			New map[string]interface{} `json:"new"`
		} `json:"data"`
	} `json:"event"`
}

func main() {
	fmt.Println("🚀 Démarrage du Notification Service sur le port", Port)

	// Vérification de la configuration SMTP
	if SmtpHost == "" || MailFrom == "" {
		fmt.Println("⚠️  ATTENTION : Configuration SMTP incomplète ! Les emails ne pourront pas être envoyés.")
	} else {
		fmt.Printf("📧 SMTP Configuré : Serveur %s:%s | Expéditeur : %s\n", SmtpHost, SmtpPort, MailFrom)
	}

	// NOUVEAU : Vérification de la configuration Hasura
	if HasuraURL == "" || HasuraAdminSecret == "" {
		fmt.Println("⚠️  ATTENTION : Configuration Hasura incomplète ! Impossible de récupérer les emails des utilisateurs.")
	}

	http.HandleFunc("/webhooks/notify", handleNotification)

	if err := http.ListenAndServe(Port, nil); err != nil {
		log.Fatalf("Échec du démarrage: %v", err)
	}
}

func handleNotification(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload HasuraWebhookPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		log.Printf("❌ Erreur de décodage JSON: %v", err)
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	triggerName := payload.Trigger.Name

	handlerFunc, exists := NotificationRegistry[triggerName]
	if !exists {
		w.WriteHeader(http.StatusOK)
		return
	}

	log.Printf("📩 Traitement de la notification pour le trigger: %s", triggerName)
	err := handlerFunc(payload)
	if err != nil {
		log.Printf("❌ Erreur lors du traitement de %s: %v", triggerName, err)
	}

	w.WriteHeader(http.StatusOK)
}