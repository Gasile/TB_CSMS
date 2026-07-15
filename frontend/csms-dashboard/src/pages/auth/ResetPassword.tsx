// ============================================================================
// IMPORTS
// ============================================================================

import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { resetPassword } from "../../api/authApi";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Public view allowing users to set a new password using a secure token extracted from the URL.
 */
export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  /**
   * Processes the password reset submission, verifying passwords match and token validity.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate password confirmation match
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    // Ensure the required reset token exists in the URL path parameters
    if (!token) {
      setError("Jeton de réinitialisation manquant dans l'URL.");
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la réinitialisation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Header Block */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <span style={{ fontSize: "3rem" }}>🔑</span>
          <h1
            style={{
              margin: "10px 0 5px 0",
              color: "var(--text-main)",
              fontSize: "1.5rem",
              transition: "var(--theme-transition)",
            }}
          >
            Nouveau mot de passe
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--text-muted)",
              fontSize: "0.9rem",
              transition: "var(--theme-transition)",
            }}
          >
            Veuillez choisir un nouveau mot de passe sécurisé.
          </p>
        </div>

        {/* Error Alert Display */}
        {error && <div style={errorStyle}>{error}</div>}

        {/* Dynamic Panel (Success Screen vs Form Inputs) */}
        {success ? (
          <div style={successStyle}>
            Votre mot de passe a été réinitialisé avec succès !
            <br />
            <br />
            <Link to="/login" style={linkStyle}>
              Aller à la page de connexion
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Nouveau mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                placeholder="••••••••"
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Confirmer le mot de passe</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={buttonStyle(isSubmitting)}
            >
              {isSubmitting
                ? "Enregistrement..."
                : "Réinitialiser le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STYLES & LAYOUTS (INLINE CSS VARIABLES ADAPTATION)
// ============================================================================

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  background: "var(--bg-app)",
  transition: "var(--theme-transition)",
};

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  padding: "40px",
  borderRadius: "16px",
  border: "1px solid var(--border-color)",
  boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
  width: "100%",
  maxWidth: "400px",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
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
  transition: "var(--theme-transition)",
};

const successStyle: React.CSSProperties = {
  background: "rgba(16, 185, 129, 0.15)",
  color: "var(--status-charging)",
  padding: "20px",
  borderRadius: "10px",
  fontSize: "0.9rem",
  textAlign: "center",
  lineHeight: "1.5",
  transition: "var(--theme-transition)",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  transition: "var(--theme-transition)",
};

const inputStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid var(--border-color)",
  background: "var(--bg-app)",
  color: "var(--text-main)",
  fontSize: "1rem",
  outline: "none",
  transition: "var(--theme-transition)",
};

const linkStyle: React.CSSProperties = {
  color: "var(--primary)",
  textDecoration: "none",
  fontSize: "0.9rem",
  fontWeight: "600",
  transition: "var(--theme-transition)",
};

const buttonStyle = (disabled: boolean): React.CSSProperties => ({
  marginTop: "10px",
  padding: "16px",
  borderRadius: "10px",
  border: "none",
  background: disabled ? "var(--border-color)" : "var(--primary)",
  color: "#fff",
  fontSize: "1rem",
  fontWeight: "bold",
  cursor: disabled ? "not-allowed" : "pointer",
  transition: "var(--theme-transition)",
});
