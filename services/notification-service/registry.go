package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"net/smtp"
	"text/template" // ⚠️ CORRECTION : Remplace html/template pour éviter les guillemets &#39;
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

		userEmail, wantsNotifs := fetchUserPrefs(transactionId)
		if userEmail == "" {
			log.Printf("⚠️ Impossible de trouver l'email pour la transaction %s.", transactionId)
			return nil
		}

		if !wantsNotifs {
			log.Printf("ℹ️ Utilisateur %s désactivé pour les notifications (user_notifications=false).", userEmail)
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
	
	userEmail, wantsNotifs := fetchUserPrefs(transactionId)
	if userEmail == "" || !wantsNotifs {
		return nil // Pas d'email ou notifications désactivées
	}

	// CAS 1: Coupure (Passe à 0.0)
	if okNew && newLimit == 0.0 && (!okOld || oldLimit > 0.0) {
		return renderAndSendEmail("templates/wait_energy.txt", "Mise en attente de votre session de charge", userEmail, nil)
	}

	// CAS 2: Reprise (Passe au-dessus de 0.0)
	if okNew && newLimit > 0.0 && okOld && oldLimit == 0.0 {
		return renderAndSendEmail("templates/resume_charge.txt", "Reprise de votre session de charge", userEmail, nil)
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

	admins := fetchAdmins()
	if len(admins) == 0 {
		// Fallback sur le .env si aucun admin n'est trouvé
		if AdminMail != "" {
			return renderAndSendEmail("templates/unknown_badge.txt", "[ADMIN] Badge RFID inconnu détecté", AdminMail, data)
		}
		log.Printf("⚠️ Aucun administrateur trouvé pour recevoir l'alerte badge.")
		return nil
	}

	for _, adminEmail := range admins {
		_ = renderAndSendEmail("templates/unknown_badge.txt", "[ADMIN] Badge RFID inconnu détecté", adminEmail, data)
	}
	return nil
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
		
		admins := fetchAdmins()
		if len(admins) == 0 && AdminMail != "" {
			return renderAndSendEmail("templates/connector_error.txt", "[ADMIN] Erreur matérielle détectée", AdminMail, data)
		}

		for _, adminEmail := range admins {
			_ = renderAndSendEmail("templates/connector_error.txt", "[ADMIN] Erreur matérielle détectée", adminEmail, data)
		}
	}
	return nil
}

// =========================================================================
// REQUETES HASURA
// =========================================================================

func fetchUserPrefs(transactionId string) (email string, wantsNotifs bool) {
	if HasuraURL == "" || HasuraAdminSecret == "" {
		return "", false
	}

	query := `
		query GetUserPrefs($txId: String!) {
			Transactions(where: {transactionId: {_eq: $txId}}) {
				User {
					email
					user_notifications
				}
			}
		}
	`
	variables := map[string]interface{}{"txId": transactionId}

	var resp struct {
		Data struct {
			Transactions []struct {
				User *struct {
					Email             string `json:"email"`
					UserNotifications bool   `json:"user_notifications"`
				} `json:"User"`
			} `json:"Transactions"`
		} `json:"data"`
	}

	if err := executeGraphQL(query, variables, &resp); err != nil {
		return "", false
	}

	if len(resp.Data.Transactions) > 0 && resp.Data.Transactions[0].User != nil {
		usr := resp.Data.Transactions[0].User
		return usr.Email, usr.UserNotifications
	}
	return "", false
}

func fetchAdmins() []string {
	if HasuraURL == "" || HasuraAdminSecret == "" {
		return nil
	}

	// On utilise _ilike pour ignorer la casse (admin ou Admin)
	query := `
		query GetAdmins {
			Users(where: {role: {_ilike: "admin"}, admin_notifications: {_eq: true}}) {
				email
			}
		}
	`
	var resp struct {
		Data struct {
			Users []struct {
				Email string `json:"email"`
			} `json:"Users"`
		} `json:"data"`
	}

	if err := executeGraphQL(query, nil, &resp); err != nil {
		return nil
	}

	var emails []string
	for _, u := range resp.Data.Users {
		if u.Email != "" {
			emails = append(emails, u.Email)
		}
	}
	return emails
}

func executeGraphQL(query string, variables map[string]interface{}, response interface{}) error {
	payload := map[string]interface{}{"query": query, "variables": variables}
	jsonValue, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", HasuraURL, bytes.NewBuffer(jsonValue))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-hasura-admin-secret", HasuraAdminSecret)

	client := &http.Client{Timeout: 5 * time.Second}
	httpResp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer httpResp.Body.Close()

	bodyBytes, _ := io.ReadAll(httpResp.Body)
	return json.Unmarshal(bodyBytes, response)
}

// =========================================================================
// MOTEUR D'ENVOI SMTP
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
	log.Printf("📤 [1/5] Tentative TCP (IPv4) vers %s pour %s...", addr, toEmail)

	conn, err := net.DialTimeout("tcp4", addr, 10*time.Second)
	if err != nil {
		return fmt.Errorf("échec de connexion TCP : %v", err)
	}
	defer conn.Close()
	
	conn.SetDeadline(time.Now().Add(30 * time.Second))

	client, err := smtp.NewClient(conn, SmtpHost)
	if err != nil {
		return fmt.Errorf("échec SMTP 220 : %v", err)
	}
	defer client.Close()

	if err := client.Hello("csms.hevs.ch"); err != nil {
		log.Printf("⚠️ Avertissement HELO SMTP: %v", err)
	}

	if err := client.Mail(MailFrom); err != nil {
		return fmt.Errorf("refus expéditeur: %v", err)
	}
	if err := client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("refus destinataire: %v", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("erreur DATA: %v", err)
	}
	if _, err = w.Write(finalMessage); err != nil {
		return fmt.Errorf("erreur écriture: %v", err)
	}
	if err = w.Close(); err != nil {
		return fmt.Errorf("erreur clôture: %v", err)
	}

	client.Quit()
	log.Printf("✅ Email '%s' envoyé avec succès à %s !", subject, toEmail)
	return nil
}