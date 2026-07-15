# --- BUILD STAGE ---
FROM golang:1.25.1-alpine AS builder

WORKDIR /app

# Initialize module management
COPY go.mod ./
RUN go mod download

# Copy the entire project context (including internal structures and main commands)
COPY . .

# Compile the core application targeting the main server entrypoint 
RUN CGO_ENABLED=0 GOOS=linux go build -o smart-charging-service ./cmd/server

# --- PRODUCTION STAGE ---
FROM scratch

# Import core certificates to secure outgoing HTTPS GraphQL and REST calls
COPY --from=alpine:latest /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

WORKDIR /root/
COPY --from=builder /app/smart-charging-service .

EXPOSE 8081
CMD ["./smart-charging-service"]