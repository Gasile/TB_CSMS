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
  login: (userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false); // Pour éviter les clignotements au F5

  // 1. Au chargement de l'application, on lit le sessionStorage
  useEffect(() => {
    const storedUser = sessionStorage.getItem("csms_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsInitialized(true);
  }, []);

  // 2. Fonction de connexion (appelée par le formulaire)
  const login = (userData: User) => {
    setUser(userData);
    sessionStorage.setItem("csms_user", JSON.stringify(userData)); // Sauvegarde
  };

  // 3. Fonction de déconnexion (appelée par le menu)
  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("csms_user"); // Nettoyage
  };

  // On ne rend l'application que lorsque la vérification initiale est terminée
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
