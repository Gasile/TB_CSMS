import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import UserBadges from "../badges/UserBadges";
import UserSessions from "../sessions/UserSessions";
import { fetchUserById, updateUserDetails } from "../../api/userApi";

const emojiStyle: React.CSSProperties = {
  background: "var(--gradient-primary)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  display: "inline-block",
  lineHeight: "1.2",
};

export default function UserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const numericUserId = Number(userId);

  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "User",
  });
  const [loading, setLoading] = useState(true);

  const [isBackHovered, setIsBackHovered] = useState(false);
  const [isSaveHovered, setIsSaveHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false); // Nouvel état pour le bouton supprimer

  useEffect(() => {
    const loadUserDetails = async () => {
      if (!numericUserId) return;
      try {
        const data = await fetchUserById(numericUserId);
        if (data) setEditForm(data);
      } catch (err) {
        console.error("Erreur chargement utilisateur :", err);
      } finally {
        setLoading(false);
      }
    };
    loadUserDetails();
  }, [numericUserId]);

  const handleSave = async () => {
    try {
      await updateUserDetails(
        numericUserId,
        editForm.first_name,
        editForm.last_name,
        editForm.email,
        editForm.role,
      );
      alert("Informations mises à jour avec succès !");
    } catch (err) {
      alert("Erreur lors de la sauvegarde.");
    }
  };

  // NOUVEAU : Fonction de suppression
  const handleDelete = async () => {
    if (
      !window.confirm(
        "Voulez-vous vraiment supprimer cet utilisateur ? Cette action est irréversible et supprimera son historique.",
      )
    ) {
      return;
    }

    try {
      const mutation = {
        query: `
          mutation DeleteUser($id: Int!) {
            delete_Users_by_pk(id: $id) { id }
          }
        `,
        variables: { id: numericUserId },
      };

      const response = await fetch("http://localhost:8090/v1/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hasura-admin-secret": "TBCSMS",
        },
        body: JSON.stringify(mutation),
      });
      const result = await response.json();

      if (result.errors) throw new Error(result.errors[0].message);

      alert("Utilisateur supprimé avec succès !");
      navigate("/dashboard/admin-users");
    } catch (err: any) {
      alert(`Erreur de suppression : ${err.message}`);
    }
  };

  const handleBack = () => navigate("/dashboard/admin-users");

  if (loading)
    return (
      <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
        Chargement du dossier utilisateur...
      </p>
    );

  const targetUserSession = {
    id: numericUserId,
    firstName: editForm.first_name || "Inconnu",
    lastName: editForm.last_name || "Inconnu",
    email: editForm.email || "",
    role: editForm.role || "User",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "30px",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "800px", textAlign: "left" }}>
        <button
          onClick={handleBack}
          onMouseEnter={() => setIsBackHovered(true)}
          onMouseLeave={() => setIsBackHovered(false)}
          style={getBackButtonStyle(isBackHovered)}
        >
          <span style={{ marginRight: "8px", ...emojiStyle }}>🔙</span> Retour à
          la liste
        </button>
      </div>

      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>
          <span style={{ marginRight: "10px", ...emojiStyle }}>⚙️</span>
          Informations Personnelles
        </h3>

        <div style={gridStyle}>
          <div style={fieldBoxStyle}>
            <label style={labelStyle}>Prénom</label>
            <input
              value={editForm.first_name}
              onChange={(e) =>
                setEditForm({ ...editForm, first_name: e.target.value })
              }
              style={inputStyle}
            />
          </div>

          <div style={fieldBoxStyle}>
            <label style={labelStyle}>Nom</label>
            <input
              value={editForm.last_name}
              onChange={(e) =>
                setEditForm({ ...editForm, last_name: e.target.value })
              }
              style={inputStyle}
            />
          </div>

          <div style={fieldBoxStyle}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={editForm.email}
              onChange={(e) =>
                setEditForm({ ...editForm, email: e.target.value })
              }
              style={inputStyle}
            />
          </div>

          <div style={fieldBoxStyle}>
            <label style={labelStyle}>Rôle</label>
            <select
              value={editForm.role}
              onChange={(e) =>
                setEditForm({ ...editForm, role: e.target.value })
              }
              style={inputStyle}
            >
              <option
                value="User"
                style={{
                  background: "var(--bg-deep)",
                  color: "var(--text-primary)",
                }}
              >
                User
              </option>
              <option
                value="Admin"
                style={{
                  background: "var(--bg-deep)",
                  color: "var(--text-primary)",
                }}
              >
                Admin
              </option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "15px", marginTop: "25px" }}>
          <button
            onClick={handleSave}
            onMouseEnter={() => setIsSaveHovered(true)}
            onMouseLeave={() => setIsSaveHovered(false)}
            style={getSaveButtonStyle(isSaveHovered)}
          >
            Enregistrer les modifications
          </button>

          {/* NOUVEAU BOUTON SUPPRIMER */}
          <button
            onClick={handleDelete}
            onMouseEnter={() => setIsDeleteHovered(true)}
            onMouseLeave={() => setIsDeleteHovered(false)}
            style={getDeleteButtonStyle(isDeleteHovered)}
          >
            <span style={{ marginRight: "5px" }}>🗑️</span> Supprimer
            l'utilisateur
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "30px",
          width: "100%",
          alignItems: "center",
        }}
      >
        {targetUserSession.id ? <UserBadges user={targetUserSession} /> : null}
        {targetUserSession.id ? (
          <UserSessions user={targetUserSession} />
        ) : null}
      </div>
    </div>
  );
}

