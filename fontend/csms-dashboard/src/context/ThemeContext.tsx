import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // On initialise le thème avec la valeur sauvegardée dans le navigateur, ou "dark" par défaut
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("csms-theme");
    return (savedTheme as Theme) || "dark";
  });

  // À chaque fois que 'theme' change, on met à jour le DOM et le localStorage
  useEffect(() => {
    if (theme === "light") {
      document.body.setAttribute("data-theme", "light");
    } else {
      document.body.removeAttribute("data-theme"); // Retire l'attribut pour retomber sur le dark par défaut
    }
    localStorage.setItem("csms-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error(
      "useTheme doit être utilisé à l'intérieur d'un ThemeProvider",
    );
  }
  return context;
}
