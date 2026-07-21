// ============================================================================
// IMPORTS
// ============================================================================

import React, { createContext, useContext, useState, useEffect } from "react";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  userNotifications?: boolean;
  adminNotifications?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (userData: User, token?: string) => void;
  logout: () => void;
}

// ============================================================================
// CONTEXT CREATION & PROVIDER
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Global authentication provider managing active session states, tokens, and navigation guards.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize and validate current session parameters stored on the client browser
  useEffect(() => {
    const storedUser = sessionStorage.getItem("csms_user");
    const storedToken = localStorage.getItem("jwt_token");

    // Safety check: ensure token and user session data exist and are not corrupted
    if (storedUser && storedUser !== "undefined" && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        // Clear corrupted structures if parsing fails
        sessionStorage.removeItem("csms_user");
        localStorage.removeItem("jwt_token");
      }
    } else {
      // Flush storage if any required session parameter is missing
      sessionStorage.removeItem("csms_user");
      localStorage.removeItem("jwt_token");
    }
    setIsInitialized(true);
  }, []);

  /**
   * Commits the authenticated user's profile and JWT token securely to local/session storage.
   */
  const login = (userData: User, token?: string) => {
    setUser(userData);
    sessionStorage.setItem("csms_user", JSON.stringify(userData));

    // Save token only when explicitly provided by the authentication flow
    if (token) {
      localStorage.setItem("jwt_token", token);
    }
  };

  /**
   * Destroys the active authentication state, clears client storage, and redirects to the login route.
   */
  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("csms_user");
    localStorage.removeItem("jwt_token");
    window.location.href = "/login";
  };

  if (!isInitialized) return null;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Custom hook to safely consume user session details and utility authentication handlers.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return context;
}
