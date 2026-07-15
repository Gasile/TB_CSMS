// ============================================================================
// IMPORTS
// ============================================================================

const HASURA_URL = import.meta.env.VITE_HASURA_URL;

// ============================================================================
// HASURA CLIENT & REQUEST HANDLER
// ============================================================================

/**
 * Executes a GraphQL query or mutation against the Hasura engine with JWT authorization.
 */
export async function fetchHasura(query: string, variables: any = {}) {
  if (!HASURA_URL) {
    throw new Error(
      "Configuration Hasura manquante dans les variables d'environnement (.env)",
    );
  }

  // Set default content headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Retrieve and append the active JWT token to the request headers if available
  const token = localStorage.getItem("jwt_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Send the POST request containing the GraphQL document and payload
  const response = await fetch(HASURA_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  // Handle GraphQL level response errors and token expiration
  if (result.errors) {
    const errorMessage = result.errors[0].message;

    // Check if the user is currently navigating within a public authentication view
    const isPublicAuthPage =
      window.location.pathname.includes("/login") ||
      window.location.pathname.includes("/register") ||
      window.location.pathname.includes("/forgot-password") ||
      window.location.pathname.includes("/reset-password");

    // Force sign-out and redirect to login if the session expired due to invalid/expired JWT
    if (
      !isPublicAuthPage &&
      (errorMessage.includes("invalid-jwt") || errorMessage.includes("JWT"))
    ) {
      console.warn("Session expirée ou token invalide. Déconnexion forcée.");
      localStorage.removeItem("jwt_token");
      sessionStorage.removeItem("csms_user");
      window.location.href = "/login";
      throw new Error("Votre session a expiré. Veuillez vous reconnecter.");
    }

    // Pass any other functional query errors back to the UI component
    throw new Error(errorMessage || "Erreur GraphQL");
  }

  return result.data;
}
