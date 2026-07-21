// ============================================================================
// IMPORTS
// ============================================================================

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// ============================================================================
// MAIN SIDEBAR COMPONENT
// ============================================================================

/**
 * Navigation sidebar that displays different navigation items depending on the user role.
 */
export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "Admin";

  // State initialized with persisted active tab from session storage
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem("activeSidebarTab") || "";
  });

  // Admin exclusive navigation entries
  const adminItems = [
    { name: "Supervision", path: "/admin-dashboard", icon: "📊" },
    { name: "Bornes de recharge", path: "/admin-stations", icon: "🔌" },
    { name: "Gestion des badges", path: "/admin-badges", icon: "💳" },
    { name: "Utilisateurs", path: "/admin-users", icon: "👥" },
  ];

  // Common user navigation entries
  const userItems = [
    { name: "Vue d'ensemble", path: "/user-dashboard", icon: "📊" },
    { name: "Mes Sessions", path: "/my-sessions", icon: "🔋" },
    { name: "Mes Badges", path: "/my-badges", icon: "🏷️" },
  ];

  // Sync active tab state with changes in current window location path
  useEffect(() => {
    const path = location.pathname;
    let detectedTab = null;

    if (path === "/" || path === "/admin-dashboard") {
      detectedTab = "/admin-dashboard";
    } else if (path === "/user-dashboard") {
      detectedTab = "/user-dashboard";
    } else if (path.startsWith("/admin-stations")) {
      detectedTab = "/admin-stations";
    } else if (path.startsWith("/admin-badges")) {
      detectedTab = "/admin-badges";
    } else if (path.startsWith("/admin-users") || path.startsWith("/users")) {
      detectedTab = "/admin-users";
    } else if (path.startsWith("/my-sessions")) {
      detectedTab = "/my-sessions";
    } else if (path.startsWith("/my-badges")) {
      detectedTab = "/my-badges";
    } else if (path.startsWith("/profile")) {
      detectedTab = "/profile";
    }

    if (detectedTab) {
      setActiveTab(detectedTab);
      sessionStorage.setItem("activeSidebarTab", detectedTab);
    }
  }, [location.pathname]);

  /**
   * Performs standard logout actions and clears active state parameters.
   */
  const handleLogout = () => {
    sessionStorage.removeItem("activeSidebarTab");
    logout();
  };

  return (
    <aside style={sidebarStyle}>
      <nav style={navContainerStyle}>
        {/* --- ADMINISTRATION PANEL SECTION --- */}
        {isAdmin && (
          <div style={navSectionStyle}>
            <p style={sectionTitleStyle}>Administration</p>
            {adminItems.map((item) => {
              const isActive = activeTab === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  style={linkStyle(isActive)}
                >
                  <span style={iconStyle}>{item.icon}</span>
                  <span style={textStyle(isActive, true)}>{item.name}</span>
                </Link>
              );
            })}
          </div>
        )}

        {isAdmin && <div style={separatorStyle} />}

        {/* --- CUSTOMER PORTAL WORKSPACE SECTION --- */}
        <div style={navSectionStyle}>
          <p style={sectionTitleStyle}>Mon Espace</p>
          {userItems.map((item) => {
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

      {/* --- FOOTER DECONNEXION BLOCK --- */}
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

// ============================================================================
// STYLES & LAYOUTS (INLINE CSS VARIABLES ADAPTATION)
// ============================================================================

const sidebarStyle: React.CSSProperties = {
  width: "260px",
  flexShrink: 0,
  background: "var(--bg-card)",
  borderRight: "1px solid var(--border-color)",
  display: "flex",
  flexDirection: "column",
  height: "100%",
  transition: "var(--theme-transition)",
};

const navContainerStyle: React.CSSProperties = {
  flex: 1,
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
  color: "var(--text-muted)",
  fontWeight: "700",
  transition: "var(--theme-transition)",
};

const linkStyle = (isActive: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  textDecoration: "none",
  padding: "10px",
  borderRadius: "8px",
  background: isActive ? "var(--bg-app)" : "transparent",
  transition: "background 0.2s, var(--theme-transition)",
});

const iconStyle: React.CSSProperties = {
  fontSize: "1.2rem",
  width: "35px",
  textAlign: "center",
  flexShrink: 0,
};

const textStyle = (isActive: boolean): React.CSSProperties => ({
  fontWeight: isActive ? "600" : "500",
  color: isActive ? "var(--primary)" : "var(--text-muted)",
  fontSize: "0.95rem",
  transition: "var(--theme-transition)",
});

const separatorStyle: React.CSSProperties = {
  height: "1px",
  background: "var(--border-color)",
  margin: "0 10px",
  transition: "var(--theme-transition)",
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
  transition: "background 0.2s, var(--theme-transition)",
};

const logoutTextStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: "600",
  color: "var(--status-offline)",
};
