import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { updateMyProfile } from "../../api/userApi";

const emojiStyle: React.CSSProperties = {
  background: "var(--gradient-primary)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  display: "inline-block",
  lineHeight: "1.2",
};

export default function UserProfile() {
  const { user } = useAuth();
  const [isBtnHovered, setIsBtnHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  if (!user) return null;

  const [profileData, setProfileData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email || "",
  });

  const [editForm, setEditForm] = useState({ ...profileData });

  const initials =
    `${profileData.firstName?.charAt(0) || ""}${profileData.lastName?.charAt(0) || ""}`.toUpperCase();

  const handleSave = async () => {
    if (!user.id) return;
    try {
      await updateMyProfile(
        user.id,
        editForm.firstName,
        editForm.lastName,
        editForm.email,
      );
      setProfileData({ ...editForm });
      setIsEditing(false);
      alert("Vos informations ont été mises à jour avec succès !");
    } catch (err) {
      alert("Erreur lors de la sauvegarde.");
    }
  };

  return (
    <div style={profileCardStyle}>
      <div style={profileHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "25px" }}>
          <div style={avatarStyle}>{initials}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <h2 style={nameStyle}>
              {profileData.firstName} {profileData.lastName}
            </h2>

            {user.role === "Admin" && (
              <span style={getRoleBadgeStyle()}>
                <span style={{ marginRight: "6px", ...emojiStyle }}>🔒</span>{" "}
                Profil Administrateur
              </span>
            )}
          </div>
        </div>

        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            onMouseEnter={() => setIsBtnHovered(true)}
            onMouseLeave={() => setIsBtnHovered(false)}
            style={getEditButtonStyle(isBtnHovered)}
          >
            <span style={{ marginRight: "8px", ...emojiStyle }}>✏️</span>{" "}
            Modifier mes infos
          </button>
        )}
      </div>

      <div
        style={{
          height: "3px",
          background: "var(--gradient-primary)",
          margin: "35px 0",
          borderRadius: "2px",
        }}
      />

      <h3 style={sectionTitleStyle}>Informations du compte</h3>

      {isEditing ? (
        <div style={gridStyle}>
          <div style={fieldBoxStyle}>
            <label style={labelStyle}>Prénom</label>
            <input
              value={editForm.firstName}
              onChange={(e) =>
                setEditForm({ ...editForm, firstName: e.target.value })
              }
              style={inputStyle}
            />
          </div>
          <div style={fieldBoxStyle}>
            <label style={labelStyle}>Nom</label>
            <input
              value={editForm.lastName}
              onChange={(e) =>
                setEditForm({ ...editForm, lastName: e.target.value })
              }
              style={inputStyle}
            />
          </div>
          <div style={{ ...fieldBoxStyle, gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Identifiant de connexion (Email)</label>
            <input
              type="email"
              value={editForm.email}
              onChange={(e) =>
                setEditForm({ ...editForm, email: e.target.value })
              }
              style={inputStyle}
            />
          </div>
          <div
            style={{
              gridColumn: "span 2",
              display: "flex",
              gap: "15px",
              marginTop: "10px",
            }}
          >
            <button onClick={handleSave} style={saveButtonStyle}>
              Enregistrer
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditForm({ ...profileData });
              }}
              style={cancelButtonStyle}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div style={gridStyle}>
          <div style={fieldBoxStyle}>
            <label style={labelStyle}>Prénom</label>
            <div style={valueStyle}>{profileData.firstName || "-"}</div>
          </div>
          <div style={fieldBoxStyle}>
            <label style={labelStyle}>Nom</label>
            <div style={valueStyle}>{profileData.lastName || "-"}</div>
          </div>
          <div style={{ ...fieldBoxStyle, gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Identifiant de connexion (Email)</label>
            <div style={valueStyle}>{profileData.email || "-"}</div>
          </div>
        </div>
      )}
    </div>
  );
}

const profileCardStyle: React.CSSProperties = {
  border: "3px solid transparent",
  background: `linear-gradient(var(--bg-card), var(--bg-card)) padding-box, var(--gradient-primary) border-box`,
  padding: "40px",
  borderRadius: "50px",
  boxShadow: "var(--shadow-card)",
  width: "fit-content",
  minWidth: "660px",
  margin: "0 auto",
};

const profileHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "20px",
};

const avatarStyle: React.CSSProperties = {
  width: "85px",
  height: "85px",
  borderRadius: "50%",
  background: "var(--gradient-primary)",
  color: "#fff",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: "1.8em",
  fontWeight: "bold",
  boxShadow: "var(--shadow-avatar)",
  letterSpacing: "0.5px",
};

const nameStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "2.2em",
  fontWeight: "bold",
  color: "var(--text-primary)",
  letterSpacing: "-0.5px",
};

const getRoleBadgeStyle = (): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  padding: "6px 14px",
  borderRadius: "20px",
  backgroundColor: "var(--bg-admin-active)",
  color: "var(--color-admin)",
  border: `1px solid var(--color-admin)`,
  fontSize: "0.85em",
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
});

const getEditButtonStyle = (isHovered: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  padding: "12px 22px",
  backgroundColor: isHovered ? "var(--bg-user-active)" : "transparent",
  color: isHovered ? "var(--color-user)" : "var(--text-secondary)",
  border: `1px solid ${isHovered ? "var(--color-user)" : "var(--color-border)"}`,
  borderRadius: "14px",
  fontSize: "0.95em",
  fontWeight: "600",
  cursor: "pointer",
  transition: "var(--transition-standard)",
});

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 25px 0",
  fontSize: "1.2em",
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "1.5px",
  fontWeight: "600",
};
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "25px",
};
const fieldBoxStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  backgroundColor: "var(--bg-input)",
  padding: "18px 24px",
  borderRadius: "18px",
  border: `1px solid var(--color-border)`,
};
const labelStyle: React.CSSProperties = {
  fontSize: "0.78em",
  color: "var(--text-mute)",
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontWeight: "700",
};
const valueStyle: React.CSSProperties = {
  fontSize: "1.15em",
  color: "var(--text-primary)",
  fontWeight: "500",
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
const saveButtonStyle: React.CSSProperties = {
  background: "var(--gradient-primary)",
  color: "#fff",
  border: "none",
  padding: "12px 25px",
  borderRadius: "12px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "1em",
  transition: "var(--transition-standard)",
};
const cancelButtonStyle: React.CSSProperties = {
  backgroundColor: "transparent",
  color: "var(--text-secondary)",
  border: `1px solid var(--color-border)`,
  padding: "12px 25px",
  borderRadius: "12px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "1em",
  transition: "var(--transition-standard)",
};
