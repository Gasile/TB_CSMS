# --- BUILD STAGE ---
FROM golang:1.25.1-alpine AS builder

WORKDIR /app

COPY go.mod ./
# COPY go.sum ./

RUN go mod download

COPY *.go ./

RUN CGO_ENABLED=0 GOOS=linux go build -o idle-service .

# --- PRODUCTION STAGE ---
FROM scratch

COPY --from=alpine:latest /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

WORKDIR /root/

COPY --from=builder /app/idle-service .

EXPOSE 8080

CMD ["./idle-service"]