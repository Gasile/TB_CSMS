// ============================================================================
// IMPORTS
// ============================================================================

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import App from "./App.tsx";

// ============================================================================
// APPLICATION ROOT RENDERING
// ============================================================================

/**
 * Bootstraps and renders the root React application within the StrictMode wrapper.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
