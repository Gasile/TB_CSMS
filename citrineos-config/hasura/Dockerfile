# Use official Hasura CLI-Migrations v3 image
FROM hasura/graphql-engine:v2.40.3.cli-migrations-v3

# Copy metadata and migrations into the image
COPY ./metadata /hasura-metadata
COPY ./migrations /hasura-migrations