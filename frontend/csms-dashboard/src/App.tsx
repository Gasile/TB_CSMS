import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

// Imports Auth
import LoginForm from "./pages/auth/LoginForm";
import ForgotPassword from "./pages/auth/ForgotPassword";
import RegisterForm from "./pages/auth/RegisterForm";
import ResetPassword from "./pages/auth/ResetPassword";

// Imports Layout & Dashboard
import AppLayout from "./components/layout/AppLayout";
import Profile from "./pages/dashboard/Profile";

import SessionDetail from "./pages/dashboard/SessionDetail";

import AdminOverview from "./pages/dashboard/admin/AdminDashboard";
import AdminStations from "./pages/dashboard/admin/AdminStations";
import AdminBadges from "./pages/dashboard/admin/AdminBadges";
import AdminUsers from "./pages/dashboard/admin/AdminUsers";
import AdminUserDetail from "./pages/dashboard/admin/AdminUserDetail";
import StationDetail from "./pages/dashboard/admin/AdminStationDetail";
import AdminBadgeDetail from "./pages/dashboard/admin/AdminBadgeDetail";
import AdminPowerBlockManagement from "./pages/dashboard/admin/AdminPowerBlockManagement";

import UserDashboard from "./pages/dashboard/user/UserDashboard";
import MySessions from "./pages/dashboard/user/MySessions";
import MyBadges from "./pages/dashboard/user/MyBadges";

function AppRoutes() {
  const { user, login } = useAuth();

  // --- NOUVELLE LOGIQUE DE ROUTAGE ---
  // Détermine la page d'accueil en fonction du rôle
  const getHomeRoute = () => {
    return user?.role === "Admin" ? "/admin-dashboard" : "/user-dashboard";
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* --- ROUTES PUBLIQUES (Auth) --- */}
        <Route
          path="/login"
          element={
            !user ? (
              <LoginForm onLoginSuccess={(user, token) => login(user, token)} />
            ) : (
              <Navigate to={getHomeRoute()} replace /> /* <-- MODIFIÉ */
            )
          }
        />
        <Route
          path="/forgot-password"
          element={
            !user ? (
              <ForgotPassword />
            ) : (
              <Navigate to={getHomeRoute()} replace />
            ) /* <-- MODIFIÉ */
          }
        />
        <Route
          path="/register"
          element={
            !user ? (
              <RegisterForm />
            ) : (
              <Navigate to={getHomeRoute()} replace />
            ) /* <-- MODIFIÉ */
          }
        />
        <Route
          path="/reset-password/:token"
          element={
            !user ? (
              <ResetPassword />
            ) : (
              <Navigate to={getHomeRoute()} replace />
            ) /* <-- MODIFIÉ */
          }
        />

        {/* --- ROUTES PRIVÉES (Layout avec Sidebar et Topbar) --- */}
        <Route
          element={user ? <AppLayout /> : <Navigate to="/login" replace />}
        >
          {/* Phase 2 : Le Centre de Contrôle */}
          <Route path="/admin-dashboard" element={<AdminOverview />} />

          {/* Phase 3, 4 et 5 : Les futures pages Admin */}
          <Route path="/admin-stations" element={<AdminStations />} />
          <Route path="/admin-badges" element={<AdminBadges />} />
          <Route path="/admin-badges/:id" element={<AdminBadgeDetail />} />
          <Route path="/admin-users" element={<AdminUsers />} />
          <Route path="/users/:id" element={<AdminUserDetail />} />
          <Route path="/admin-stations/:id" element={<StationDetail />} />
          <Route path="/session/:id" element={<SessionDetail />} />
          <Route
            path="/admin-power-blocks"
            element={<AdminPowerBlockManagement />}
          />

          {/* Espace Utilisateur */}
          <Route path="/user-dashboard" element={<UserDashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/my-sessions" element={<MySessions />} />
          <Route path="/my-badges" element={<MyBadges />} />
        </Route>

        {/* --- REDIRECTION PAR DÉFAUT --- */}
        <Route
          path="*"
          element={
            <Navigate to={user ? getHomeRoute() : "/login"} replace />
          } /* <-- MODIFIÉ */
        />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
