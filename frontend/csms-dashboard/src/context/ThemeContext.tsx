// ============================================================================
// IMPORTS
// ============================================================================

import React, { createContext, useContext, useEffect, useState } from "react";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// ============================================================================
// CONTEXT CREATION & PROVIDER
// ============================================================================

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "csms-theme-preference";

/**
 * Theme provider managing application appearance modes (light/dark) and system preference sync.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Lazy-load initial theme state to prevent redundant storage reads on re-render
  const [theme, setThemeState] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem(LOCAL_STORAGE_KEY) as Theme | null;

    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    // Fallback to system color scheme preferences if no local preference exists
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }

    return "light";
  });

  // Apply theme class to HTML root node and handle smooth transition animations
  useEffect(() => {
    const root = window.document.documentElement;

    // Add temporary class to prevent sudden flashing during theme transition
    root.classList.add("theme-transitioning");

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, theme);

    // Remove the transition utility class once the transition animation finishes
    const timeout = setTimeout(() => {
      root.classList.remove("theme-transitioning");
    }, 300);

    return () => clearTimeout(timeout);
  }, [theme]);

  // Sync with system preference changes in real-time if no manual preference is saved
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

  /**
   * Toggles the current theme between light and dark modes.
   */
  const toggleTheme = () => {
    setThemeState((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  /**
   * Directly sets the active theme to a specified value.
   */
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Custom hook to safely consume the application's theme context and utility toggle functions.
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
