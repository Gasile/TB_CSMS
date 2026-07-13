package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"net/smtp"
	"time"
)

type NotificationHandler func(payload HasuraWebhookPayload) error

var NotificationRegistry = map[string]NotificationHandler{
	"notify_idle_transaction": handleIdleTransaction,
	"notify_wait_for_energy":  handleWaitForEnergy,
	"notify_unknown_badge":    handleUnknownBadge,
	"notify_connector_error":  handleConnectorError,
}

// =========================================================================
// HANDLERS SPECIFIQUES A CHAQUE TRIGGER
// =========================================================================

func handleIdleTransaction(payload HasuraWebhookPayload) error {
	newRow := payload.Event.Data.New
	oldRow := payload.Event.Data.Old

	newIsLegal, okNew := newRow["is_legal"].(bool)
	oldIsLegal, okOld := oldRow["is_legal"].(bool)

	if okNew && okOld && oldIsLegal == true && newIsLegal == false {
		transactionId, _ := newRow["transactionId"].(string)
		stationName, _ := newRow["stationId"].(string)

		// NOUVEAU : On récupère dynamiquement l'email depuis Hasura
		userEmail := fetchUserEmail(transactionId)
		if userEmail == "" {
			log.Printf("⚠️ Impossible de trouver l'email pour la transaction %s. Notification ignorée.", transactionId)
			return nil
		}

		data := map[string]string{
			"StationName": stationName,
			"UserEmail":   userEmail,
		}

		subject := "Alerte de fin de charge - Déplacez votre véhicule"
		return renderAndSendEmail("templates/idle_alert.txt", subject, userEmail, data)
	}
	return nil
}

func handleWaitForEnergy(payload HasuraWebhookPayload) error {
	newRow := payload.Event.Data.New
	oldRow := payload.Event.Data.Old
	
	newLimit, okNew := newRow["allocated_limit"].(float64)
	oldLimit, okOld := oldRow["allocated_limit"].(float64)

	transactionId, _ := newRow["transactionId"].(string)
	
	// NOUVEAU : On récupère dynamiquement l'email
	userEmail := fetchUserEmail(transactionId)
	if userEmail == "" {
		return nil // Pas d'email = pas de notification
	}

	if okNew && newLimit == 0.0 && (!okOld || oldLimit > 0.0) {
		data := map[string]string{
			"Message": "Votre véhicule est branché, mais en attente d'énergie disponible sur le parking.",
		}
		return renderAndSendEmail("templates/wait_energy.txt", "Mise en attente de votre session de charge", userEmail, data)
	}

	if okNew && newLimit > 0.0 && okOld && oldLimit == 0.0 {
		data := map[string]string{
			"Message": "Bonne nouvelle ! De l'énergie est à nouveau disponible. Le système a repris la charge de votre véhicule.",
		}
		return renderAndSendEmail("templates/wait_energy.txt", "Reprise de votre session de charge", userEmail, data)
	}

	return nil
}

func handleUnknownBadge(payload HasuraWebhookPayload) error {
	newRow := payload.Event.Data.New
	idToken, _ := newRow["id_token"].(string)
	stationId, _ := newRow["station_id"].(string)

	data := map[string]string{
		"Token":   idToken,
		"Station": stationId,
	}

	// On envoie à l'admin
	return renderAndSendEmail("templates/unknown_badge.txt", "[ADMIN] Badge RFID inconnu détecté", AdminMail, data)
}

func handleConnectorError(payload HasuraWebhookPayload) error {
	newRow := payload.Event.Data.New
	oldRow := payload.Event.Data.Old

	newErr, _ := newRow["errorCode"].(string)
	oldErr, _ := oldRow["errorCode"].(string)

	if newErr != "NoError" && newErr != "" && newErr != oldErr {
		data := map[string]string{
			"ErrorCode": newErr,
		}
		return renderAndSendEmail("templates/connector_error.txt", "[ADMIN] Erreur matérielle détectée", AdminMail, data)
	}
	return nil
}

// =========================================================================
// REQUETES HASURA
// =========================================================================

