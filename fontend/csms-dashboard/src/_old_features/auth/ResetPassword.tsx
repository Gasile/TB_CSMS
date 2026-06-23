import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { resetPassword } from "../../api/authApi";

const BORDER_RADIUS = {
  large: "40px",
  medium: "10px",
};

export default function ResetPassword() {
  // Récupération du "token" depuis l'URL (ex: /reset-password/abc-123)
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isMainButtonHovered, setIsMainButtonHovered] = useState(false);
  const [isPass1Focused, setIsPass1Focused] = useState(false);
  const [isPass2Focused, setIsPass2Focused] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!token) {
      setError("Le lien de réinitialisation est invalide ou corrompu.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setIsLoading(true);

    try {
      // Appel à notre API avec le jeton de l'URL et le nouveau mot de passe
      await resetPassword(token, newPassword);
      setSuccessMessage("Votre mot de passe a été mis à jour avec succès !");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={outerContainerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={logoIconStyle}>🔌</div>
          <h1 style={titleStyle}>CSMS Network</h1>
          <p style={subtitleStyle}>Créez votre nouveau mot de passe</p>
        </div>

        {!successMessage ? (
          <form onSubmit={handleReset} style={formStyle}>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Nouveau mot de passe</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                onFocus={() => setIsPass1Focused(true)}
                onBlur={() => setIsPass1Focused(false)}
                style={getInputStyle(isPass1Focused)}
                required
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                onFocus={() => setIsPass2Focused(true)}
                onBlur={() => setIsPass2Focused(false)}
                style={getInputStyle(isPass2Focused)}
                required
              />
            </div>

            <div style={statusAreaStyle}>
              {error && <p style={errorTextStyle}>❌ {error}</p>}
              {isLoading && (
                <p style={loadingTextStyle}>Mise à jour en cours...</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              onMouseEnter={() => setIsMainButtonHovered(true)}
              onMouseLeave={() => setIsMainButtonHovered(false)}
              style={getMainButtonStyle(isMainButtonHovered, isLoading)}
            >
              {isLoading ? "Un instant..." : "Mettre à jour le mot de passe"}
            </button>

            <div style={{ textAlign: "center", marginTop: "10px" }}>
              <span
                onClick={() => navigate("/")}
                style={forgotPasswordLinkStyle}
              >
                🔙 Annuler et retourner à la connexion
              </span>
            </div>
          </form>
        ) : (
          <div
            style={{
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <p style={successTextStyle}>✅ {successMessage}</p>
            <button
              onClick={() => navigate("/")}
              onMouseEnter={() => setIsMainButtonHovered(true)}
              onMouseLeave={() => setIsMainButtonHovered(false)}
              style={getMainButtonStyle(isMainButtonHovered, false)}
            >
              Retour à la connexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// --- STYLES EN LIGNE AVEC VARIABLES CSS ---
// ==========================================

const outerContainerStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "var(--bg-deep)",
  boxSizing: "border-box",
};

const cardStyle: React.CSSProperties = {
  border: "3px solid transparent",
  background: `linear-gradient(var(--bg-card), var(--bg-card)) padding-box, var(--gradient-primary) border-box`,
  padding: "40px 50px",
  borderRadius: "50px",
  width: "100%",
  maxWidth: "480px",
  boxShadow: "0 15px 50px rgba(0,0,0,0.6)",
  boxSizing: "border-box",
};

const headerStyle: React.CSSProperties = {
  textAlign: "center",
  marginBottom: "40px",
};

const logoIconStyle: React.CSSProperties = {
  fontSize: "3em",
  background: "var(--gradient-primary)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  marginBottom: "10px",
  fontWeight: "bold",
  display: "inline-block",
  lineHeight: "1.2",
  padding: "0 5px",
};

const titleStyle: React.CSSProperties = {
  margin: "0",
  fontSize: "2.2em",
  fontWeight: "bold",
  color: "var(--text-primary)",
  letterSpacing: "-1px",
};
const subtitleStyle: React.CSSProperties = {
  margin: "8px 0 0 0",
  fontSize: "1em",
  color: "var(--text-secondary)",
  fontWeight: "normal",
};
const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};
const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};
const labelStyle: React.CSSProperties = {
  fontSize: "0.9em",
  color: "var(--text-secondary)",
  fontWeight: "500",
  textTransform: "uppercase",
  letterSpacing: "1px",
  textAlign: "left",
};

const getInputStyle = (isFocused: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "16px 20px",
  backgroundColor: "var(--bg-input)",
  color: "var(--text-primary)",
  border: `2px solid ${isFocused ? "var(--color-user)" : "var(--color-border)"}`,
  borderRadius: BORDER_RADIUS.medium,
  fontSize: "1em",
  transition: "var(--transition-standard)",
  outline: "none",
  boxSizing: "border-box",
});

const getMainButtonStyle = (
  isHovered: boolean,
  isLoading: boolean,
): React.CSSProperties => ({
  background: isLoading ? "var(--color-border)" : "var(--gradient-primary)",
  color: "#fff",
  border: "none",
  padding: "16px 20px",
  borderRadius: BORDER_RADIUS.medium,
  fontSize: "1.1em",
  fontWeight: "bold",
  cursor: isLoading ? "not-allowed" : "pointer",
  transition: "var(--transition-standard)",
  marginTop: "10px",
  boxShadow:
    isHovered && !isLoading ? "0 10px 30px rgba(0, 230, 118, 0.3)" : "none",
  transform: isHovered && !isLoading ? "translateY(-2px)" : "none",
});

const statusAreaStyle: React.CSSProperties = {
  minHeight: "25px",
  textAlign: "center",
};
const errorTextStyle: React.CSSProperties = {
  color: "var(--error-color)",
  fontSize: "0.9em",
  margin: "0",
  fontWeight: "500",
};
const successTextStyle: React.CSSProperties = {
  color: "var(--color-user)",
  fontSize: "1.1em",
  margin: "0",
  fontWeight: "bold",
};
const loadingTextStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "0.9em",
  margin: "0",
  fontStyle: "italic",
};
const forgotPasswordLinkStyle: React.CSSProperties = {
  fontSize: "0.85em",
  color: "var(--text-mute)",
  textDecoration: "none",
  cursor: "pointer",
  transition: "var(--transition-standard)",
};
