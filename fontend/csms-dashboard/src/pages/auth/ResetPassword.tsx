import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { resetPassword } from "../../api/authApi";

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>(); // Récupère le token depuis l'URL

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

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
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <span style={{ fontSize: "3rem" }}>🔑</span>
          <h1
            style={{
              margin: "10px 0 5px 0",
              color: "#1a1a1a",
              fontSize: "1.5rem",
            }}
          >
            Nouveau mot de passe
          </h1>
          <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
            Veuillez choisir un nouveau mot de passe sécurisé.
          </p>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

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
  width: "100%",
  maxWidth: "400px",
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
const successStyle: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  padding: "20px",
  borderRadius: "10px",
  fontSize: "0.9rem",
  textAlign: "center",
  lineHeight: "1.5",
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
const linkStyle: React.CSSProperties = {
  color: "#32a823",
  textDecoration: "none",
  fontSize: "0.9rem",
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
});
