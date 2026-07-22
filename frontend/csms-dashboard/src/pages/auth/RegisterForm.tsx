// ============================================================================
// IMPORTS
// ============================================================================

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { registerUser } from "../../api/authApi";
import { Icon } from "../../components/ui/Icon";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Public registration view allowing new users to sign up for the platform.
 */
export default function RegisterForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  /**
   * Processes the signup submission, validating password matching first.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Confirm passwords match before initiating network registration request
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsSubmitting(true);

    try {
      await registerUser(firstName, lastName, email, password);
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
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <span style={{ fontSize: "3rem" }}>
            <Icon
              name="person_add"
              style={{ fontSize: "4rem", color: "var(--primary)" }}
            />
          </span>
          <h1
            style={{
              margin: "10px 0 0 0",
              color: "var(--text-main)",
              fontSize: "1.8rem",
              transition: "var(--theme-transition)",
            }}
          >
            Créer un compte
          </h1>
        </div>

        {/* Error Alert Display */}
        {error && <div style={errorStyle}>{error}</div>}

        {/* Dynamic Panel (Success Screen vs Form Inputs) */}
        {success ? (
          <div style={successStyle}>
            <h3>Compte créé avec succès ! 🎉</h3>
            <p
              style={{
                marginTop: "10px",
                fontSize: "0.9rem",
                color: "var(--status-charging)",
                transition: "var(--theme-transition)",
              }}
            >
              Votre profil est désormais enregistré. Vous pouvez vous connecter
              dès maintenant.
            </p>
            <br />
            <Link to="/login" style={linkStyle}>
              Aller à la page de connexion
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "15px" }}
          >
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Prénom</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={inputStyle}
                placeholder="Jean"
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Nom</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={inputStyle}
                placeholder="Dupont"
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                placeholder="jean.dupont@exemple.com"
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Mot de passe</label>
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
              {isSubmitting ? "Création en cours..." : "Créer un compte"}
            </button>

            <div style={{ textAlign: "center", marginTop: "10px" }}>
              <span
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.9rem",
                  transition: "var(--theme-transition)",
                }}
              >
                Déjà un compte ?{" "}
              </span>
              <Link to="/login" style={linkStyle}>
                Se connecter
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
  maxWidth: "450px",
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
  padding: "25px",
  borderRadius: "10px",
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
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid var(--border-color)",
  background: "var(--bg-app)",
  color: "var(--text-main)",
  fontSize: "0.95rem",
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
