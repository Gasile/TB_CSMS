import React, { createContext, useContext, useState, useEffect } from "react";

// On définit à quoi ressemble un utilisateur dans notre application
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  // MODIFICATION : La fonction login accepte désormais le token en second paramètre
  login: (userData: User, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 1. Vérification au chargement
  useEffect(() => {
    const storedUser = sessionStorage.getItem("csms_user");
    const storedToken = localStorage.getItem("jwt_token");

    // SÉCURITÉ : On s'assure que les données existent ET qu'elles ne sont pas corrompues ("undefined")
    if (storedUser && storedUser !== "undefined" && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        // Si le JSON est illisible, on vide la mémoire corrompue
        sessionStorage.removeItem("csms_user");
        localStorage.removeItem("jwt_token");
      }
    } else {
      // Si l'un des deux manque, on nettoie tout par précaution
      sessionStorage.removeItem("csms_user");
      localStorage.removeItem("jwt_token");
    }
    setIsInitialized(true);
  }, []);

  // La fonction login accepte désormais le token de manière optionnelle (token?)
  const login = (userData: User, token?: string) => {
    setUser(userData);
    sessionStorage.setItem("csms_user", JSON.stringify(userData));

    // 🔥 CORRECTION : On ne sauvegarde le token QUE s'il est explicitement fourni !
    if (token) {
      localStorage.setItem("jwt_token", token);
    }
  };

  // 3. Déconnexion
  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("csms_user");
    localStorage.removeItem("jwt_token"); // NOUVEAU : Destruction du token
    window.location.href = "/login"; // Redirection de sécurité
  };

  if (!isInitialized) return null;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return context;
}
