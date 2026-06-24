import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Topbar() {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  // Génération dynamique des initiales (ex: Basile Gasser -> BG)
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : "??";

  return (
    <header style={headerStyle}>
      {/* Partie Gauche : Titre */}
      <div
        onClick={() => {
          logout(); // On détruit la session
          navigate("/login"); // On redirige
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          cursor: "pointer",
        }}
        title="Se déconnecter et retourner au Login"
      >
        <span style={{ fontSize: "1.5rem" }}>🔌</span>
        <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#1a1a1a" }}>
          CSMS Network
        </h2>
      </div>

      {/* Partie Droite : Actions utilisateur */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        {/* Bouton Thème (Factice pour l'instant) */}
        <button style={themeButtonStyle} title="Changer le thème">
          🌙
        </button>

        {/* Zone Profil cliquable */}
        <div style={{ position: "relative" }}>
          <div
            style={profileZoneStyle}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            {/* Pastille Avatar */}
            <div style={avatarStyle}>{initials}</div>

            {/* Nom de l'utilisateur */}
            <span
              style={{ fontWeight: "600", fontSize: "0.9rem", color: "#444" }}
            >
              {user?.firstName} {user?.lastName.charAt(0)}.
            </span>

            {/* Petite flèche */}
            <span
              style={{
                fontSize: "0.8rem",
                color: "#888",
                transition: "transform 0.2s",
                transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ↑
            </span>
          </div>

          {/* Menu Déroulant (Dropdown) */}
          {isDropdownOpen && (
            <div style={dropdownStyle}>
              <button
                style={dropdownItemStyle}
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate("/profile");
                }}
              >
                👤 Mon Profil
              </button>
              <div
                style={{ height: "1px", background: "#eee", margin: "5px 0" }}
              />
              <button
                style={{ ...dropdownItemStyle, color: "#dc2626" }}
                onClick={logout}
              >
                🚪 Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// --- STYLES ---
const headerStyle: React.CSSProperties = {
  height: "70px",
  background: "#fff",
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0 30px",
  zIndex: 10,
};
const themeButtonStyle: React.CSSProperties = {
  background: "#f3f4f6",
  border: "none",
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "1.1rem",
  transition: "background 0.2s",
};
const profileZoneStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  cursor: "pointer",
  padding: "5px 10px",
  borderRadius: "8px",
  transition: "background 0.2s",
};
const avatarStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  background: "#32a823",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "0.9rem",
  letterSpacing: "1px",
};
const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "110%",
  right: "0",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
  width: "180px",
  padding: "8px",
  display: "flex",
  flexDirection: "column",
  zIndex: 20,
};
const dropdownItemStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: "10px 15px",
  textAlign: "left",
  cursor: "pointer",
  fontSize: "0.9rem",
  borderRadius: "6px",
  fontWeight: "500",
  color: "#444",
  transition: "background 0.2s",
};