const getBackButtonStyle = (isHovered: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 18px",
  backgroundColor: isHovered ? "var(--bg-input)" : "transparent",
  color: isHovered ? "var(--text-primary)" : "var(--text-secondary)",
  border: `1px solid ${isHovered ? "var(--text-secondary)" : "var(--color-border)"}`,
  borderRadius: "12px",
  cursor: "pointer",
  fontSize: "0.9em",
  fontWeight: "600",
  transition: "var(--transition-standard)",
});

const cardStyle: React.CSSProperties = {
  border: "3px solid transparent",
  background: `linear-gradient(var(--bg-card), var(--bg-card)) padding-box, var(--gradient-primary) border-box`,
  padding: "40px",
  borderRadius: "50px",
  boxShadow: "var(--shadow-card)",
  width: "100%",
  maxWidth: "800px",
  boxSizing: "border-box",
};

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: "25px",
  fontSize: "1.4em",
  color: "var(--text-primary)",
  letterSpacing: "0.5px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "20px",
};
const fieldBoxStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};
const labelStyle: React.CSSProperties = {
  fontSize: "0.8em",
  color: "var(--text-mute)",
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontWeight: "700",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 15px",
  backgroundColor: "var(--bg-input)",
  color: "var(--text-primary)",
  border: `1px solid var(--color-border)`,
  borderRadius: "10px",
  fontSize: "1em",
  outline: "none",
  boxSizing: "border-box",
  transition: "var(--transition-standard)",
};

const getSaveButtonStyle = (isHovered: boolean): React.CSSProperties => ({
  padding: "12px 25px",
  background: "var(--gradient-primary)",
  color: "white",
  border: "none",
  borderRadius: "12px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "1em",
  transition: "var(--transition-standard)",
  opacity: isHovered ? 0.9 : 1,
  boxShadow: isHovered ? "0 10px 30px rgba(0, 230, 118, 0.3)" : "none",
  transform: isHovered ? "translateY(-2px)" : "none",
});

const getDeleteButtonStyle = (isHovered: boolean): React.CSSProperties => ({
  padding: "12px 20px",
  backgroundColor: isHovered ? "rgba(255, 82, 82, 0.15)" : "transparent",
  color: "var(--error-color)",
  border: `1px solid ${isHovered ? "var(--error-color)" : "var(--color-border)"}`,
  borderRadius: "12px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "1em",
  transition: "var(--transition-standard)",
});
