import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "Admin";

  // --- LA MÉMOIRE DE L'ONGLET ACTIF ---
  // On récupère le dernier onglet visité dans le stockage du navigateur
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem("activeSidebarTab") || "";
  });

  const adminItems = [
    { name: "Supervision", path: "/admin-dashboard", icon: "📊" },
    { name: "Bornes de recharge", path: "/admin-stations", icon: "🔌" },
    { name: "Gestion des badges", path: "/admin-badges", icon: "💳" },
    { name: "Utilisateurs", path: "/admin-users", icon: "👥" },
  ];

  const userItems = [
    { name: "Vue d'ensemble", path: "/user-dashboard", icon: "📊" },
    { name: "Mes Sessions", path: "/my-sessions", icon: "🔋" },
    { name: "Mes Badges", path: "/my-badges", icon: "🏷️" },
  ];

  // --- LOGIQUE INTELLIGENTE D'ACTIVATION ---
  useEffect(() => {
    const path = location.pathname;
    let detectedTab = null;

    // 1. On associe les URLs connues à leurs onglets parents
    if (path === "/" || path === "/admin-dashboard") {
      detectedTab = "/admin-dashboard";
    } else if (path === "/user-dashboard") {
      detectedTab = "/user-dashboard";
    } else if (path.startsWith("/admin-stations")) {
      detectedTab = "/admin-stations";
    } else if (path.startsWith("/admin-badges")) {
      detectedTab = "/admin-badges";
    } else if (path.startsWith("/admin-users") || path.startsWith("/users")) {
      // Couvre la liste /admin-users ET le détail /users/:id
      detectedTab = "/admin-users";
    } else if (path.startsWith("/my-sessions")) {
      detectedTab = "/my-sessions";
    } else if (path.startsWith("/my-badges")) {
      detectedTab = "/my-badges";
    } else if (path.startsWith("/profile")) {
      // Si on va sur le profil (via la Topbar), on désélectionne tout
      detectedTab = "/profile";
    }

    // 2. Si on a détecté un parent, on le sauvegarde.
    // SINON (ex: on est sur /session/:id), on ne fait rien ! L'onglet précédent reste allumé.
    if (detectedTab) {
      setActiveTab(detectedTab);
      sessionStorage.setItem("activeSidebarTab", detectedTab);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    sessionStorage.removeItem("activeSidebarTab"); // On nettoie la mémoire
    logout();
  };

  return (
    <aside style={sidebarStyle}>
      {/* Zone de navigation flexible */}
      <nav style={navContainerStyle}>
        {/* --- SECTION ADMIN --- */}
        {isAdmin && (
          <div style={navSectionStyle}>
            <p style={sectionTitleStyle}>Administration</p>
            {adminItems.map((item) => {
              // On compare maintenant le chemin avec notre "mémoire"
              const isActive = activeTab === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  style={linkStyle(isActive, true)}
                >
                  <span style={iconStyle}>{item.icon}</span>
                  <span style={textStyle(isActive, true)}>{item.name}</span>
                </Link>
              );
            })}
          </div>
        )}

        {isAdmin && <div style={separatorStyle} />}

        {/* --- SECTION UTILISATEUR --- */}
        <div style={navSectionStyle}>
          <p style={sectionTitleStyle}>Mon Espace</p>
          {userItems.map((item) => {
            // On compare maintenant le chemin avec notre "mémoire"
            const isActive = activeTab === item.path;
            return (
              <Link key={item.name} to={item.path} style={linkStyle(isActive)}>
                <span style={iconStyle}>{item.icon}</span>
                <span style={textStyle(isActive)}>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* --- BOUTON DE DÉCONNEXION EN BAS --- */}
      <div style={bottomStyle}>
        <div style={separatorStyle} />
        <button onClick={handleLogout} style={logoutButtonStyle}>
          <span style={iconStyle}>🚪</span>
          <span style={logoutTextStyle}>Se déconnecter</span>
        </button>
      </div>
    </aside>
  );
}

// --- STYLES ---
const sidebarStyle: React.CSSProperties = {
  width: "260px", // Largeur fixe, toujours déployée
  flexShrink: 0, // Empêche la barre de s'écraser
  background: "#fff",
  borderRight: "1px solid #e5e7eb",
  display: "flex",
  flexDirection: "column",
  height: "100%", // S'étire jusqu'en bas
};

const navContainerStyle: React.CSSProperties = {
  flex: 1, // Pousse le bouton de déconnexion vers le bas
  overflowY: "auto",
  padding: "20px 10px",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const navSectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 5px 15px",
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#9ca3af",
  fontWeight: "700",
};

const linkStyle = (
  isActive: boolean,
  isAdminLink = false,
): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  textDecoration: "none",
  padding: "10px",
  borderRadius: "8px",
  background: isActive ? (isAdminLink ? "#ecfdf5" : "#f0fdf4") : "transparent",
  transition: "background 0.2s",
});

const iconStyle: React.CSSProperties = {
  fontSize: "1.2rem",
  width: "35px",
  textAlign: "center",
  flexShrink: 0,
};

const textStyle = (
  isActive: boolean,
  isAdminLink = false,
): React.CSSProperties => ({
  fontWeight: isActive ? "600" : "500",
  color: isActive ? (isAdminLink ? "#15803d" : "#16a34a") : "#64748b",
  fontSize: "0.95rem",
});

const separatorStyle: React.CSSProperties = {
  height: "1px",
  background: "#e5e7eb",
  margin: "0 10px",
};

const bottomStyle: React.CSSProperties = {
  padding: "10px 10px 20px 10px",
};

const logoutButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  padding: "10px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  marginTop: "10px",
  borderRadius: "8px",
  transition: "background 0.2s",
};

const logoutTextStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: "600",
  color: "#dc2626", // Rouge subtil
};
