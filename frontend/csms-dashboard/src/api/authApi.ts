import type { UserSession } from "../types";
import { fetchHasura } from "./hasuraClient";

/**
 * Vérifie les identifiants de connexion via le service Go Auth et retourne la session + JWT
 */
export async function loginUser(
  email: string,
  passwordInput: string,
): Promise<{ user: UserSession; token: string }> {
  const response = await fetch("http://localhost:8086/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: passwordInput }),
  });

  if (!response.ok) {
    throw new Error("Identifiants incorrects ou serveur injoignable.");
  }

  const data = await response.json();

  // Mappage de la réponse plate de Go vers l'objet attendu par React
  const userData = {
    id: Number(data.id),
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    role: data.role,
  };

  return {
    user: userData,
    token: data.token,
  };
}

/**
 * Demande un lien de réinitialisation via le service Go
 */
export async function requestPasswordReset(email: string): Promise<string> {
  const response = await fetch("http://localhost:8086/api/forgot-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error("Si cet e-mail existe, un lien vous a été envoyé.");
  }

  const data = await response.json();
  return data.resetLink || "";
}

/**
 * Valide et enregistre le nouveau mot de passe via le service Go
 */
export async function resetPassword(
  token: string,
  newPasswordInput: string,
): Promise<boolean> {
  const response = await fetch("http://localhost:8086/api/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, password: newPasswordInput }),
  });

  if (!response.ok) {
    throw new Error("Ce lien de réinitialisation est invalide ou a expiré.");
  }

  return true;
}

/**
 * Crée un nouvel utilisateur en passant par le microservice Go Auth (Format strict camelCase)
 */
export async function registerUser(
  firstName: string,
  lastName: string,
  email: string,
  passwordInput: string,
): Promise<boolean> {
  const response = await fetch("http://localhost:8086/api/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      firstName: firstName,
      lastName: lastName,
      email: email,
      password: passwordInput,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (errorText.includes("Unique") || errorText.includes("already")) {
      throw new Error("Cette adresse e-mail est déjà associée à un compte.");
    }
    throw new Error(errorText || "Erreur lors de l'inscription.");
  }

  return true;
}

/**
 * Met à jour l'e-mail via le service Go (Format strict camelCase + userId en string)
 */
export async function updateEmailSecure(
  userId: number,
  currentPasswordUnhashed: string,
  newEmail: string,
): Promise<boolean> {
  const token = localStorage.getItem("jwt_token");

  const response = await fetch(
    "http://localhost:8086/api/profile/update-email",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: String(userId), // Forcer la conversion en texte requise par le type string en Go
        currentPassword: currentPasswordUnhashed,
        newEmail: newEmail,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      errorText || "Impossible de mettre à jour l'adresse e-mail.",
    );
  }

  return true;
}

/**
 * Met à jour le mot de passe via le service Go (Format strict camelCase + userId en string)
 */
export async function updatePasswordSecure(
  userId: number,
  currentPasswordUnhashed: string,
  newPasswordUnhashed: string,
): Promise<boolean> {
  const token = localStorage.getItem("jwt_token");

  const response = await fetch(
    "http://localhost:8086/api/profile/update-password",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: String(userId), // Forcer la conversion en texte requise par le type string en Go
        currentPassword: currentPasswordUnhashed,
        newPassword: newPasswordUnhashed,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      errorText || "Impossible de mettre à jour le mot de passe.",
    );
  }

  return true;
}
