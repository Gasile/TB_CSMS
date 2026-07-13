FROM golang:1.25.1-alpine AS builder

WORKDIR /app
# On copie d'abord le go.mod
COPY go.mod ./
# On télécharge la dépendance JWT
RUN go get github.com/golang-jwt/jwt/v5
# On copie le code source
COPY main.go ./

# Compilation
RUN CGO_ENABLED=0 GOOS=linux go build -o auth-service main.go

FROM scratch
COPY --from=alpine:latest /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
WORKDIR /root/
COPY --from=builder /app/auth-service .

EXPOSE 8086
CMD ["./auth-service"]