# --- BUILD STAGE ---
FROM golang:1.25.1-alpine AS builder

WORKDIR /app

# Initialize module management and copy application source
COPY go.mod ./
COPY main.go ./

# Compile the Go application as a statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -o badge-service main.go

# --- PRODUCTION STAGE ---
FROM scratch

# Import necessary CA certificates for secure outgoing requests
COPY --from=alpine:latest /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

WORKDIR /root/
COPY --from=builder /app/badge-service .

EXPOSE 8085
CMD ["./badge-service"]