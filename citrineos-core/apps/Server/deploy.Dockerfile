# SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
# SPDX-License-Identifier: Apache-2.0

FROM --platform=${BUILDPLATFORM:-linux/amd64} node:24.4.1 AS build

RUN corepack enable

WORKDIR /usr/local/apps/citrineos

COPY . .
RUN pnpm install && pnpm run build

# Final stage
FROM node:24.4.1-slim

# Install openssl to generate self-signed PKI certificates on build
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY --from=build /usr/local/apps/citrineos /usr/local/apps/citrineos

WORKDIR /usr/local/apps/citrineos

# Create target directory for CitrineOS certificates
RUN mkdir -p /usr/local/apps/citrineos/apps/Server/dist/assets/certificates

# Generate self-signed PKI structure required by CitrineOS
RUN cd /usr/local/apps/citrineos/apps/Server/dist/assets/certificates && \
    # 1. Root CA Key & Certificate
    openssl genrsa -out rootKey.pem 2048 && \
    openssl req -x509 -new -nodes -key rootKey.pem -sha256 -days 3650 -out rootCertificate.pem -subj "/CN=CitrineOS-Root-CA" && \
    # 2. Sub CA Key
    openssl genrsa -out subCAKey.pem 2048 && \
    # 3. Leaf Key & CSR
    openssl genrsa -out leafKey.pem 2048 && \
    openssl req -new -key leafKey.pem -out leaf.csr -subj "/CN=localhost" && \
    # 4. Sign Leaf Certificate with Root CA
    openssl x509 -req -in leaf.csr -CA rootCertificate.pem -CAkey rootKey.pem -CAcreateserial -out leafCert.pem -days 365 -sha256 && \
    # 5. Build certChain.pem (Leaf + Root)
    cat leafCert.pem rootCertificate.pem > certChain.pem && \
    # 6. ACME Account Key
    openssl genrsa -out acme_account_key.pem 2048 && \
    # Clean up temporary files
    rm -f leaf.csr leafCert.pem rootCertificate.srl

RUN chmod +x /usr/local/apps/citrineos/apps/Server/entrypoint.sh

EXPOSE ${PORT}

ENTRYPOINT ["/usr/local/apps/citrineos/apps/Server/entrypoint.sh"]