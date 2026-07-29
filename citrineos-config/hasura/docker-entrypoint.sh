#!/bin/sh
set -e

# Lancer GraphQL Engine en arrière-plan
graphql-engine serve &
PID=$!

# Attendre que Hasura soit prêt
echo "En attente du démarrage de Hasura..."
until wget -qO- http://localhost:8080/healthz > /dev/null 2>&1; do
  sleep 2
done

echo "Hasura est prêt ! Application des migrations et métadonnées..."

# Appliquer les migrations si le dossier existe
if [ -d "/hasura-claim/migrations" ]; then
  hasura-cli migrate apply --project /hasura-claim --endpoint http://localhost:8080 --admin-secret "$HASURA_GRAPHQL_ADMIN_SECRET"
fi

# Appliquer les métadonnées si le dossier existe
if [ -d "/hasura-claim/metadata" ]; then
  hasura-cli metadata apply --project /hasura-claim --endpoint http://localhost:8080 --admin-secret "$HASURA_GRAPHQL_ADMIN_SECRET"
fi

echo "Migrations et métadonnées appliquées avec succès !"

# Maintenir le conteneur en vie
wait $PID