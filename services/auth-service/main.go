package main

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const Port = ":8086"

var (
	HasuraURL         = os.Getenv("HASURA_GRAPHQL_URL")
	HasuraAdminSecret = os.Getenv("HASURA_GRAPHQL_ADMIN_SECRET")
	JwtSecret         = []byte(os.Getenv("JWT_SECRET"))
)

// --- STRUCTURES REQUÊTES FRONTEND ---
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	Password  string `json:"password"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

type ResetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

type UpdateEmailRequest struct {
	UserID          string `json:"userId"`
	CurrentPassword string `json:"currentPassword"`
	NewEmail        string `json:"newEmail"`
}

type UpdatePasswordRequest struct {
	UserID          string `json:"userId"`
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// --- STRUCTURES RÉPONSES ---
type LoginResponse struct {
	Token     string `json:"token"`
	Role      string `json:"role"`
	ID        string `json:"id"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
}

type UserData struct {
	ID        int    `json:"id"`
	Role      string `json:"role"`
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

func main() {
	fmt.Println("🚀 Démarrage de l'Auth Service sur le port", Port)

	if len(JwtSecret) == 0 {
		log.Fatal("❌ ERREUR: JWT_SECRET n'est pas défini dans l'environnement")
	}

	// Enregistrement des routes avec le Middleware CORS
	http.HandleFunc("/api/login", corsMiddleware(handleLogin))
	http.HandleFunc("/api/register", corsMiddleware(handleRegister))
	http.HandleFunc("/api/forgot-password", corsMiddleware(handleForgotPassword))
	http.HandleFunc("/api/reset-password", corsMiddleware(handleResetPassword))
	
	// Nouvelles routes protégées par notre middleware JWT
	http.HandleFunc("/api/profile/update-email", corsMiddleware(authMiddleware(handleUpdateEmail)))
	http.HandleFunc("/api/profile/update-password", corsMiddleware(authMiddleware(handleUpdatePassword)))

	log.Fatalf("Échec: %v", http.ListenAndServe(Port, nil))
}

// ==========================================
// MIDDLEWARE & UTILITAIRES
// ==========================================

// corsMiddleware ajoute les entêtes CORS à toutes les requêtes et gère le pré-vol (OPTIONS)
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	}
}

// authMiddleware vérifie la validité du token JWT reçu dans l'en-tête Authorization
func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Le CORS gère déjà OPTIONS, mais on s'assure de ne pas bloquer le pré-vol
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "Unauthorized: En-tête Authorization manquant ou invalide", http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
			return JwtSecret, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "Unauthorized: Token JWT invalide ou expiré", http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	}
}

func hashPasswordSHA256(password string) string {
	hasher := sha256.New()
	hasher.Write([]byte(password))
	return hex.EncodeToString(hasher.Sum(nil))
}

// generateUUID génère un identifiant unique standard (UUID v4) sans dépendance externe
func generateUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// executeHasuraQuery centralise la logique de communication avec Hasura
func executeHasuraQuery(query string, variables map[string]interface{}, out interface{}) error {
	payload := map[string]interface{}{"query": query, "variables": variables}
	jsonValue, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", HasuraURL, bytes.NewBuffer(jsonValue))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-hasura-admin-secret", HasuraAdminSecret)

	resp, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	return json.Unmarshal(bodyBytes, out)
}

// ==========================================
// HANDLERS (LOGIQUE MÉTIER)
// ==========================================

func handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var creds LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	hashedPassword := hashPasswordSHA256(creds.Password)

	query := `
		query GetUser($email: String!, $password: String!) {
			Users(where: {email: {_eq: $email}, password_hash: {_eq: $password}}, limit: 1) {
				id role email first_name last_name
			}
		}
	`
	var result struct {
		Data struct { Users []UserData `json:"Users"` } `json:"data"`
	}

	executeHasuraQuery(query, map[string]interface{}{"email": creds.Email, "password": hashedPassword}, &result)

	if len(result.Data.Users) == 0 {
		http.Error(w, "Unauthorized: Identifiants incorrects", http.StatusUnauthorized)
		return
	}
	user := result.Data.Users[0]
	userIDStr := fmt.Sprintf("%d", user.ID)

	tokenString, err := generateHasuraJWT(userIDStr, user.Role)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(LoginResponse{
		Token:     tokenString,
		Role:      user.Role,
		ID:        userIDStr,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Email:     user.Email,
	})
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	hashedPassword := hashPasswordSHA256(req.Password)

	query := `
		mutation RegisterUser($firstName: String!, $lastName: String!, $email: String!, $passwordHash: String!) {
			insert_Users_one(object: { first_name: $firstName, last_name: $lastName, email: $email, password_hash: $passwordHash, role: "User" }) {
				id
			}
		}
	`
	var result struct {
		Data struct { InsertUsersOne struct { ID int `json:"id"` } `json:"insert_Users_one"` } `json:"data"`
		Errors []struct { Message string `json:"message"` } `json:"errors"`
	}

	executeHasuraQuery(query, map[string]interface{}{
		"firstName": req.FirstName, "lastName": req.LastName, "email": req.Email, "passwordHash": hashedPassword,
	}, &result)

	if len(result.Errors) > 0 {
		log.Printf("Erreur Register: %v", result.Errors)
		http.Error(w, "Bad Request: Email peut-être déjà existant", http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func handleForgotPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	token := generateUUID()
	expiresAt := time.Now().UTC().Add(1 * time.Hour).Format(time.RFC3339) // Expire dans 1h

	query := `
		mutation SetResetToken($email: String!, $token: String!, $expiresAt: timestamptz!) {
			update_Users(where: {email: {_eq: $email}}, _set: {reset_token: $token, reset_token_expires: $expiresAt}) {
				affected_rows
			}
		}
	`
	var result struct {
		Data struct { UpdateUsers struct { AffectedRows int `json:"affected_rows"` } `json:"update_Users"` } `json:"data"`
	}

	executeHasuraQuery(query, map[string]interface{}{"email": req.Email, "token": token, "expiresAt": expiresAt}, &result)

	// Même si l'email n'existe pas, on renvoie 200 OK pour ne pas fuiter l'existence des emails
	resetLink := fmt.Sprintf("http://localhost:5173/reset-password/%s", token)
	log.Printf("🔑 [SIMULATION EMAIL] Lien de reset pour %s: %s", req.Email, resetLink)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"resetLink": resetLink})
}

func handleResetPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	newHash := hashPasswordSHA256(req.Password)
	now := time.Now().UTC().Format(time.RFC3339)

	query := `
		mutation UpdatePasswordWithToken($token: String!, $now: timestamptz!, $newHash: String!) {
			update_Users(where: { reset_token: {_eq: $token}, reset_token_expires: {_gt: $now} }, _set: { password_hash: $newHash, reset_token: null, reset_token_expires: null }) {
				affected_rows
			}
		}
	`
	var result struct {
		Data struct { UpdateUsers struct { AffectedRows int `json:"affected_rows"` } `json:"update_Users"` } `json:"data"`
	}

	executeHasuraQuery(query, map[string]interface{}{"token": req.Token, "now": now, "newHash": newHash}, &result)

	if result.Data.UpdateUsers.AffectedRows == 0 {
		http.Error(w, "Bad Request: Token invalide ou expiré", http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func handleUpdateEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req UpdateEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	userIDInt, err := strconv.Atoi(req.UserID)
	if err != nil {
		http.Error(w, "Bad Request: userId invalide", http.StatusBadRequest)
		return
	}

	currentHash := hashPasswordSHA256(req.CurrentPassword)

	// Requête optimisée : on met à jour uniquement si l'ID et le mot de passe actuel correspondent
	query := `
		mutation UpdateUserEmail($userId: Int!, $currentHash: String!, $newEmail: String!) {
			update_Users(where: { id: {_eq: $userId}, password_hash: {_eq: $currentHash} }, _set: { email: $newEmail }) {
				affected_rows
			}
		}
	`
	var result struct {
		Data struct { UpdateUsers struct { AffectedRows int `json:"affected_rows"` } `json:"update_Users"` } `json:"data"`
	}

	executeHasuraQuery(query, map[string]interface{}{"userId": userIDInt, "currentHash": currentHash, "newEmail": req.NewEmail}, &result)

	if result.Data.UpdateUsers.AffectedRows == 0 {
		http.Error(w, "Bad Request: Mot de passe actuel incorrect ou utilisateur introuvable", http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func handleUpdatePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req UpdatePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	userIDInt, err := strconv.Atoi(req.UserID)
	if err != nil {
		http.Error(w, "Bad Request: userId invalide", http.StatusBadRequest)
		return
	}

	currentHash := hashPasswordSHA256(req.CurrentPassword)
	newHash := hashPasswordSHA256(req.NewPassword)

	// Requête optimisée : on met à jour uniquement si l'ID et le mot de passe actuel correspondent
	query := `
		mutation UpdateUserPassword($userId: Int!, $currentHash: String!, $newHash: String!) {
			update_Users(where: { id: {_eq: $userId}, password_hash: {_eq: $currentHash} }, _set: { password_hash: $newHash }) {
				affected_rows
			}
		}
	`
	var result struct {
		Data struct { UpdateUsers struct { AffectedRows int `json:"affected_rows"` } `json:"update_Users"` } `json:"data"`
	}

	executeHasuraQuery(query, map[string]interface{}{"userId": userIDInt, "currentHash": currentHash, "newHash": newHash}, &result)

	if result.Data.UpdateUsers.AffectedRows == 0 {
		http.Error(w, "Bad Request: Mot de passe actuel incorrect", http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func generateHasuraJWT(userID string, role string) (string, error) {
	hasuraClaims := map[string]interface{}{
		"x-hasura-allowed-roles": []string{strings.ToLower(role)},
		"x-hasura-default-role":  strings.ToLower(role),
		"x-hasura-user-id":       userID,
	}

	claims := jwt.MapClaims{
		"https://hasura.io/jwt/claims": hasuraClaims,
		"exp":                          time.Now().Add(time.Hour * 24).Unix(),
		"iat":                          time.Now().Unix(),
		"sub":                          userID,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JwtSecret)
}