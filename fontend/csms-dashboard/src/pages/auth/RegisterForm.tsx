import React, { useState } from "react";
import { Link } from "react-router-dom";
import { registerUser } from "../../api/authApi"; //

export default function RegisterForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Appel direct à ton API
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
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <span style={{ fontSize: "3rem" }}>✨</span>
          <h1
            style={{
              margin: "10px 0 0 0",
              color: "#1a1a1a",
              fontSize: "1.8rem",
            }}
          >
            Créer un compte
          </h1>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {success ? (
          <div style={successStyle}>
            <h3>Compte créé avec succès ! 🎉</h3>
            <p
              style={{
                marginTop: "10px",
                fontSize: "0.9rem",
                color: "#166534",
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
            {/* --- MODIFICATION ICI : Prénom et Nom empilés --- */}
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
            {/* ----------------------------------------------- */}

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
              <span style={{ color: "#666", fontSize: "0.9rem" }}>
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
  maxWidth: "450px",
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
  padding: "25px",
  borderRadius: "10px",
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
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  fontSize: "0.95rem",
  outline: "none",
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
