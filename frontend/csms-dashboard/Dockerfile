# Étape 1 : Build de l'application React avec Vite
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Déclarer les arguments de build pour Vite
ARG VITE_HASURA_URL=/v1/graphql
ARG VITE_AUTH_API_URL=/api
ARG VITE_ENABLE_DEV_LOGINS=false

# Inserer les arguments dans l'environnement du container de build
ENV VITE_HASURA_URL=$VITE_HASURA_URL
ENV VITE_AUTH_API_URL=$VITE_AUTH_API_URL
ENV VITE_ENABLE_DEV_LOGINS=$VITE_ENABLE_DEV_LOGINS

RUN npm run build

# Étape 2 : Service des fichiers statiques avec Nginx
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]