const HASURA_URL = import.meta.env.VITE_HASURA_URL;
const HASURA_ADMIN_SECRET = import.meta.env.VITE_HASURA_ADMIN_SECRET;

export async function fetchHasura(query: string, variables: any = {}) {
  if (!HASURA_URL || !HASURA_ADMIN_SECRET) {
    throw new Error(
      "Configuration Hasura manquante dans les variables d'environnement (.env)",
    );
  }

  const response = await fetch(HASURA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();
  if (result.errors) {
    throw new Error(result.errors[0].message || "Erreur GraphQL");
  }
  return result.data;
}
