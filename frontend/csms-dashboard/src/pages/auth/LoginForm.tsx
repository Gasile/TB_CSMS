import React, { useState } from "react";
import { Link } from "react-router-dom";
import { loginUser } from "../../api/authApi";

export default function LoginForm({
  onLoginSuccess,
}: {
  onLoginSuccess: (user: any) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    setError("");
    setIsLoading(true);

    try {
      // Ton API fait le fetch, le hash, et renvoie directement la session formatée !
      const session = await loginUser(loginEmail, loginPassword);
      onLoginSuccess(session);
    } catch (err: any) {
      setError(err.message || "Erreur de connexion.");
    } finally {
      setIsLoading(false);
    }
  };

  // Soumission classique via le formulaire
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(email, password);
  };

  // --- NOUVEAU : Raccourcis One-Click ---
  const handleQuickLogin = (role: "Admin" | "User") => {
    if (role === "Admin") {
      performLogin("basile.gasser@hes-so.ch", "TBCSMS");
    } else {
      performLogin("jessica.udry@hes-so.ch", "JESSICA");
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
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <span style={{ fontSize: "3rem" }}>🔌</span>
            <h1
              style={{
                margin: "10px 0 5px 0",
                color: "#1a1a1a",
                fontSize: "1.8rem",
              }}
            >
              CSMS Network
            </h1>
            <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
              Veuillez vous identifier
            </p>
          </div>

          {error && <div style={errorStyle}>{error}</div>}

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

          <button
            type="submit"
            disabled={isLoading}
            style={buttonStyle(isLoading)}
          >
            {isLoading ? "Connexion..." : "Se connecter"}
          </button>
          <div style={{ textAlign: "center", marginTop: "15px" }}>
            <span style={{ color: "#666", fontSize: "0.9rem" }}>
              Pas encore de compte ?{" "}
            </span>
            <Link
              to="/register"
              style={{
                color: "#32a823",
                textDecoration: "none",
                fontWeight: "600",
                fontSize: "0.9rem",
              }}
            >
              Créer un compte
            </Link>
          </div>
        </form>

        <div style={devShortcutsStyle}>
          <p
            style={{
              margin: "0 0 8px 0",
              fontSize: "0.75rem",
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: "1px",
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

// --- STYLES ---
const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
};
const cardStyle: React.CSSProperties = {
  background: "#fff",
  padding: "40px",
  borderRadius: "16px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
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
const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};
const labelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "#444",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};
const inputStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "1rem",
  outline: "none",
  transition: "border-color 0.2s",
};
const forgotLinkStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "#32a823",
  textDecoration: "none",
  fontWeight: "600",
};
const buttonStyle = (disabled: boolean): React.CSSProperties => ({
  marginTop: "10px",
  padding: "16px",
  borderRadius: "10px",
  border: "none",
  background: disabled ? "#a5d6a7" : "#32a823",
  color: "#fff",
  fontSize: "1rem",
  fontWeight: "bold",
  cursor: disabled ? "not-allowed" : "pointer",
  transition: "background 0.2s",
});

const devShortcutsStyle: React.CSSProperties = {
  textAlign: "center",
  marginTop: "10px",
};
const devButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px dashed #bbb",
  background: "transparent",
  color: "#666",
  fontSize: "0.85rem",
  cursor: "pointer",
  fontWeight: "600",
};
