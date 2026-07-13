FROM golang:1.25.1-alpine AS builder

WORKDIR /app
COPY go.mod ./
COPY main.go registry.go ./
COPY templates/ ./templates/

RUN CGO_ENABLED=0 GOOS=linux go build -o notification-service .

FROM scratch
COPY --from=alpine:latest /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
WORKDIR /root/
COPY --from=builder /app/notification-service .
COPY --from=builder /app/templates ./templates

EXPOSE 8084
CMD ["./notification-service"]