// ============================================================================
// IMPORTS
// ============================================================================

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { loginUser } from "../../api/authApi";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Public authentication view rendering the login form and quick access shortcuts for development.
 */
export default function LoginForm({
  onLoginSuccess,
}: {
  onLoginSuccess: (user: any, token: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Orchestrates the user login cycle against the Go Auth API.
   */
  const performLogin = async (loginEmail: string, loginPassword: string) => {
    setError("");
    setIsLoading(true);

    try {
      const { user, token } = await loginUser(loginEmail, loginPassword);
      onLoginSuccess(user, token);
    } catch (err: any) {
      setError(err.message || "Erreur de connexion.");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Intercepts standard form submission to prevent page refreshes.
   */
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(email, password);
  };

  /**
   * Helper bypass to allow instant profile authentication during development.
   */
  const handleQuickLogin = (role: "Admin" | "User") => {
    if (role === "Admin") {
      performLogin("basile.gasser@hes-so.ch", "TBCSMS");
    } else {
      performLogin("christop.metraill@hes-so.ch", "1234");
    }
  };

  return (
    <div style={containerStyle}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          width: "100%",
          maxWidth: "400px",
        }}
      >
        <form onSubmit={handleFormSubmit} style={cardStyle}>
          {/* Header Identity Block */}
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <span style={{ fontSize: "3rem" }}>🔌</span>
            <h1
              style={{
                margin: "10px 0 5px 0",
                color: "var(--text-main)",
                fontSize: "1.8rem",
                transition: "var(--theme-transition)",
              }}
            >
              CSMS Network
            </h1>
            <p
              style={{
                margin: 0,
                color: "var(--text-muted)",
                fontSize: "0.9rem",
                transition: "var(--theme-transition)",
              }}
            >
              Veuillez vous identifier
            </p>
          </div>

          {/* Error Alert Display */}
          {error && <div style={errorStyle}>{error}</div>}

          {/* Input Fields */}
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

          <div style={inputGroupStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <label style={labelStyle}>Mot de passe</label>
              <Link to="/forgot-password" style={forgotLinkStyle}>
                Oublié ?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
            />
          </div>

          {/* Action Trigger */}
          <button
            type="submit"
            disabled={isLoading}
            style={buttonStyle(isLoading)}
          >
            {isLoading ? "Connexion..." : "Se connecter"}
          </button>

          <div style={{ textAlign: "center", marginTop: "15px" }}>
            <span
              style={{
                color: "var(--text-muted)",
                fontSize: "0.9rem",
                transition: "var(--theme-transition)",
              }}
            >
              Pas encore de compte ?{" "}
            </span>
            <Link
              to="/register"
              style={{
                color: "var(--primary)",
                textDecoration: "none",
                fontWeight: "600",
                fontSize: "0.9rem",
                transition: "var(--theme-transition)",
              }}
            >
              Créer un compte
            </Link>
          </div>
        </form>

        {/* Development Shortcuts Block */}
        <div style={devShortcutsStyle}>
          <p
            style={{
              margin: "0 0 8px 0",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              transition: "var(--theme-transition)",
            }}
          >
            Connexion rapide (Dev)
          </p>
          <div
            style={{ display: "flex", gap: "10px", justifyContent: "center" }}
          >
            <button
              type="button"
              onClick={() => handleQuickLogin("Admin")}
              style={devButtonStyle}
            >
              👑 Admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin("User")}
              style={devButtonStyle}
            >
              👤 User
            </button>
          </div>
        </div>
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

const forgotLinkStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "var(--primary)",
  textDecoration: "none",
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

const devShortcutsStyle: React.CSSProperties = {
  textAlign: "center",
  marginTop: "10px",
};

const devButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px dashed var(--border-color)",
  background: "var(--bg-card)",
  color: "var(--text-main)",
  fontSize: "0.85rem",
  cursor: "pointer",
  fontWeight: "600",
  transition: "var(--theme-transition)",
};
