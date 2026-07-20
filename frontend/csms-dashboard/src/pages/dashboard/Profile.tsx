// ============================================================================
// IMPORTS
// ============================================================================

import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { updateMyProfile } from "../../api/userApi";
import { updateEmailSecure, updatePasswordSecure } from "../../api/authApi";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Profile management view letting users update their personal details,
 * email address, or account password.
 */
export default function Profile() {
  const { user, logout, login } = useAuth();

  // --- Standard Profile Editing States (First Name / Last Name / Notifications) ---
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  // Initialisation avec fallback à true si non défini[cite: 5]
  const [userNotifications, setUserNotifications] = useState(
    user?.userNotifications ?? true,
  );
  const [adminNotifications, setAdminNotifications] = useState(
    user?.adminNotifications ?? true,
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // --- Secured Security Actions States (Email / Password) ---
  const [securityAction, setSecurityAction] = useState<
    "none" | "email" | "password"
  >("none");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [securitySuccess, setSecuritySuccess] = useState("");
  const [isSecuritySaving, setIsSecuritySaving] = useState(false);

  if (!user) return null;

  // Compute profile avatar initials using first characters
  const initials =
    `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  // --- Standard Profile Request Handlers ---

  /**
   * Submits standard profile changes (First Name, Last Name, Notifications) to the API.
   */
  const handleSaveProfile = async () => {
    setError("");
    setIsSaving(true);
    try {
      // Ajout des deux nouveaux paramètres pour l'API[cite: 5]
      await updateMyProfile(
        user.id!,
        firstName,
        lastName,
        user.email || "",
        userNotifications,
        adminNotifications,
      );
      login({
        ...user,
        firstName,
        lastName,
        userNotifications,
        adminNotifications,
      });
      setIsEditing(false);
    } catch (err: any) {
      setError("Erreur lors de la mise à jour du profil.");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Discards standard profile form modifications and restores original details.
   */
  const handleCancelProfile = () => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setUserNotifications(user.userNotifications ?? true);
    setAdminNotifications(user.adminNotifications ?? true);
    setError("");
    setIsEditing(false);
  };

  // --- Security Utility Handlers ---

  /**
   * Resets all security-related states and switches panel back to none.
   */
  const resetSecurityForm = () => {
    setSecurityAction("none");
    setCurrentPassword("");
    setNewEmail("");
    setNewPassword("");
    setConfirmNewPassword("");
    setSecurityError("");
    setSecuritySuccess("");
  };

  /**
   * Processes the email update secure request.
   */
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError("");
    setSecuritySuccess("");
    setIsSecuritySaving(true);

    try {
      await updateEmailSecure(user.id!, currentPassword, newEmail);
      login({ ...user, email: newEmail });
      setSecuritySuccess("Votre e-mail a été mis à jour avec succès.");
      setTimeout(resetSecurityForm, 2500);
    } catch (err: any) {
      setSecurityError(err.message);
    } finally {
      setIsSecuritySaving(false);
    }
  };

  /**
   * Processes the password update secure request after confirmation matching.
   */
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError("");
    setSecuritySuccess("");

    if (newPassword !== confirmNewPassword) {
      setSecurityError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    setIsSecuritySaving(true);
    try {
      await updatePasswordSecure(user.id!, currentPassword, newPassword);
      setSecuritySuccess("Votre mot de passe a été mis à jour avec succès.");
      setTimeout(resetSecurityForm, 2500);
    } catch (err: any) {
      setSecurityError(err.message);
    } finally {
      setIsSecuritySaving(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: "600px", width: "100%" }}>
        {/* Profile View Header Block */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "var(--text-main)",
              fontSize: "1.8rem",
              transition: "var(--theme-transition)",
            }}
          >
            Mon Profil
          </h2>
          {!isEditing && securityAction === "none" && (
            <button
              onClick={() => setIsEditing(true)}
              style={editToggleButtonStyle}
            >
              ⚙️ Modifier le profil
            </button>
          )}
        </div>

        {/* Info & Modification Card Container */}
        <div style={cardStyle}>
          {/* Avatar and Role Header */}
          <div style={headerStyle}>
            <div style={avatarLargeStyle}>{initials}</div>
            <div>
              <h3
                style={{
                  margin: "0 0 5px 0",
                  fontSize: "1.4rem",
                  color: "var(--text-main)",
                  transition: "var(--theme-transition)",
                }}
              >
                {user.firstName} {user.lastName}
              </h3>
              <span style={roleBadgeStyle(user.role)}>
                {user.role === "Admin" ? "👑 Administrateur" : "👤 Utilisateur"}
              </span>
            </div>
          </div>

          <div style={separatorStyle} />

          {error && <div style={errorStyle}>{error}</div>}

          {/* Standard Information Fields */}
          <div style={infoGridStyle}>
            <div style={infoBlockStyle}>
              <span style={labelStyle}>Prénom</span>
              {isEditing ? (
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  style={inputStyle}
                />
              ) : (
                <span style={valueStyle}>{user.firstName}</span>
              )}
            </div>
            <div style={infoBlockStyle}>
              <span style={labelStyle}>Nom</span>
              {isEditing ? (
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  style={inputStyle}
                />
              ) : (
                <span style={valueStyle}>{user.lastName}</span>
              )}
            </div>
            <div style={infoBlockStyle}>
              <span style={labelStyle}>Adresse E-mail</span>
              <span style={{ ...valueStyle, color: "var(--text-muted)" }}>
                {user.email}
              </span>
            </div>

            {/* Ajout des options de notifications[cite: 5] */}
            <div style={infoBlockStyle}>
              <span style={labelStyle}>Notifications standards</span>
              {isEditing ? (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                    color: "var(--text-main)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={userNotifications}
                    onChange={(e) => setUserNotifications(e.target.checked)}
                    style={checkboxStyle}
                  />
                  Activées
                </label>
              ) : (
                <span style={valueStyle}>
                  {userNotifications ? "Activées" : "Désactivées"}
                </span>
              )}
            </div>

            {/* Affichage conditionnel pour les administrateurs[cite: 5] */}
            {user.role === "Admin" && (
              <div style={infoBlockStyle}>
                <span style={labelStyle}>Alertes Administrateur</span>
                {isEditing ? (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      cursor: "pointer",
                      color: "var(--text-main)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={adminNotifications}
                      onChange={(e) => setAdminNotifications(e.target.checked)}
                      style={checkboxStyle}
                    />
                    Activées
                  </label>
                ) : (
                  <span style={valueStyle}>
                    {adminNotifications ? "Activées" : "Désactivées"}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Form Save/Cancel controls */}
          {isEditing && (
            <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                style={saveButtonStyle(isSaving)}
              >
                {isSaving ? "Enregistrement..." : "💾 Enregistrer"}
              </button>
              <button
                onClick={handleCancelProfile}
                disabled={isSaving}
                style={cancelButtonStyle}
              >
                Annuler
              </button>
            </div>
          )}

          <div style={separatorStyle} />

          {/* --- Secured Actions and Dynamic Forms Segment --- */}
          {securityAction === "none" ? (
            <div style={actionsContainerStyle}>
              <button
                onClick={() => setSecurityAction("email")}
                style={actionLinkStyle}
              >
                Modifier l'adresse e-mail
              </button>
              <button
                onClick={() => setSecurityAction("password")}
                style={actionLinkStyle}
              >
                Modifier le mot de passe
              </button>
              <button onClick={logout} style={logoutLinkStyle}>
                Se déconnecter
              </button>
            </div>
          ) : (
            <div style={securityFormContainerStyle}>
              <h4
                style={{
                  margin: "0 0 15px 0",
                  color: "var(--text-main)",
                  fontSize: "1.1rem",
                  transition: "var(--theme-transition)",
                }}
              >
                {securityAction === "email"
                  ? "Changement d'adresse e-mail"
                  : "Changement de mot de passe"}
              </h4>

              {securityError && <div style={errorStyle}>{securityError}</div>}
              {securitySuccess && (
                <div style={successStyle}>{securitySuccess}</div>
              )}

              {!securitySuccess && (
                <form
                  onSubmit={
                    securityAction === "email"
                      ? handleChangeEmail
                      : handleChangePassword
                  }
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Mot de passe actuel</label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      style={inputStyle}
                      placeholder="••••••••"
                    />
                  </div>

                  {securityAction === "email" ? (
                    <div style={inputGroupStyle}>
                      <label style={labelStyle}>Nouvelle adresse e-mail</label>
                      <input
                        type="email"
                        required
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        style={inputStyle}
                        placeholder="nouveau@email.com"
                      />
                    </div>
                  ) : (
                    <>
                      <div style={inputGroupStyle}>
                        <label style={labelStyle}>Nouveau mot de passe</label>
                        <input
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          style={inputStyle}
                          placeholder="••••••••"
                        />
                      </div>
                      <div style={inputGroupStyle}>
                        <label style={labelStyle}>
                          Confirmer le mot de passe
                        </label>
                        <input
                          type="password"
                          required
                          value={confirmNewPassword}
                          onChange={(e) =>
                            setConfirmNewPassword(e.target.value)
                          }
                          style={inputStyle}
                          placeholder="••••••••"
                        />
                      </div>
                    </>
                  )}

                  <div
                    style={{ display: "flex", gap: "10px", marginTop: "10px" }}
                  >
                    <button
                      type="submit"
                      disabled={isSecuritySaving}
                      style={saveButtonStyle(isSecuritySaving)}
                    >
                      {isSecuritySaving ? "Vérification..." : "Valider"}
                    </button>
                    <button
                      type="button"
                      onClick={resetSecurityForm}
                      disabled={isSecuritySaving}
                      style={cancelButtonStyle}
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STYLES & LAYOUTS (INLINE CSS VARIABLES ADAPTATION)
// ============================================================================

const containerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "20px 0",
};

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: "16px",
  padding: "30px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  transition: "var(--theme-transition)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "20px",
};

const avatarLargeStyle: React.CSSProperties = {
  width: "80px",
  height: "80px",
  borderRadius: "50%",
  background: "var(--primary)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "2rem",
  letterSpacing: "2px",
  boxShadow: "0 4px 15px rgba(0, 210, 143, 0.2)",
  transition: "var(--theme-transition)",
};

const roleBadgeStyle = (role: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "0.8rem",
  fontWeight: "600",
  background:
    role === "Admin" ? "rgba(0, 210, 143, 0.15)" : "var(--border-color)",
  color: role === "Admin" ? "var(--status-charging)" : "var(--text-muted)",
  transition: "var(--theme-transition)",
});

const separatorStyle: React.CSSProperties = {
  height: "1px",
  background: "var(--border-color)",
  width: "100%",
  transition: "var(--theme-transition)",
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "15px",
};

const infoBlockStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  background: "var(--bg-app)",
  padding: "12px 15px",
  borderRadius: "8px",
  transition: "var(--theme-transition)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: "var(--text-muted)",
  fontWeight: "600",
  transition: "var(--theme-transition)",
};

const valueStyle: React.CSSProperties = {
  fontSize: "1rem",
  color: "var(--text-main)",
  fontWeight: "500",
  transition: "var(--theme-transition)",
};

const errorStyle: React.CSSProperties = {
  background: "rgba(239, 68, 68, 0.15)",
  color: "var(--status-offline)",
  padding: "12px",
  borderRadius: "8px",
  fontSize: "0.85rem",
  textAlign: "center",
  fontWeight: "500",
};

const successStyle: React.CSSProperties = {
  background: "rgba(16, 185, 129, 0.15)",
  color: "var(--status-charging)",
  padding: "12px",
  borderRadius: "8px",
  fontSize: "0.85rem",
  textAlign: "center",
  fontWeight: "500",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid var(--border-color)",
  background: "var(--bg-card)",
  color: "var(--text-main)",
  fontSize: "0.95rem",
  outline: "none",
  transition: "var(--theme-transition)",
};

// Style ajouté pour la case à cocher[cite: 5]
const checkboxStyle: React.CSSProperties = {
  width: "18px",
  height: "18px",
  accentColor: "var(--primary)",
  cursor: "pointer",
  color: "var(--primary)",
  transition: "var(--theme-transition)",
};

const editToggleButtonStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};

const saveButtonStyle = (disabled: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "10px",
  background: disabled ? "var(--border-color)" : "var(--primary)",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontWeight: "600",
  cursor: disabled ? "not-allowed" : "pointer",
  transition: "var(--theme-transition)",
});

const cancelButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px",
  background: "var(--bg-app)",
  color: "var(--text-muted)",
  border: "none",
  borderRadius: "8px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "var(--theme-transition)",
};

const actionsContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "12px",
  marginTop: "5px",
};

const actionLinkStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontSize: "0.95rem",
  fontWeight: "600",
  color: "var(--text-muted)",
  textDecoration: "underline",
  textUnderlineOffset: "4px",
  transition: "var(--theme-transition)",
};

const logoutLinkStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontSize: "0.95rem",
  fontWeight: "600",
  color: "var(--status-offline)",
  textDecoration: "underline",
  textUnderlineOffset: "4px",
  marginTop: "10px",
  transition: "var(--theme-transition)",
};

const securityFormContainerStyle: React.CSSProperties = {
  background: "var(--bg-app)",
  padding: "20px",
  borderRadius: "10px",
  border: "1px solid var(--border-color)",
  marginTop: "5px",
  transition: "var(--theme-transition)",
};
