// ============================================================================
// IMPORTS
// ============================================================================

import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { Icon } from "../ui/Icon";

// ============================================================================
// MAIN TOPBAR COMPONENT
// ============================================================================

/**
 * Top bar header component containing the platform brand, animated theme switch, and user profile dropdown.
 */
export default function Topbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  // Compute profile avatar initials using the first letters of first and last names
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : "??";

  const isLight = theme === "light";

  // Compute slider track container styles based on the active theme
  const getSwitchContainerStyle = (): React.CSSProperties => ({
    width: "62px",
    height: "32px",
    borderRadius: "16px",
    background: isLight ? "#e5e7eb" : "#334155",
    cursor: "pointer",
    position: "relative",
    display: "flex",
    alignItems: "center",
    padding: "4px",
    transition: "background-color 0.3s ease",
    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
  });

  // Compute moving slider knob styles with precise transform transitions
  const getSwitchThumbStyle = (): React.CSSProperties => ({
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    background: "var(--bg-card)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 5px rgba(0,0,0,0.25)",
    position: "absolute",

    // 1. Initial offset position
    left: "4px",

    // 2. Active translation offset (shifts knob when dark mode is enabled)
    transform: isLight ? "translateX(0)" : "translateX(30px)",

    // 3. Smooth sliding transition mapping
    transition:
      "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease",
  });

  return (
    <header style={headerStyle}>
      {/* Brand & Platform Home Redirect Handler */}
      <div
        onClick={() => {
          logout();
          navigate("/login");
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          cursor: "pointer",
        }}
        title="Se déconnecter et retourner au Login"
      >
        <span style={{ fontSize: "1.5rem" }}>
          <Icon
            name="electrical_services"
            style={{ fontSize: "2.2rem", color: "var(--primary)" }}
          />
        </span>
        <h2
          style={{
            margin: 0,
            fontSize: "1.2rem",
            color: "var(--text-main)",
            transition: "var(--theme-transition)",
          }}
        >
          CSMS Network
        </h2>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        {/* Animated Theme Toggle Switch */}
        <div
          onClick={toggleTheme}
          style={getSwitchContainerStyle()}
          title={
            theme === "dark" ? "Passer au mode clair" : "Passer au mode sombre"
          }
        >
          <div style={getSwitchThumbStyle()}>
            <Icon
              name={theme === "light" ? "brightness_7" : "dark_mode"}
              style={{
                fontSize: "20px",
                color: "var(--primary)",
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            />
          </div>
        </div>

        {/* User Account Dropdown Menu */}
        <div style={{ position: "relative" }}>
          <div
            style={profileZoneStyle}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div style={avatarStyle}>{initials}</div>
            <span
              style={{
                fontWeight: "600",
                fontSize: "0.9rem",
                color: "var(--text-main)",
                transition: "var(--theme-transition)",
              }}
            >
              {user?.firstName} {user?.lastName.charAt(0)}.
            </span>
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                transition: "transform 0.2s, color 0.3s",
                transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <Icon
                name="arrow_upward_alt"
                style={{ fontSize: "1.3rem", color: "var(--text-main)" }}
              />
            </span>
          </div>

          {isDropdownOpen && (
            <div style={dropdownStyle}>
              <button
                style={{
                  ...dropdownItemStyle,
                  color: "var(--text-main)",
                }}
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate("/profile");
                }}
              >
                <Icon name="person" style={{ fontSize: "1.2rem" }} /> Mon Profil
              </button>
              <div
                style={{
                  height: "1px",
                  background: "var(--border-color)",
                  margin: "5px 0",
                  transition: "var(--theme-transition)",
                }}
              />
              <button
                style={{ ...dropdownItemStyle, color: "var(--status-offline)" }}
                onClick={logout}
              >
                <Icon name="logout" style={{ fontSize: "1.2rem" }} />{" "}
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// STYLES & LAYOUTS (INLINE CSS VARIABLES ADAPTATION)
// ============================================================================

const headerStyle: React.CSSProperties = {
  height: "70px",
  background: "var(--bg-card)",
  borderBottom: "1px solid var(--border-color)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0 30px",
  zIndex: 10,
  transition: "var(--theme-transition)",
};

const profileZoneStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  cursor: "pointer",
  padding: "5px 10px",
  borderRadius: "8px",
  transition: "background 0.2s",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const avatarStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  background: "var(--primary)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "0.9rem",
  letterSpacing: "1px",
  transition: "var(--theme-transition)",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "110%",
  right: "0",
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  borderRadius: "10px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
  width: "180px",
  padding: "8px",
  display: "flex",
  flexDirection: "column",
  zIndex: 20,
  transition: "var(--theme-transition)",
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
  transition: "background 0.2s, color 0.3s",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};
