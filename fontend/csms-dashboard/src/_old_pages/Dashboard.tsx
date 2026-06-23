import React, { useState } from "react";
import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

import Overview from "../features/overview/Overview";
import UserProfile from "../features/users/UserProfile";
import UserBadges from "../features/badges/UserBadges";
import UserSessions from "../features/sessions/UserSessions";
import UserList from "../features/users/UserList";
import StationList from "../features/stations/StationList";
import BadgeList from "../features/badges/BadgeList";
import UserDetail from "../features/users/UserDetail";
import StationDetail from "../features/stations/StationDetail";
import SessionDetail from "../features/sessions/SessionDetail";

const emojiStyle: React.CSSProperties = {
  background: "var(--gradient-primary)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  display: "inline-block",
  lineHeight: "1.2",
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isLogoutHovered, setIsLogoutHovered] = useState(false);

  // --- LECTURE DU SECRET DE NAVIGATION ---
  const location = useLocation();
  const state = location.state as { fromAdmin?: string } | null;
  const fromAdmin = state?.fromAdmin;

  // --- CALCUL DES ONGLETS ACTIFS ---
  const isOverviewActive = location.pathname.includes("/overview");
  const isProfileActive = location.pathname.includes("/profile");
  const isBadgesActive = location.pathname.endsWith("/badges");

  // "Mes sessions" s'allume UNIQUEMENT si on ne vient pas d'un onglet Admin
  const isTransactionsActive =
    location.pathname.includes("/transactions") && !fromAdmin;

  // Les onglets Admin s'allument via l'URL OU via le secret mémorisé
  const isAdminUsersActive =
    location.pathname.includes("/admin-users") || fromAdmin === "users";
  const isAdminBornesActive =
    location.pathname.includes("/admin-bornes") || fromAdmin === "bornes";
  const isAdminBadgesActive = location.pathname.includes("/admin-badges");

  if (!user) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflowY: "auto",
        overflowX: "hidden",
        backgroundColor: "var(--bg-deep)",
        color: "var(--text-primary)",
        fontFamily: '"Poppins", "Segoe UI", sans-serif',
      }}
    >
      <nav
        style={{
          backgroundColor: "var(--bg-card)",
          padding: "15px 30px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "var(--shadow-nav)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.8em", ...emojiStyle }}>🔌</span>
            <h2
              style={{
                margin: 0,
                fontSize: "1.5em",
                fontWeight: "bold",
                letterSpacing: "-0.5px",
              }}
            >
              CSMS Network
            </h2>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <Link
              to="/dashboard/overview"
              style={navButtonStyle(isOverviewActive)}
            >
              <span style={emojiStyle}>📊</span> Vue d'ensemble
            </Link>
            <Link
              to="/dashboard/profile"
              style={navButtonStyle(isProfileActive)}
            >
              <span style={emojiStyle}>👤</span> Mon Profil
            </Link>
            <Link
              to="/dashboard/transactions"
              style={navButtonStyle(isTransactionsActive)}
            >
              <span style={emojiStyle}>⚡</span> Mes Sessions
            </Link>
            <Link to="/dashboard/badges" style={navButtonStyle(isBadgesActive)}>
              <span style={emojiStyle}>💳</span> Mes Badges
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {user.role === "Admin" && (
            <div
              style={{
                display: "flex",
                gap: "10px",
                borderLeft: `1px solid var(--color-border)`,
                paddingLeft: "20px",
              }}
            >
              <span
                style={{
                  color: "var(--text-secondary)",
                  alignSelf: "center",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  marginRight: "5px",
                }}
              >
                Admin
              </span>
              <Link
                to="/dashboard/admin-users"
                style={navAdminButtonStyle(isAdminUsersActive)}
              >
                <span style={emojiStyle}>👥</span> Utilisateurs
              </Link>
              <Link
                to="/dashboard/admin-bornes"
                style={navAdminButtonStyle(isAdminBornesActive)}
              >
                <span style={emojiStyle}>🔌</span> Bornes
              </Link>
              <Link
                to="/dashboard/admin-badges"
                style={navAdminButtonStyle(isAdminBadgesActive)}
              >
                <span style={emojiStyle}>💳</span> Badges
              </Link>
            </div>
          )}

          <div
            style={{
              marginLeft: "10px",
              borderLeft: `1px solid var(--color-border)`,
              paddingLeft: "20px",
              display: "flex",
              alignItems: "center",
              gap: "15px",
            }}
          >
            <div
              onClick={toggleTheme}
              style={getSwitchContainerStyle(theme)}
              title={
                theme === "dark"
                  ? "Passer au mode clair"
                  : "Passer au mode sombre"
              }
            >
              <div style={getSwitchThumbStyle(theme)}>
                <span style={{ fontSize: "14px", ...emojiStyle }}>
                  {theme === "light" ? "☀️" : "🌙"}
                </span>
              </div>
            </div>

            <span
              style={{
                fontWeight: "500",
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              Connecté :{" "}
              <span style={{ color: "var(--text-primary)" }}>
                {user.firstName}
              </span>
            </span>
            <button
              onClick={logout}
              onMouseEnter={() => setIsLogoutHovered(true)}
              onMouseLeave={() => setIsLogoutHovered(false)}
              style={getLogoutButtonStyle(isLogoutHovered)}
            >
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <div
        style={{
          height: "3px",
          width: "100%",
          background: "var(--gradient-primary)",
        }}
      />

      <main style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto" }}>
        <Routes>
          <Route path="/" element={<Navigate to="overview" replace />} />

          <Route path="overview" element={<Overview />} />
          <Route path="profile" element={<UserProfile />} />
          <Route path="transactions" element={<UserSessions />} />
          <Route path="badges" element={<UserBadges />} />
          <Route path="transactions/:id" element={<SessionDetail />} />

          {user.role === "Admin" && (
            <>
              <Route path="admin-users" element={<UserList />} />
              <Route path="admin-users/:userId" element={<UserDetail />} />
              <Route path="admin-bornes" element={<StationList />} />
              <Route
                path="admin-bornes/:connectionName"
                element={<StationDetail />}
              />
              <Route path="admin-badges" element={<BadgeList />} />
            </>
          )}
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function navButtonStyle(isActive: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    whiteSpace: "nowrap",
    textDecoration: "none",
    backgroundColor: isActive ? "var(--bg-user-active)" : "transparent",
    color: isActive ? "var(--color-user)" : "var(--text-secondary)",
    border: `1px solid ${isActive ? "var(--color-user)" : "transparent"}`,
    padding: "10px 16px",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: isActive ? "600" : "400",
    transition: "var(--transition-standard)",
  };
}

function navAdminButtonStyle(isActive: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    whiteSpace: "nowrap",
    textDecoration: "none",
    backgroundColor: isActive ? "var(--bg-admin-active)" : "transparent",
    color: isActive ? "var(--color-admin)" : "var(--text-secondary)",
    border: `1px solid ${isActive ? "var(--color-admin)" : "transparent"}`,
    padding: "10px 16px",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "var(--transition-standard)",
  };
}

function getLogoutButtonStyle(isHovered: boolean): React.CSSProperties {
  return {
    whiteSpace: "nowrap",
    padding: "8px 16px",
    backgroundColor: isHovered ? "rgba(255, 82, 82, 0.15)" : "transparent",
    color: isHovered ? "var(--error-color)" : "var(--text-mute)",
    border: `1px solid ${isHovered ? "var(--error-color)" : "var(--color-border)"}`,
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "13px",
    transition: "var(--transition-standard)",
  };
}

function getSwitchContainerStyle(theme: string): React.CSSProperties {
  return {
    width: "60px",
    height: "32px",
    borderRadius: "16px",
    backgroundColor: theme === "light" ? "#f0f2f5" : "var(--bg-input)",
    border: "1px solid var(--color-border)",
    boxShadow:
      theme === "light"
        ? "inset 0 1px 3px rgba(0,0,0,0.1)"
        : "inset 0 1px 3px rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    position: "relative",
    transition: "var(--transition-standard)",
    boxSizing: "border-box",
  };
}

function getSwitchThumbStyle(theme: string): React.CSSProperties {
  return {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    backgroundColor: "var(--bg-card)",
    boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    left: theme === "light" ? "4px" : "calc(100% - 28px)",
    transition: "left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
  };
}