func fetchUserEmail(transactionId string) string {
	if HasuraURL == "" || HasuraAdminSecret == "" {
		return ""
	}

	// ⚠️ ATTENTION SUR CETTE REQUETE : 
	// On suppose ici que la table "Transactions" possède une relation (Relationship) nommée "User" 
	// qui pointe vers ta table des utilisateurs (et donc la colonne "email").
	// Si le nom de ta relation est différent dans Hasura (ex: "utilisateur", "Account", etc.),
	// tu devras modifier le nom "User" ci-dessous.
	query := `
		query GetUserEmail($txId: String!) {
			Transactions(where: {transactionId: {_eq: $txId}}) {
				User {
					email
				}
			}
		}
	`
	variables := map[string]interface{}{"txId": transactionId}

	var resp struct {
		Data struct {
			Transactions []struct {
				User *struct {
					Email string `json:"email"`
				} `json:"User"`
			} `json:"Transactions"`
		} `json:"data"`
	}

	payload := map[string]interface{}{
		"query":     query,
		"variables": variables,
	}
	jsonValue, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", HasuraURL, bytes.NewBuffer(jsonValue))
	if err != nil {
		return ""
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-hasura-admin-secret", HasuraAdminSecret)

	client := &http.Client{}
	httpResp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer httpResp.Body.Close()

	bodyBytes, _ := io.ReadAll(httpResp.Body)
	json.Unmarshal(bodyBytes, &resp)

	// Extraction de l'email si la relation User existe et a bien retourné une donnée
	if len(resp.Data.Transactions) > 0 && resp.Data.Transactions[0].User != nil {
		return resp.Data.Transactions[0].User.Email
	}

	return ""
}

// =========================================================================
// MOTEUR D'ENVOI SMTP (Mise à jour : Connexion manuelle robuste avec Timeouts)
// =========================================================================

func renderAndSendEmail(templatePath string, subject string, toEmail string, data interface{}) error {
	if SmtpHost == "" || MailFrom == "" || toEmail == "" {
		log.Printf("⚠️  Envoi ignoré pour %s (Config SMTP ou destinataire manquant)", toEmail)
		return nil
	}

	tmpl, err := template.ParseFiles(templatePath)
	if err != nil {
		return fmt.Errorf("erreur template: %v", err)
	}

	var bodyBuffer bytes.Buffer
	if err := tmpl.Execute(&bodyBuffer, data); err != nil {
		return fmt.Errorf("erreur exécution template: %v", err)
	}

	encodedSubject := mime.BEncoding.Encode("UTF-8", subject)

	headers := "From: CSMS HES-SO <" + MailFrom + ">\r\n" +
		"To: " + toEmail + "\r\n" +
		"Subject: " + encodedSubject + "\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n" +
		"\r\n"

	finalMessage := append([]byte(headers), bodyBuffer.Bytes()...)

	addr := fmt.Sprintf("%s:%s", SmtpHost, SmtpPort)
	log.Printf("📤 [1/5] Tentative TCP (IPv4) vers %s...", addr)

	// 1. Connexion TCP avec Timeout (10 secondes max) et forçage IPv4
	conn, err := net.DialTimeout("tcp4", addr, 10*time.Second)
	if err != nil {
		return fmt.Errorf("échec de connexion TCP (Port bloqué ou DNS inaccessible) : %v", err)
	}
	defer conn.Close()
	
	// On impose une limite de temps stricte (30s) pour TOUTE la conversation SMTP
	conn.SetDeadline(time.Now().Add(30 * time.Second))

	log.Printf("⏳ [2/5] TCP OK. Attente du message de bienvenue SMTP (220)...")
	client, err := smtp.NewClient(conn, SmtpHost)
	if err != nil {
		return fmt.Errorf("échec de la création du client SMTP (pas de réponse 220) : %v", err)
	}
	defer client.Close()

	log.Printf("🗣️ [3/5] Bienvenue SMTP reçue. Envoi de HELO/EHLO...")
	if err := client.Hello("csms.hevs.ch"); err != nil {
		log.Printf("⚠️ Avertissement HELO SMTP: %v", err)
	}

	log.Printf("✉️ [4/5] Configuration des expéditeurs et destinataires...")
	if err := client.Mail(MailFrom); err != nil {
		return fmt.Errorf("refus de l'expéditeur (MAIL FROM): %v", err)
	}
	if err := client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("refus du destinataire (RCPT TO): %v", err)
	}

	log.Printf("📦 [5/5] Envoi du corps du message...")
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("erreur lors de l'ouverture du flux DATA: %v", err)
	}
	if _, err = w.Write(finalMessage); err != nil {
		return fmt.Errorf("erreur lors de l'envoi du contenu: %v", err)
	}
	if err = w.Close(); err != nil {
		return fmt.Errorf("erreur lors de la clôture du flux DATA: %v", err)
	}

	client.Quit()
	log.Printf("✅ Email '%s' envoyé avec succès à %s !", subject, toEmail)
	return nil
}