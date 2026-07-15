// ============================================================================
// IMPORTS
// ============================================================================

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

// Authentication Pages
import LoginForm from "./pages/auth/LoginForm";
import ForgotPassword from "./pages/auth/ForgotPassword";
import RegisterForm from "./pages/auth/RegisterForm";
import ResetPassword from "./pages/auth/ResetPassword";

// Layout & Common Dashboard Pages
import AppLayout from "./components/layout/AppLayout";
import Profile from "./pages/dashboard/Profile";
import SessionDetail from "./pages/dashboard/SessionDetail";

// Administrative Pages
import AdminOverview from "./pages/dashboard/admin/AdminDashboard";
import AdminStations from "./pages/dashboard/admin/AdminStations";
import AdminBadges from "./pages/dashboard/admin/AdminBadges";
import AdminUsers from "./pages/dashboard/admin/AdminUsers";
import AdminUserDetail from "./pages/dashboard/admin/AdminUserDetail";
import StationDetail from "./pages/dashboard/admin/AdminStationDetail";
import AdminBadgeDetail from "./pages/dashboard/admin/AdminBadgeDetail";
import AdminPowerBlockManagement from "./pages/dashboard/admin/AdminPowerBlockManagement";

// Standard User Pages
import UserDashboard from "./pages/dashboard/user/UserDashboard";
import MySessions from "./pages/dashboard/user/MySessions";
import MyBadges from "./pages/dashboard/user/MyBadges";

// ============================================================================
// ROUTING COMPONENT
// ============================================================================

/**
 * Handles the application routing table, declaring public auth views, private layouts, and access guards.
 */
function AppRoutes() {
  const { user, login } = useAuth();

  /**
   * Helper function to determine the fallback home URL depending on the user's role profile.
   */
  const getHomeRoute = () => {
    return user?.role === "Admin" ? "/admin-dashboard" : "/user-dashboard";
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* --- PUBLIC ROUTES (AUTHENTICATION VIEWS) --- */}
        <Route
          path="/login"
          element={
            !user ? (
              <LoginForm onLoginSuccess={(user, token) => login(user, token)} />
            ) : (
              <Navigate to={getHomeRoute()} replace />
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
            )
          }
        />
        <Route
          path="/register"
          element={
            !user ? <RegisterForm /> : <Navigate to={getHomeRoute()} replace />
          }
        />
        <Route
          path="/reset-password/:token"
          element={
            !user ? <ResetPassword /> : <Navigate to={getHomeRoute()} replace />
          }
        />

        {/* --- PRIVATE SECURED ROUTES (WRAPPED WITH SIDEBAR & TOPBAR LAYOUT) --- */}
        <Route
          element={user ? <AppLayout /> : <Navigate to="/login" replace />}
        >
          {/* Admin Command Center Dashboard */}
          <Route path="/admin-dashboard" element={<AdminOverview />} />

          {/* Admin Management Panel Sub-routes */}
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

          {/* End-user Dedicated Spaces */}
          <Route path="/user-dashboard" element={<UserDashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/my-sessions" element={<MySessions />} />
          <Route path="/my-badges" element={<MyBadges />} />
        </Route>

        {/* --- GLOBAL ROUTING FALLBACK --- */}
        <Route
          path="*"
          element={<Navigate to={user ? getHomeRoute() : "/login"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

// ============================================================================
// MAIN ROOT ENTRY
// ============================================================================

/**
 * Main application wrapper rendering global theme providers, authentication state contexts, and routes.
 */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
