# --- BUILD STAGE ---
FROM golang:1.25.1-alpine AS builder

WORKDIR /app

# Initialize dependencies and download required modules
COPY go.mod ./
RUN go get github.com/golang-jwt/jwt/v5

# Copy the core application source
COPY main.go ./

# Compile the Go application as a statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -o auth-service main.go

# --- PRODUCTION STAGE ---
FROM scratch

# Import necessary CA certificates for secure outgoing requests
COPY --from=alpine:latest /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

WORKDIR /root/
COPY --from=builder /app/auth-service .

EXPOSE 8086
CMD ["./auth-service"]