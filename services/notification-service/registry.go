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
    "text/template"
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
// HANDLERS SPECIFIC TO EACH TRIGGER
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
            log.Printf("⚠️ Unable to find the email for transaction %s.", transactionId)
            return nil
        }

        if !wantsNotifs {
            log.Printf("ℹ️ User %s has notifications disabled (user_notifications=false).", userEmail)
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
        return nil // No email or notifications disabled
    }

    // CASE 1: Cutoff (Drops to 0.0)
    if okNew && newLimit == 0.0 && (!okOld || oldLimit > 0.0) {
        return renderAndSendEmail("templates/wait_energy.txt", "Mise en attente de votre session de charge", userEmail, nil)
    }

    // CASE 2: Resumption (Rises above 0.0)
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
        // Fallback to .env if no admin is found
        if AdminMail != "" {
            return renderAndSendEmail("templates/unknown_badge.txt", "[ADMIN] Badge RFID inconnu détecté", AdminMail, data)
        }
        log.Printf("⚠️ No administrator found to receive the badge alert.")
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
// HASURA QUERIES
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

    // Using _ilike to ignore case (admin or Admin)
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
// SMTP SENDING ENGINE
// =========================================================================

const (
    AlwaysBCCAdmin = true // 🟢 Set to false to disable BCC (Blind Carbon Copy)
    BCCAdminEmail  = "basile.gasser@hes-so.ch"
)

func renderAndSendEmail(templatePath string, subject string, toEmail string, data interface{}) error {
    if SmtpHost == "" || MailFrom == "" || toEmail == "" {
        log.Printf("⚠️ Sending skipped for %s (Missing SMTP config or recipient)", toEmail)
        return nil
    }

    tmpl, err := template.ParseFiles(templatePath)
    if err != nil {
        return fmt.Errorf("template error: %v", err)
    }

    var bodyBuffer bytes.Buffer
    if err := tmpl.Execute(&bodyBuffer, data); err != nil {
        return fmt.Errorf("template execution error: %v", err)
    }

    encodedSubject := mime.BEncoding.Encode("UTF-8", subject)

    // Building headers - WITHOUT the Cc field to create a BCC
    headers := "From: CSMS HES-SO <" + MailFrom + ">\r\n" +
        "To: " + toEmail + "\r\n" +
        "Subject: " + encodedSubject + "\r\n" +
        "Content-Type: text/plain; charset=UTF-8\r\n" +
        "\r\n"

    finalMessage := append([]byte(headers), bodyBuffer.Bytes()...)

    addr := fmt.Sprintf("%s:%s", SmtpHost, SmtpPort)
    log.Printf("📤 [1/5] TCP (IPv4) attempt to %s...", addr)

    // 1. TCP Connection with Timeout (max 10 seconds) and IPv4 enforcement
    conn, err := net.DialTimeout("tcp4", addr, 10*time.Second)
    if err != nil {
        return fmt.Errorf("TCP connection failed (Blocked port or unreachable DNS): %v", err)
    }
    defer conn.Close()
    
    conn.SetDeadline(time.Now().Add(30 * time.Second))

    log.Printf("⏳ [2/5] TCP OK. Waiting for SMTP welcome message (220)...")
    client, err := smtp.NewClient(conn, SmtpHost)
    if err != nil {
        return fmt.Errorf("failed to create SMTP client (no 220 response): %v", err)
    }
    defer client.Close()

    log.Printf("🗣️ [3/5] SMTP welcome received. Sending HELO/EHLO...")
    if err := client.Hello("csms.hevs.ch"); err != nil {
        log.Printf("⚠️ SMTP HELO warning: %v", err)
    }

    log.Printf("✉️ [4/5] Configuring senders and recipients...")
    if err := client.Mail(MailFrom); err != nil {
        return fmt.Errorf("sender refused (MAIL FROM): %v", err)
    }
    
    // Adding primary recipient
    if err := client.Rcpt(toEmail); err != nil {
        return fmt.Errorf("recipient refused (RCPT TO): %v", err)
    }

    // Adding Blind Carbon Copy (BCC) recipient in the SMTP envelope
    // Add it only if the option is active AND the admin is not ALREADY the primary recipient
    if AlwaysBCCAdmin && BCCAdminEmail != "" && toEmail != BCCAdminEmail {
        if err := client.Rcpt(BCCAdminEmail); err != nil {
            log.Printf("⚠️ Warning: BCC recipient refused (%s): %v", BCCAdminEmail, err)
        }
    }

    log.Printf("📦 [5/5] Sending message body...")
    w, err := client.Data()
    if err != nil {
        return fmt.Errorf("error opening DATA stream: %v", err)
    }
    if _, err = w.Write(finalMessage); err != nil {
        return fmt.Errorf("error sending content: %v", err)
    }
    if err = w.Close(); err != nil {
        return fmt.Errorf("error closing DATA stream: %v", err)
    }

    client.Quit()
    log.Printf("✅ Email '%s' successfully sent to %s!", subject, toEmail)
    return nil
}