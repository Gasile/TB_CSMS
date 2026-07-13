const HASURA_URL = import.meta.env.VITE_HASURA_URL;

export async function fetchHasura(query: string, variables: any = {}) {
  if (!HASURA_URL) {
    throw new Error(
      "Configuration Hasura manquante dans les variables d'environnement (.env)",
    );
  }

  // 1. Préparation des en-têtes
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // 2. Récupération du JWT
  const token = localStorage.getItem("jwt_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // 3. Envoi de la requête
  const response = await fetch(HASURA_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  // 4. Gestion des erreurs
  if (result.errors) {
    const errorMessage = result.errors[0].message;

    // Redirection SEULEMENT si nous ne sommes pas déjà sur une page d'authentification publique
    const isPublicAuthPage =
      window.location.pathname.includes("/login") ||
      window.location.pathname.includes("/register") ||
      window.location.pathname.includes("/forgot-password") ||
      window.location.pathname.includes("/reset-password");

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

    // Sinon, on transmet l'erreur normalement au formulaire pour qu'elle s'affiche à l'écran !
    throw new Error(errorMessage || "Erreur GraphQL");
  }

  return result.data;
}
