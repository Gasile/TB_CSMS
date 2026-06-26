# --- Étape 1 : Construction (Builder) ---
# On utilise l'image officielle Go pour compiler le code (mise à jour vers la version requise par ton go.mod)
FROM golang:1.25.1-alpine AS builder

# Définition du répertoire de travail dans le conteneur
WORKDIR /app

# Copie des fichiers de gestion des dépendances
# (Même si tu n'as pas de dépendances externes pour l'instant, c'est une bonne pratique)
COPY go.mod ./
# COPY go.sum ./ (décommente cette ligne si tu ajoutes des modules externes plus tard)

# Téléchargement des dépendances
RUN go mod download

# Copie du code source
COPY *.go ./

# Compilation de l'application Go
# CGO_ENABLED=0 garantit que le binaire est statique et n'a besoin d'aucune librairie externe (parfait pour l'étape 2)
# GOOS=linux s'assure qu'on compile pour l'architecture cible du serveur
RUN CGO_ENABLED=0 GOOS=linux go build -o idle-service .

# --- Étape 2 : Image finale (Production) ---
# On utilise scratch, une image Docker complètement vide !
# Cela réduit drastiquement la surface d'attaque et la taille de l'image.
FROM scratch

# On récupère les certificats SSL racines depuis l'image alpine (nécessaire pour faire des requêtes HTTPS si Hasura est en HTTPS plus tard)
COPY --from=alpine:latest /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# On définit le répertoire de travail
WORKDIR /root/

# On copie uniquement le binaire compilé depuis l'étape 1
COPY --from=builder /app/idle-service .

# On expose le port 8080 (pour documentation, c'est le réseau interne de Docker qui fera le lien)
EXPOSE 8080

# Commande de démarrage
CMD ["./idle-service"]