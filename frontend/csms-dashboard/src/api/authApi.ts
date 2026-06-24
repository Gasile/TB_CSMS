import type { UserSession } from "../types";
import { fetchHasura } from "./hasuraClient";

/**
 * Génère le hash SHA-256 d'un mot de passe pour la vérification ou l'inscription
 */
async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Vérifie les identifiants de connexion et retourne la session utilisateur
 */
export async function loginUser(
  email: string,
  passwordInput: string,
): Promise<UserSession> {
  const query = `
    query LoginCheck($email: String!) {
      Users(where: {email: {_eq: $email}}) {
        id
        first_name
        last_name
        password_hash
        role
        email
      }
    }
  `;

  const data = await fetchHasura(query, { email });

  if (!data.Users || data.Users.length === 0) {
    throw new Error("Utilisateur introuvable.");
  }

  const dbUser = data.Users[0];
  const inputPasswordHash = await hashPassword(passwordInput);

  if (inputPasswordHash === dbUser.password_hash) {
    return {
      id: dbUser.id,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      email: dbUser.email,
      role: dbUser.role,
    };
  } else {
    throw new Error("Mot de passe incorrect.");
  }
}

/**
 * Génère un jeton de réinitialisation et l'enregistre dans la base de données
 */
export async function requestPasswordReset(email: string): Promise<string> {
  const token = crypto.randomUUID();

  const expirationDate = new Date();
  expirationDate.setHours(expirationDate.getHours() + 1);
  const expiresAt = expirationDate.toISOString();

  const mutation = `
    mutation SetResetToken($email: String!, $token: String!, $expiresAt: timestamptz!) {
      update_Users(where: {email: {_eq: $email}}, _set: {reset_token: $token, reset_token_expires: $expiresAt}) {
        affected_rows
      }
    }
  `;

  const data = await fetchHasura(mutation, { email, token, expiresAt });

  if (!data.update_Users || data.update_Users.affected_rows === 0) {
    throw new Error("Si cet e-mail existe, un lien vous a été envoyé.");
  }

  const resetLink = `http://localhost:5173/reset-password/${token}`;

  console.log(
    "%c=== SIMULATION D'ENVOI D'E-MAIL ===",
    "color: #4CAF50; font-weight: bold;",
  );
  console.log(`%cDestinataire : ${email}`, "color: #2196F3");
  console.log(`%cLien de réinitialisation : ${resetLink}`, "color: #2196F3");
  console.log(
    "%c==================================",
    "color: #4CAF50; font-weight: bold;",
  );

  return resetLink;
}

/**
 * Valide le jeton et met à jour le mot de passe
 */
export async function resetPassword(
  token: string,
  newPasswordInput: string,
): Promise<boolean> {
  const newPasswordHash = await hashPassword(newPasswordInput);
  const now = new Date().toISOString();

  const mutation = `
    mutation UpdatePasswordWithToken($token: String!, $now: timestamptz!, $newHash: String!) {
      update_Users(
        where: {
          reset_token: {_eq: $token},
          reset_token_expires: {_gt: $now} 
        },
        _set: {
          password_hash: $newHash,
          reset_token: null,
          reset_token_expires: null
        }
      ) {
        affected_rows
      }
    }
  `;

  const data = await fetchHasura(mutation, {
    token,
    now,
    newHash: newPasswordHash,
  });

  if (!data.update_Users || data.update_Users.affected_rows === 0) {
    throw new Error("Ce lien de réinitialisation est invalide ou a expiré.");
  }

  return true;
}

/**
 * Crée un nouvel utilisateur avec le rôle "User" par défaut
 */
export async function registerUser(
  firstName: string,
  lastName: string,
  email: string,
  passwordInput: string,
): Promise<boolean> {
  const passwordHash = await hashPassword(passwordInput);

  const mutation = `
    mutation RegisterUser($firstName: String!, $lastName: String!, $email: String!, $passwordHash: String!) {
      insert_Users_one(object: {
        first_name: $firstName,
        last_name: $lastName,
        email: $email,
        password_hash: $passwordHash,
        role: "User"
      }) {
        id
      }
    }
  `;

  try {
    await fetchHasura(mutation, { firstName, lastName, email, passwordHash });
    return true;
  } catch (err: any) {
    if (err.message.includes("Uniqueness violation")) {
      throw new Error("Cette adresse e-mail est déjà associée à un compte.");
    }
    throw new Error(err.message || "Erreur lors de l'inscription.");
  }
}

/**
 * Met à jour l'e-mail après avoir vérifié le mot de passe actuel
 */
export async function updateEmailSecure(
  userId: number,
  currentPasswordUnhashed: string,
  newEmail: string,
): Promise<boolean> {
  const currentHash = await hashPassword(currentPasswordUnhashed);

  const checkQuery = `
    query CheckPass($id: Int!, $hash: String!) {
      Users(where: {id: {_eq: $id}, password_hash: {_eq: $hash}}) { id }
    }
  `;

  const checkData = await fetchHasura(checkQuery, {
    id: userId,
    hash: currentHash,
  });

  if (!checkData.Users || checkData.Users.length === 0) {
    throw new Error("Le mot de passe actuel est incorrect.");
  }

  const updateMutation = `
    mutation UpdateEmail($id: Int!, $email: String!) {
      update_Users_by_pk(pk_columns: {id: $id}, _set: {email: $email}) { id }
    }
  `;

  try {
    await fetchHasura(updateMutation, { id: userId, email: newEmail });
    return true;
  } catch (err: any) {
    if (err.message.includes("Uniqueness violation")) {
      throw new Error(
        "Cette adresse e-mail est déjà utilisée par un autre compte.",
      );
    }
    throw new Error("Erreur lors de la mise à jour de l'e-mail.");
  }
}

/**
 * Met à jour le mot de passe après avoir vérifié l'actuel
 */
export async function updatePasswordSecure(
  userId: number,
  currentPasswordUnhashed: string,
  newPasswordUnhashed: string,
): Promise<boolean> {
  const currentHash = await hashPassword(currentPasswordUnhashed);

  const checkQuery = `
    query CheckPass($id: Int!, $hash: String!) {
      Users(where: {id: {_eq: $id}, password_hash: {_eq: $hash}}) { id }
    }
  `;

  const checkData = await fetchHasura(checkQuery, {
    id: userId,
    hash: currentHash,
  });

  if (!checkData.Users || checkData.Users.length === 0) {
    throw new Error("Le mot de passe actuel est incorrect.");
  }

  const newHash = await hashPassword(newPasswordUnhashed);
  const updateMutation = `
    mutation UpdatePassword($id: Int!, $hash: String!) {
      update_Users_by_pk(pk_columns: {id: $id}, _set: {password_hash: $hash}) { id }
    }
  `;

  await fetchHasura(updateMutation, { id: userId, hash: newHash });
  return true;
}
