# --- Étape 1 : Construction ---
FROM golang:1.25.1-alpine AS builder

WORKDIR /app
COPY go.mod ./
RUN go mod download

# Copie de tout le code source (tous les dossiers internal et cmd)
COPY . .

# Compilation en ciblant le point d'entrée principal (cmd/server)
RUN CGO_ENABLED=0 GOOS=linux go build -o smart-charging-service ./cmd/server

# --- Étape 2 : Production ---
FROM scratch
COPY --from=alpine:latest /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
WORKDIR /root/
COPY --from=builder /app/smart-charging-service .

EXPOSE 8081
CMD ["./smart-charging-service"]