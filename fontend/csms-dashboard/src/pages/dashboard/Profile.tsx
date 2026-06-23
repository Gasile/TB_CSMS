import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { updateMyProfile } from "../../api/userApi";
import { updateEmailSecure, updatePasswordSecure } from "../../api/authApi";

export default function Profile() {
  const { user, logout, login } = useAuth();

  // --- États pour l'édition standard (Nom/Prénom) ---
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // --- États pour les actions sécurisées (E-mail/Mot de passe) ---
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

  const initials =
    `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  // --- Gestion du Profil Standard ---
  const handleSaveProfile = async () => {
    setError("");
    setIsSaving(true);
    try {
      await updateMyProfile(user.id!, firstName, lastName, user.email || "");
      login({ ...user, firstName, lastName });
      setIsEditing(false);
    } catch (err: any) {
      setError("Erreur lors de la mise à jour du profil.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelProfile = () => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setError("");
    setIsEditing(false);
  };

  // --- Utilitaires de sécurité ---
  const resetSecurityForm = () => {
    setSecurityAction("none");
    setCurrentPassword("");
    setNewEmail("");
    setNewPassword("");
    setConfirmNewPassword("");
    setSecurityError("");
    setSecuritySuccess("");
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError("");
    setSecuritySuccess("");
    setIsSecuritySaving(true);

    try {
      await updateEmailSecure(user.id!, currentPassword, newEmail);
      login({ ...user, email: newEmail }); // Mise à jour de la session
      setSecuritySuccess("Votre e-mail a été mis à jour avec succès.");
      setTimeout(resetSecurityForm, 2500); // Ferme le formulaire après 2.5s
    } catch (err: any) {
      setSecurityError(err.message);
    } finally {
      setIsSecuritySaving(false);
    }
  };

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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ margin: 0, color: "#1a1a1a", fontSize: "1.8rem" }}>
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

        <div style={cardStyle}>
          {/* En-tête */}
          <div style={headerStyle}>
            <div style={avatarLargeStyle}>{initials}</div>
            <div>
              <h3
                style={{
                  margin: "0 0 5px 0",
                  fontSize: "1.4rem",
                  color: "#1a1a1a",
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

          {/* Bloc Informations */}
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
              <span style={{ ...valueStyle, color: "#6b7280" }}>
                {user.email}
              </span>
            </div>
          </div>

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

          {/* --- Zone des Actions et Formulaires Sécurisés --- */}
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
                  color: "#1a1a1a",
                  fontSize: "1.1rem",
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

// --- STYLES ---
const containerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "20px 0",
};
const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "16px",
  padding: "30px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
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
  background: "#32a823",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "2rem",
  letterSpacing: "2px",
  boxShadow: "0 4px 15px rgba(50, 168, 35, 0.3)",
};
const roleBadgeStyle = (role: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "0.8rem",
  fontWeight: "600",
  background: role === "Admin" ? "#ecfdf5" : "#f3f4f6",
  color: role === "Admin" ? "#15803d" : "#4b5563",
});
const separatorStyle: React.CSSProperties = {
  height: "1px",
  background: "#f3f4f6",
  width: "100%",
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
  background: "#f9fafb",
  padding: "12px 15px",
  borderRadius: "8px",
};
const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: "#6b7280",
  fontWeight: "600",
};
const valueStyle: React.CSSProperties = {
  fontSize: "1rem",
  color: "#1f2937",
  fontWeight: "500",
};
const errorStyle: React.CSSProperties = {
  background: "#fee2e2",
  color: "#dc2626",
  padding: "12px",
  borderRadius: "8px",
  fontSize: "0.85rem",
  textAlign: "center",
  fontWeight: "500",
};
const successStyle: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
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
  border: "1px solid #d1d5db",
  fontSize: "0.95rem",
  outline: "none",
};
const editToggleButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #d1d5db",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "#4b5563",
};
const saveButtonStyle = (disabled: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "10px",
  background: disabled ? "#a5d6a7" : "#32a823",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontWeight: "600",
  cursor: disabled ? "not-allowed" : "pointer",
});
const cancelButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px",
  background: "#f3f4f6",
  color: "#4b5563",
  border: "none",
  borderRadius: "8px",
  fontWeight: "600",
  cursor: "pointer",
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
  color: "#4b5563",
  textDecoration: "underline",
  textUnderlineOffset: "4px",
};
const logoutLinkStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontSize: "0.95rem",
  fontWeight: "600",
  color: "#dc2626",
  textDecoration: "underline",
  textUnderlineOffset: "4px",
  marginTop: "10px",
};
const securityFormContainerStyle: React.CSSProperties = {
  background: "#f9fafb",
  padding: "20px",
  borderRadius: "10px",
  border: "1px solid #e5e7eb",
  marginTop: "5px",
};
