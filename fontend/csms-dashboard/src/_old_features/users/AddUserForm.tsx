import React, { useState } from "react";
import { createNewUser } from "../../api/adminApi";

export default function AddUserForm({
  onUserAdded,
  onCancel,
}: {
  onUserAdded: () => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    first: "",
    last: "",
    email: "",
    pass: "",
    role: "User",
  });

  const [isHovered, setIsHovered] = useState(false);
  const [isCancelHovered, setIsCancelHovered] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createNewUser(
        formData.first,
        formData.last,
        formData.email,
        formData.pass,
        formData.role,
      );
      alert("Utilisateur créé avec succès !");
      setFormData({ first: "", last: "", email: "", pass: "", role: "User" });
      onUserAdded();
    } catch (err: any) {
      alert(`Erreur lors de la création : ${err.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={formBoxStyle}>
      <h4
        style={{
          margin: "0 0 15px 0",
          color: "var(--text-primary)",
          fontSize: "1.2em",
        }}
      >
        Ajouter un nouvel utilisateur
      </h4>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "15px",
          alignItems: "end",
        }}
      >
        <div>
          <label style={labelStyle}>Prénom</label>
          <input
            placeholder="Ex: Jean"
            value={formData.first}
            onChange={(e) =>
              setFormData({ ...formData, first: e.target.value })
            }
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Nom</label>
          <input
            placeholder="Ex: Dupont"
            value={formData.last}
            onChange={(e) => setFormData({ ...formData, last: e.target.value })}
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Email</label>
          <input
            placeholder="jean.dupont@email.com"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Mot de passe</label>
          <input
            placeholder="••••••••"
            type="password"
            value={formData.pass}
            onChange={(e) => setFormData({ ...formData, pass: e.target.value })}
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Rôle</label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            style={inputStyle}
          >
            <option
              value="User"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-primary)",
              }}
            >
              User
            </option>
            <option
              value="Admin"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-primary)",
              }}
            >
              Admin
            </option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="submit"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={getSubmitButtonStyle(isHovered)}
          >
            Créer
          </button>
          <button
            type="button"
            onClick={onCancel}
            onMouseEnter={() => setIsCancelHovered(true)}
            onMouseLeave={() => setIsCancelHovered(false)}
            style={getCancelButtonStyle(isCancelHovered)}
          >
            Annuler
          </button>
        </div>
      </div>
    </form>
  );
}

// STYLES
const formBoxStyle: React.CSSProperties = {
  marginTop: "20px",
  marginBottom: "35px",
  padding: "25px",
  backgroundColor: "var(--bg-input)",
  borderRadius: "20px",
  border: `1px solid var(--color-border)`,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75em",
  color: "var(--text-mute)",
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontWeight: "700",
  marginBottom: "8px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 15px",
  backgroundColor: "var(--bg-card)",
  color: "var(--text-primary)",
  border: `1px solid var(--color-border)`,
  borderRadius: "10px",
  fontSize: "1em",
  outline: "none",
  boxSizing: "border-box",
  transition: "var(--transition-standard)",
};

const getSubmitButtonStyle = (isHovered: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "12px 15px",
  background: "var(--gradient-primary)",
  color: "white",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "1em",
  transition: "var(--transition-standard)",
  opacity: isHovered ? 0.9 : 1,
});

const getCancelButtonStyle = (isHovered: boolean): React.CSSProperties => ({
  padding: "12px 15px",
  backgroundColor: "transparent",
  color: isHovered ? "var(--text-primary)" : "var(--text-secondary)",
  border: `1px solid ${isHovered ? "var(--text-primary)" : "var(--color-border)"}`,
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "1em",
  transition: "var(--transition-standard)",
});
