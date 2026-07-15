// ============================================================================
// IMPORTS
// ============================================================================

import type { UserSession } from "../types";
import { fetchHasura } from "./hasuraClient";

// ============================================================================
// AUTHENTICATION SERVICES (GO MICROSERVICE INTEGRATION)
// ============================================================================

/**
 * Validates user credentials against the Go Auth service and returns the session details along with a JWT.
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

  // Map flat Go microservice response structure to the format expected by React
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
 * Requests a password reset link from the Go authentication microservice.
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
 * Validates the reset token and saves the new password through the Go microservice.
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
 * Creates a new user record via the Go Auth microservice using strict camelCase formatting.
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
 * Safely updates a user's email address using their current password and JWT authentication.
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
        userId: String(userId), // Explicitly cast to string as required by the Go microservice
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
 * Safely updates a user's password using their current password and JWT authentication.
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
        userId: String(userId), // Explicitly cast to string as required by the Go microservice
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
