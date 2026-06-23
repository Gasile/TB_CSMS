import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchUserBadges,
  unlinkAndBlockBadge,
  linkNewBadge,
  updateMyBadgeName,
} from "../../api/userApi";

interface BadgeFromDB {
  id: number;
  Authorization?: {
    id: number;
    idToken: string;
    status: string;
    badge_name: string;
  };
}

const emojiStyle: React.CSSProperties = {
  background: "var(--gradient-primary)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  display: "inline-block",
  lineHeight: "1.2",
};

export default function UserBadges({ user: propUser }: { user?: any }) {
  const { user: authUser } = useAuth();
  const activeUser = propUser || authUser;

  // Détection du rôle Admin pour l'utilisateur actuellement connecté
  const isAdmin = authUser?.role === "Admin";

  const [badges, setBadges] = useState<BadgeFromDB[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newBadgeName, setNewBadgeName] = useState("");
  const [newIdToken, setNewIdToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAddBtnHovered, setIsAddBtnHovered] = useState(false);
  const [isSaveBtnHovered, setIsSaveBtnHovered] = useState(false);
  const [isCancelBtnHovered, setIsCancelBtnHovered] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isTokenFocused, setIsTokenFocused] = useState(false);

  const loadBadges = async () => {
    if (!activeUser?.id) return;
    try {
      const data = await fetchUserBadges(activeUser.id);
      if (data) setBadges(data);
    } catch (err) {
      console.error("Erreur de récupération des badges:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBadges();
  }, [activeUser?.id]);

  const handleUnlink = async (
    userBadgeId: number,
    authId: number | undefined,
  ) => {
    if (!authId) return;
    if (
      !window.confirm(
        "Voulez-vous vraiment dissocier ce badge ? Il sera automatiquement bloqué pour des raisons de sécurité.",
      )
    )
      return;

    try {
      await unlinkAndBlockBadge(userBadgeId, authId);
      loadBadges();
    } catch (err) {
      alert("Erreur lors de la dissociation.");
    }
  };

  const handleRename = async (authId: number, newName: string) => {
    try {
      await updateMyBadgeName(authId, newName);
      loadBadges();
    } catch (err: any) {
      alert("Erreur lors de la modification : " + err.message);
    }
  };

  const handleAddBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = newIdToken.trim().toUpperCase();
    const name = newBadgeName.trim();
    if (!token || !name || !activeUser?.id) return;

    setIsSubmitting(true);
    try {
      await linkNewBadge(activeUser.id, token, name);
      setNewIdToken("");
      setNewBadgeName("");
      setShowAddForm(false);
      loadBadges();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeUser) return null;
  if (loading)
    return (
      <p style={{ color: "var(--text-secondary)", padding: "20px" }}>
        Chargement des badges RFID...
      </p>
    );

  return (
    <div style={cardStyle}>
      <div style={headerContainerStyle}>
        <div style={{ textAlign: "left" }}>
          <h2 style={{ margin: "0 0 5px 0", color: "var(--text-primary)" }}>
            Badges RFID
          </h2>
          <p
            style={{
              margin: 0,
              color: "var(--text-secondary)",
              fontSize: "0.9em",
            }}
          >
            Gérez les cartes d'accès liées à ce compte.
          </p>
        </div>

        {!showAddForm && isAdmin && (
          <button
            onClick={() => setShowAddForm(true)}
            onMouseEnter={() => setIsAddBtnHovered(true)}
            onMouseLeave={() => setIsAddBtnHovered(false)}
            style={getAddButtonStyle(isAddBtnHovered)}
          >
            <span style={{ marginRight: "6px", ...emojiStyle }}>➕</span> Lier
            un badge
          </button>
        )}
      </div>

      {showAddForm && isAdmin && (
        <form onSubmit={handleAddBadge} style={formBoxStyle}>
          <h4 style={{ margin: "0 0 15px 0", color: "var(--text-primary)" }}>
            Ajouter un nouveau badge
          </h4>
          <div
            style={{
              display: "flex",
              gap: "15px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              value={newBadgeName}
              onChange={(e) => setNewBadgeName(e.target.value)}
              placeholder="Nom du badge (ex: Clé Maison)"
              required
              onFocus={() => setIsNameFocused(true)}
              onBlur={() => setIsNameFocused(false)}
              style={getInputStyle(isNameFocused)}
            />
            <input
              type="text"
              value={newIdToken}
              onChange={(e) => setNewIdToken(e.target.value)}
              placeholder="UID (ex: DEADBEEF)"
              required
              onFocus={() => setIsTokenFocused(true)}
              onBlur={() => setIsTokenFocused(false)}
              style={{
                ...getInputStyle(isTokenFocused),
                fontFamily: "monospace",
              }}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              onMouseEnter={() => setIsSaveBtnHovered(true)}
              onMouseLeave={() => setIsSaveBtnHovered(false)}
              style={getSaveButtonStyle(isSaveBtnHovered, isSubmitting)}
            >
              {isSubmitting ? "Liaison..." : "Sauvegarder"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewIdToken("");
                setNewBadgeName("");
              }}
              onMouseEnter={() => setIsCancelBtnHovered(true)}
              onMouseLeave={() => setIsCancelBtnHovered(false)}
              style={getCancelButtonStyle(isCancelBtnHovered)}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div
        style={{
          height: "1px",
          backgroundColor: "var(--color-border)",
          margin: "25px 0",
        }}
      />

      {badges.length === 0 ? (
        <p
          style={{
            color: "var(--text-mute)",
            fontStyle: "italic",
            textAlign: "center",
            padding: "20px 0",
          }}
        >
          Aucun badge associé à ce compte.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: `2px solid var(--color-border)`,
                  color: "var(--text-secondary)",
                }}
              >
                <th style={thStyle}>Nom du Badge</th>
                <th style={thStyle}>ID Token</th>
                <th style={thStyle}>Statut</th>
                {/* On affiche la colonne Action uniquement pour les administrateurs */}
                {isAdmin && (
                  <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
                )}
              </tr>
            </thead>
            <tbody>
              {badges.map((b) => (
                <UserBadgeRow
                  key={b.id}
                  badge={b}
                  onUnlink={() => handleUnlink(b.id, b.Authorization?.id)}
                  onRename={handleRename}
                  isAdmin={isAdmin}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// SOUS COMPOSANT POUR PERMETTRE L'EDITION DU NOM PAR L'UTILISATEUR
function UserBadgeRow({
  badge,
  onUnlink,
  onRename,
  isAdmin,
}: {
  badge: BadgeFromDB;
  onUnlink: () => void;
  onRename: (id: number, name: string) => void;
  isAdmin: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(
    badge.Authorization?.badge_name || "",
  );
  const [isHovered, setIsHovered] = useState(false);
  const [isEditBtnHovered, setIsEditBtnHovered] = useState(false);
  const [isSaveBtnHovered, setIsSaveBtnHovered] = useState(false);

  const handleSave = () => {
    if (
      tempName.trim() !== "" &&
      tempName.trim() !== badge.Authorization?.badge_name
    ) {
      if (badge.Authorization)
        onRename(badge.Authorization.id, tempName.trim());
    }
    setIsEditing(false);
  };

  return (
    <tr
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderBottom: `1px solid var(--color-border)`,
        backgroundColor:
          isHovered && !isEditing ? "var(--bg-input)" : "transparent",
        transition: "var(--transition-standard)",
      }}
    >
      <td
        style={{ ...tdStyle, color: "var(--text-primary)", fontWeight: "bold" }}
      >
        {isEditing ? (
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              style={{
                ...getInputStyle(true),
                padding: "6px 10px",
                minWidth: "150px",
              }}
            />
            <button
              onClick={handleSave}
              onMouseEnter={() => setIsSaveBtnHovered(true)}
              onMouseLeave={() => setIsSaveBtnHovered(false)}
              style={iconButtonStyle(isSaveBtnHovered, "var(--color-user)")}
            >
              ✅
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ marginRight: "5px", ...emojiStyle }}>💳</span>{" "}
            {badge.Authorization?.badge_name || (
              <span style={{ fontStyle: "italic", color: "var(--text-mute)" }}>
                Sans nom
              </span>
            )}
            <button
              onClick={() => setIsEditing(true)}
              onMouseEnter={() => setIsEditBtnHovered(true)}
              onMouseLeave={() => setIsEditBtnHovered(false)}
              style={iconButtonStyle(isEditBtnHovered, "var(--text-secondary)")}
            >
              ✏️
            </button>
          </div>
        )}
      </td>
      <td
        style={{
          ...tdStyle,
          fontFamily: "monospace",
          fontSize: "1.1em",
          color: "var(--text-primary)",
          fontWeight: "bold",
        }}
      >
        {badge.Authorization?.idToken || "Erreur Data"}
      </td>
      <td style={tdStyle}>
        <span
          style={getStatusBadgeStyle(badge.Authorization?.status || "Unknown")}
        >
          {badge.Authorization?.status || "Erreur Data"}
        </span>
      </td>
      {/* On affiche la cellule d'action uniquement pour les administrateurs */}
      {isAdmin && (
        <td style={{ ...tdStyle, textAlign: "right" }}>
          <UnlinkButton onClick={onUnlink} />
        </td>
      )}
    </tr>
  );
}

function UnlinkButton({ onClick }: { onClick: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: "8px 16px",
        backgroundColor: isHovered ? "rgba(255, 82, 82, 0.15)" : "transparent",
        color: isHovered ? "var(--error-color)" : "var(--text-mute)",
        border: `1px solid ${isHovered ? "var(--error-color)" : "var(--color-border)"}`,
        borderRadius: "10px",
        cursor: "pointer",
        fontWeight: "600",
        fontSize: "0.85em",
        transition: "var(--transition-standard)",
      }}
    >
      <span style={{ marginRight: "5px" }}>✖️</span> Dissocier
    </button>
  );
}

const cardStyle: React.CSSProperties = {
  border: "3px solid transparent",
  background: `linear-gradient(var(--bg-card), var(--bg-card)) padding-box, var(--gradient-primary) border-box`,
  padding: "40px",
  borderRadius: "50px",
  boxShadow: "var(--shadow-card)",
  width: "100%",
  maxWidth: "800px",
  boxSizing: "border-box",
  margin: "0 auto",
};
const headerContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "20px",
};
const getAddButtonStyle = (isHovered: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  padding: "12px 22px",
  backgroundColor: isHovered ? "var(--bg-user-active)" : "transparent",
  color: isHovered ? "var(--color-user)" : "var(--text-secondary)",
  border: `1px solid ${isHovered ? "var(--color-user)" : "var(--color-border)"}`,
  borderRadius: "14px",
  fontSize: "0.95em",
  fontWeight: "600",
  cursor: "pointer",
  transition: "var(--transition-standard)",
  whiteSpace: "nowrap",
});
const formBoxStyle: React.CSSProperties = {
  marginTop: "25px",
  padding: "25px",
  backgroundColor: "var(--bg-input)",
  borderRadius: "20px",
  border: `1px solid var(--color-border)`,
};
const getInputStyle = (isFocused: boolean): React.CSSProperties => ({
  flex: 1,
  minWidth: "200px",
  padding: "12px 15px",
  backgroundColor: "var(--bg-card)",
  color: "var(--text-primary)",
  border: `1px solid ${isFocused ? "var(--color-user)" : "var(--color-border)"}`,
  borderRadius: "10px",
  fontSize: "1em",
  outline: "none",
  transition: "var(--transition-standard)",
});
const getSaveButtonStyle = (
  isHovered: boolean,
  disabled: boolean,
): React.CSSProperties => ({
  background: disabled ? "var(--color-border)" : "var(--gradient-primary)",
  color: "#fff",
  border: "none",
  padding: "12px 25px",
  borderRadius: "10px",
  fontWeight: "bold",
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: "0.95em",
  transition: "var(--transition-standard)",
  opacity: isHovered && !disabled ? 0.9 : 1,
});
const getCancelButtonStyle = (isHovered: boolean): React.CSSProperties => ({
  backgroundColor: "transparent",
  color: isHovered ? "var(--text-primary)" : "var(--text-secondary)",
  border: `1px solid ${isHovered ? "var(--text-secondary)" : "var(--color-border)"}`,
  padding: "12px 25px",
  borderRadius: "10px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "0.95em",
  transition: "var(--transition-standard)",
});
const thStyle: React.CSSProperties = {
  padding: "15px 10px",
  textTransform: "uppercase",
  fontSize: "0.85em",
  letterSpacing: "1px",
};
const tdStyle: React.CSSProperties = {
  padding: "15px 10px",
  verticalAlign: "middle",
};
const getStatusBadgeStyle = (status: string): React.CSSProperties => {
  const isAccepted = status === "Accepted";
  return {
    backgroundColor: isAccepted
      ? "var(--bg-user-active)"
      : "rgba(255, 82, 82, 0.15)",
    color: isAccepted ? "var(--color-user)" : "var(--error-color)",
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "0.85em",
    fontWeight: "bold",
    border: `1px solid ${isAccepted ? "var(--color-user)" : "var(--error-color)"}`,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };
};
const iconButtonStyle = (
  isHovered: boolean,
  color: string,
): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  padding: "6px 10px",
  backgroundColor: isHovered ? "var(--bg-card)" : "transparent",
  color: color,
  border: `1px solid ${isHovered ? color : "transparent"}`,
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.85em",
  transition: "var(--transition-standard)",
});
