// ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "csms-theme-preference";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Initialisation de l'état avec lazy-loading pour éviter les lectures inutiles au re-render
  const [theme, setThemeState] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem(LOCAL_STORAGE_KEY) as Theme | null;

    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    // Fallback sur la préférence système
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }

    return "light";
  });

  // Effet pour appliquer la classe sur la balise <html> et sauvegarder dans le localStorage
  useEffect(() => {
    const root = window.document.documentElement;

    // Ajout d'une classe temporaire pour éviter les flashs visuels brutaux durant la transition
    root.classList.add("theme-transitioning");

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, theme);

    // Retrait de la classe de transition après la fin de l'animation
    const timeout = setTimeout(() => {
      root.classList.remove("theme-transitioning");
    }, 300);

    return () => clearTimeout(timeout);
  }, [theme]);

  // Écoute des changements de préférence système en temps réel (si l'utilisateur n'a pas forcé de choix)
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      const hasUserPreference = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!hasUserPreference) {
        setThemeState(e.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = () => {
    setThemeState((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
