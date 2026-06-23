import React, { useState } from "react";
import type { UserSession } from "../../types";
import { loginUser, requestPasswordReset } from "../../api/authApi";

interface LoginFormProps {
  onLoginSuccess: (user: UserSession) => void;
}

const BORDER_RADIUS = {
  large: "40px",
  medium: "10px",
};

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [targetEmail, setTargetEmail] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isMainButtonHovered, setIsMainButtonHovered] = useState(false);
  const [isMagic1Hovered, setIsMagic1Hovered] = useState(false);
  const [isMagic2Hovered, setIsMagic2Hovered] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Nouveaux états pour le mot de passe oublié
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [isForgotHovered, setIsForgotHovered] = useState(false);
  const [isBackHovered, setIsBackHovered] = useState(false);

  const handleLogin = async (
    e?: React.FormEvent,
    magicEmail?: string,
    magicPassword?: string,
  ) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError("");
    setResetMessage("");

    const emailToSubmit = magicEmail || targetEmail;
    const passwordToSubmit = magicPassword || inputPassword;

    if (!emailToSubmit.trim() || !passwordToSubmit.trim()) {
      setError("Veuillez remplir tous les champs.");
      setIsLoading(false);
      return;
    }

    try {
      const session = await loginUser(emailToSubmit, passwordToSubmit);
      onLoginSuccess(session);
    } catch (err: any) {
      setError(err.message || "Une erreur inconnue est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResetMessage("");
    setIsLoading(true);

    if (!targetEmail.trim()) {
      setError("Veuillez saisir votre adresse e-mail.");
      setIsLoading(false);
      return;
    }

    try {
      await requestPasswordReset(targetEmail);
      setResetMessage(
        "Si cette adresse existe, un lien a été envoyé (voir console).",
      );
    } catch (err: any) {
      setResetMessage(err.message || "Un e-mail a été envoyé.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={outerContainerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={logoIconStyle}>🔌</div>
          <h1 style={titleStyle}>CSMS Network</h1>
          <p style={subtitleStyle}>
            {isForgotPassword
              ? "Récupération de votre compte"
              : "Connectez-vous à votre espace de gestion"}
          </p>
        </div>

        <form
          onSubmit={
            isForgotPassword ? handleResetRequest : (e) => handleLogin(e)
          }
          style={formStyle}
        >
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Identifiant (Email)</label>
            <input
              type="email"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              placeholder="votre@email.com"
              onFocus={() => setIsEmailFocused(true)}
              onBlur={() => setIsEmailFocused(false)}
              style={getInputStyle(isEmailFocused)}
              required
            />
          </div>

          {!isForgotPassword && (
            <div style={inputGroupStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <label style={labelStyle}>Mot de passe</label>
                <span
                  onClick={() => {
                    setIsForgotPassword(true);
                    setError("");
                    setResetMessage("");
                  }}
                  onMouseEnter={() => setIsForgotHovered(true)}
                  onMouseLeave={() => setIsForgotHovered(false)}
                  style={getForgotLinkStyle(isForgotHovered)}
                >
                  Mot de passe oublié ?
                </span>
              </div>
              <input
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                placeholder="••••••••"
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                style={getInputStyle(isPasswordFocused)}
                required={!isForgotPassword}
              />
            </div>
          )}

          <div style={statusAreaStyle}>
            {error && <p style={errorTextStyle}>❌ {error}</p>}
            {resetMessage && <p style={successTextStyle}>✅ {resetMessage}</p>}
            {isLoading && (
              <p style={loadingTextStyle}>
                {isForgotPassword
                  ? "Génération en cours..."
                  : "Authentification en cours..."}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            onMouseEnter={() => setIsMainButtonHovered(true)}
            onMouseLeave={() => setIsMainButtonHovered(false)}
            style={getMainButtonStyle(isMainButtonHovered, isLoading)}
          >
            {isLoading
              ? "Un instant..."
              : isForgotPassword
                ? "Envoyer le lien"
                : "Se connecter"}
          </button>

          {isForgotPassword && (
            <div style={{ textAlign: "center", marginTop: "10px" }}>
              <span
                onClick={() => {
                  setIsForgotPassword(false);
                  setError("");
                  setResetMessage("");
                }}
                onMouseEnter={() => setIsBackHovered(true)}
                onMouseLeave={() => setIsBackHovered(false)}
                style={getForgotLinkStyle(isBackHovered)}
              >
                🔙 Retour à la connexion
              </span>
            </div>
          )}
        </form>

        {!isForgotPassword && (
          <div style={magicAreaStyle}>
            <p style={magicTitleStyle}>Accès rapides (Débogage)</p>
            <div style={magicButtonsGroupStyle}>
              <button
                type="button"
                onClick={() =>
                  handleLogin(undefined, "basile.gasser@hes-so.ch", "TBCSMS")
                }
                onMouseEnter={() => setIsMagic1Hovered(true)}
                onMouseLeave={() => setIsMagic1Hovered(false)}
                style={getMagicButtonStyle(isMagic1Hovered)}
              >
                <span style={{ fontSize: "1.2em", marginRight: "8px" }}>
                  👤
                </span>
                Admin (Basile)
              </button>

              <button
                type="button"
                onClick={() =>
                  handleLogin(undefined, "jessica.udry@hes-so.ch", "JESSICA")
                }
                onMouseEnter={() => setIsMagic2Hovered(true)}
                onMouseLeave={() => setIsMagic2Hovered(false)}
                style={getMagicButtonStyle(isMagic2Hovered)}
              >
                <span style={{ fontSize: "1.2em", marginRight: "8px" }}>
                  ⚡
                </span>
                User (Jessica)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// --- STYLES EN LIGNE AVEC VARIABLES CSS ---
// ==========================================

const outerContainerStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "var(--bg-deep)",
  boxSizing: "border-box",
};

const cardStyle: React.CSSProperties = {
  border: "3px solid transparent",
  background: `linear-gradient(var(--bg-card), var(--bg-card)) padding-box, var(--gradient-primary) border-box`,
  padding: "40px 50px",
  borderRadius: "50px",
  width: "100%",
  maxWidth: "480px",
  boxShadow: "0 15px 50px rgba(0,0,0,0.6)",
  boxSizing: "border-box",
};

const headerStyle: React.CSSProperties = {
  textAlign: "center",
  marginBottom: "40px",
};

const logoIconStyle: React.CSSProperties = {
  fontSize: "3em",
  background: "var(--gradient-primary)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  marginBottom: "10px",
  fontWeight: "bold",
  display: "inline-block",
  lineHeight: "1.2",
  padding: "0 5px",
};

const titleStyle: React.CSSProperties = {
  margin: "0",
  fontSize: "2.2em",
  fontWeight: "bold",
  color: "var(--text-primary)",
  letterSpacing: "-1px",
};
const subtitleStyle: React.CSSProperties = {
  margin: "8px 0 0 0",
  fontSize: "1em",
  color: "var(--text-secondary)",
  fontWeight: "normal",
};
const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};
const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};
const labelStyle: React.CSSProperties = {
  fontSize: "0.9em",
  color: "var(--text-secondary)",
  fontWeight: "500",
  textTransform: "uppercase",
  letterSpacing: "1px",
  textAlign: "left",
};

const getInputStyle = (isFocused: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "16px 20px",
  backgroundColor: "var(--bg-input)",
  color: "var(--text-primary)",
  border: `2px solid ${isFocused ? "var(--color-user)" : "var(--color-border)"}`,
  borderRadius: BORDER_RADIUS.medium,
  fontSize: "1em",
  transition: "var(--transition-standard)",
  outline: "none",
  boxSizing: "border-box",
});

const getForgotLinkStyle = (isHovered: boolean): React.CSSProperties => ({
  fontSize: "0.85em",
  color: isHovered ? "var(--color-user)" : "var(--text-mute)",
  textDecoration: isHovered ? "underline" : "none",
  cursor: "pointer",
  transition: "var(--transition-standard)",
  whiteSpace: "nowrap",
});

const getMainButtonStyle = (
  isHovered: boolean,
  isLoading: boolean,
): React.CSSProperties => ({
  background: isLoading ? "var(--color-border)" : "var(--gradient-primary)",
  color: "#fff",
  border: "none",
  padding: "16px 20px",
  borderRadius: BORDER_RADIUS.medium,
  fontSize: "1.1em",
  fontWeight: "bold",
  cursor: isLoading ? "not-allowed" : "pointer",
  transition: "var(--transition-standard)",
  marginTop: "10px",
  boxShadow:
    isHovered && !isLoading ? "0 10px 30px rgba(0, 230, 118, 0.3)" : "none",
  transform: isHovered && !isLoading ? "translateY(-2px)" : "none",
});

const statusAreaStyle: React.CSSProperties = {
  minHeight: "25px",
  textAlign: "center",
};
const errorTextStyle: React.CSSProperties = {
  color: "var(--error-color)",
  fontSize: "0.9em",
  margin: "0",
  fontWeight: "500",
};
const successTextStyle: React.CSSProperties = {
  color: "var(--color-user)",
  fontSize: "0.9em",
  margin: "0",
  fontWeight: "500",
};
const loadingTextStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "0.9em",
  margin: "0",
  fontStyle: "italic",
};

const magicAreaStyle: React.CSSProperties = {
  marginTop: "40px",
  borderTop: `1px solid var(--color-border)`,
  paddingTop: "30px",
  textAlign: "center",
};
const magicTitleStyle: React.CSSProperties = {
  margin: "0 0 15px 0",
  fontSize: "0.8em",
  color: "var(--text-mute)",
  textTransform: "uppercase",
  letterSpacing: "1px",
};
const magicButtonsGroupStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: "15px",
};

const getMagicButtonStyle = (isHovered: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  padding: "10px 18px",
  backgroundColor: isHovered ? "var(--bg-input)" : "transparent",
  color: isHovered ? "var(--text-primary)" : "var(--text-secondary)",
  border: `1px solid ${isHovered ? "var(--text-primary)" : "var(--color-border)"}`,
  borderRadius: BORDER_RADIUS.medium,
  fontSize: "0.85em",
  cursor: "pointer",
  transition: "var(--transition-standard)",
  fontWeight: "500",
});
