// ============================================================================
// IMPORTS
// ============================================================================

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../../api/authApi";
import { Icon } from "../../components/ui/Icon";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Public view letting users request a password reset link sent to their email.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  /**
   * Processes the password reset submission request using the authentication API.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await requestPasswordReset(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Header Block */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <span style={{ fontSize: "3rem" }}>
            <Icon
              name="lock"
              style={{ fontSize: "4rem", color: "var(--primary)" }}
            />
          </span>
          <h1
            style={{
              margin: "10px 0 5px 0",
              color: "var(--text-main)",
              fontSize: "1.5rem",
              transition: "var(--theme-transition)",
            }}
          >
            Mot de passe oublié
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--text-muted)",
              fontSize: "0.9rem",
              transition: "var(--theme-transition)",
            }}
          >
            Saisissez votre e-mail pour recevoir un lien de réinitialisation.
          </p>
        </div>

        {/* Error Alert Display */}
        {error && <div style={errorStyle}>{error}</div>}

        {/* Dynamic Status Render (Success Message vs Request Form) */}
        {success ? (
          <div style={successStyle}>
            Si ce compte existe, un e-mail de réinitialisation vient d'être
            envoyé à <strong>{email}</strong>.
            <br />
            <br />
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--status-charging)",
                transition: "var(--theme-transition)",
              }}
            >
              (Vérifiez la console du navigateur pour le lien de test)
            </span>
            <br />
            <br />
            <Link to="/login" style={linkStyle}>
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                placeholder="votre@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={buttonStyle(isSubmitting)}
            >
              {isSubmitting ? "Envoi en cours..." : "Envoyer le lien"}
            </button>

            <div style={{ textAlign: "center", marginTop: "10px" }}>
              <Link to="/login" style={linkStyle}>
                Annuler et retourner à la connexion
              </Link>
            </div>
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
