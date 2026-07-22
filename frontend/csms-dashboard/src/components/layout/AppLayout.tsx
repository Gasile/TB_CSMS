// ============================================================================
// IMPORTS
// ============================================================================

import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { Icon } from "../ui/Icon";

// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================

/**
 * Main application layout wrapper containing the global Topbar, Sidebar, and scrollable content workspace.
 */
export default function AppLayout() {
  return (
    <div style={layoutContainerStyle}>
      {/* Topbar stretches across the full width at the very top */}
      <Topbar />

      {/* Main split viewport housing the navigation Sidebar and active route Outlet */}
      <div style={bottomAreaStyle}>
        <Sidebar />
        <main style={scrollableMainStyle}>
          {/* Outlet represents the dynamic component mapped to the current browser route */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// STYLES & LAYOUTS (INLINE CSS VARIABLES ADAPTATION)
// ============================================================================

const layoutContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  width: "100vw",
  backgroundColor: "var(--bg-app)",
  transition: "var(--theme-transition)",
};

const bottomAreaStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  overflow: "hidden",
  position: "relative",
};

const scrollableMainStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "40px",
  boxSizing: "border-box",
  transition: "var(--theme-transition)",
};
