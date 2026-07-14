import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  return (
    <div style={layoutContainerStyle}>
      {/* 1. La Topbar est maintenant tout en haut, en pleine largeur */}
      <Topbar />

      {/* 2. La zone du bas contient la Sidebar et le contenu */}
      <div style={bottomAreaStyle}>
        <Sidebar />
        <main style={scrollableMainStyle}>
          {/* L'Outlet représente la page actuellement visitée */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// --- STYLES ---
// On empile de haut en bas (column)
const layoutContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  width: "100vw",
  backgroundColor: "var(--bg-app)", // Corrigé : utilise maintenant notre variable dynamique !
  transition: "var(--theme-transition)", // Pour un basculement fluide
};
// La zone du bas prend le reste de l'espace (flex: 1) et aligne de gauche à droite (row par défaut)
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
  backgroundColor: "var(--bg-app)", // Assure que la zone centrale utilise également le fond
  transition: "var(--theme-transition)",
};
