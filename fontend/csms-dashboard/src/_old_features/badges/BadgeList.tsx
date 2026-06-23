import React, { useEffect, useState } from "react";
import {
  fetchAdminBadgesData,
  adminCreateBadge,
  updateBadgeStatus,
  assignBadge,
  reassignBadge,
  unassignAndBlockBadge,
  updateBadgeDetails,
} from "../../api/adminApi";

interface UserLight {
  id: number;
  first_name: string;
  last_name: string;
}
interface UserBadgeLink {
  id: number;
  user_id: number;
  authorization_id: number;
  User: UserLight;
}
interface BadgeAdminData {
  id: number;
  idToken: string;
  badge_name: string;
  status: string;
  UserBadge?: UserBadgeLink;
}

const emojiStyle: React.CSSProperties = {
  background: "var(--gradient-primary)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  display: "inline-block",
  lineHeight: "1.2",
};

export default function BadgeList() {
  const [badges, setBadges] = useState<BadgeAdminData[]>([]);
  const [usersList, setUsersList] = useState<UserLight[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newBadgeName, setNewBadgeName] = useState("");
  const [newIdToken, setNewIdToken] = useState("");
  const [newStatus, setNewStatus] = useState("Accepted");

  const [isAddBtnHovered, setIsAddBtnHovered] = useState(false);
  const [isSubmitBtnHovered, setIsSubmitBtnHovered] = useState(false);
  const [isCancelBtnHovered, setIsCancelBtnHovered] = useState(false);

  const loadData = async () => {
    try {
      const result = await fetchAdminBadgesData();
      if (result) {
        const auths = result.Authorizations;
        const ubs = result.UserBadges;
        const users = result.Users;

        const combinedBadges: BadgeAdminData[] = auths.map((auth: any) => {
          const linkedBadge = ubs.find(
            (ub: any) => ub.authorization_id === auth.id,
          );
          return { ...auth, UserBadge: linkedBadge };
        });

        setBadges(combinedBadges);
        setUsersList(users);
      }
    } catch (err) {
      console.error("Erreur de chargement des badges :", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = newIdToken.trim().toUpperCase();
    const name = newBadgeName.trim();
    if (!token || !name) return;
    try {
      await adminCreateBadge(token, name, newStatus);
      setNewIdToken("");
      setNewBadgeName("");
      setShowAddForm(false);
      loadData();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const handleToggleStatus = async (authId: number, currentStatus: string) => {
    try {
      await updateBadgeStatus(authId, currentStatus);
      loadData();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const handleUpdateDetails = async (
    authId: number,
    newToken: string,
    newName: string,
  ) => {
    try {
      await updateBadgeDetails(authId, newToken, newName);
      loadData();
    } catch (err: any) {
      alert(`Erreur lors de la modification du badge : ${err.message}`);
    }
  };

  const handleUserChange = async (
    authId: number,
    currentUserBadgeId: number | undefined,
    newUserIdStr: string,
  ) => {
    try {
      if (newUserIdStr === "") {
        if (currentUserBadgeId)
          await unassignAndBlockBadge(currentUserBadgeId, authId);
      } else {
        const newUserId = parseInt(newUserIdStr, 10);
        if (currentUserBadgeId)
          await reassignBadge(currentUserBadgeId, newUserId);
        else await assignBadge(authId, newUserId);
      }
      loadData();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const handleDeleteBadge = async (authId: number) => {
    if (
      !window.confirm(
        "Voulez-vous vraiment supprimer définitivement ce badge ?",
      )
    )
      return;

    try {
      const response = await fetch("http://localhost:8090/v1/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hasura-admin-secret": "TBCSMS",
        },
        body: JSON.stringify({
          query: `
            mutation DeleteBadge($authId: Int!) {
              delete_UserBadges(where: {authorization_id: {_eq: $authId}}) { affected_rows }
              delete_Authorizations_by_pk(id: $authId) { id }
            }
          `,
          variables: { authId },
        }),
      });
      const result = await response.json();
      if (result.errors) throw new Error(result.errors[0].message);
      loadData();
    } catch (err: any) {
      alert("Erreur : " + err.message);
    }
  };

  if (loading)
    return (
      <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
        Chargement du registre...
      </p>
    );

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <div style={{ textAlign: "left" }}>
          <h2
            style={{
              margin: "0 0 5px 0",
              color: "var(--text-primary)",
              fontSize: "1.8em",
            }}
          >
            <span style={{ marginRight: "10px", ...emojiStyle }}>💳</span>{" "}
            Gestion Globale des Badges
          </h2>
          <p
            style={{
              margin: 0,
              color: "var(--text-secondary)",
              fontSize: "0.95em",
            }}
          >
            Administrez le parc de badges RFID, les statuts d'autorisation et
            les assignations.
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            onMouseEnter={() => setIsAddBtnHovered(true)}
            onMouseLeave={() => setIsAddBtnHovered(false)}
            style={getAddButtonStyle(isAddBtnHovered)}
          >
            <span style={{ marginRight: "6px", ...emojiStyle }}>➕</span>{" "}
            Nouveau Badge
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateBadge} style={formBoxStyle}>
          <h4
            style={{
              margin: "0 0 15px 0",
              color: "var(--text-primary)",
              fontSize: "1.2em",
            }}
          >
            Enregistrer un nouveau badge RFID
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr auto",
              gap: "15px",
              alignItems: "end",
            }}
          >
            <div>
              <label style={labelStyle}>Nom du Badge</label>
              <input
                placeholder="Ex: Badge Secours"
                value={newBadgeName}
                onChange={(e) => setNewBadgeName(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Identifiant Token (UID)</label>
              <input
                placeholder="Ex: DEADBEEF"
                value={newIdToken}
                onChange={(e) => setNewIdToken(e.target.value)}
                required
                style={{ ...inputStyle, fontFamily: "monospace" }}
              />
            </div>
            <div>
              <label style={labelStyle}>Statut Initial</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                style={inputStyle}
              >
                <option
                  value="Accepted"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                  }}
                >
                  Accepted (Autorisé)
                </option>
                <option
                  value="Blocked"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                  }}
                >
                  Blocked (Bloqué)
                </option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="submit"
                onMouseEnter={() => setIsSubmitBtnHovered(true)}
                onMouseLeave={() => setIsSubmitBtnHovered(false)}
                style={getSubmitButtonStyle(isSubmitBtnHovered)}
              >
                <span style={{ marginRight: "5px", ...emojiStyle }}>✅</span>{" "}
                Créer
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
                <span style={{ marginRight: "5px", ...emojiStyle }}>❌</span>{" "}
                Annuler
              </button>
            </div>
          </div>
        </form>
      )}

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
              <th style={thStyle}>Assignation Utilisateur</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {badges.map((b) => (
              <BadgeRow
                key={b.id}
                badge={b}
                usersList={usersList}
                onToggleStatus={handleToggleStatus}
                onReassign={handleUserChange}
                onDelete={() => handleDeleteBadge(b.id)}
                onUpdateDetails={handleUpdateDetails}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BadgeRow({
  badge,
  usersList,
  onToggleStatus,
  onReassign,
  onDelete,
  onUpdateDetails,
}: {
  badge: BadgeAdminData;
  usersList: UserLight[];
  onToggleStatus: (id: number, status: string) => void;
  onReassign: (
    authId: number,
    userBadgeId: number | undefined,
    newUserIdStr: string,
  ) => void;
  onDelete: () => void;
  onUpdateDetails: (authId: number, newToken: string, newName: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const [isModifierHovered, setIsModifierHovered] = useState(false);
  const [isValiderHovered, setIsValiderHovered] = useState(false);
  const [isAnnulerHovered, setIsAnnulerHovered] = useState(false);
  const [isSupprimerHovered, setIsSupprimerHovered] = useState(false);

  const currentUserBadge = badge.UserBadge;
  const currentUserIdStr = currentUserBadge
    ? String(currentUserBadge.User?.id || "")
    : "";

  const [tempUserId, setTempUserId] = useState(currentUserIdStr);
  const [tempIdToken, setTempIdToken] = useState(badge.idToken);
  const [tempBadgeName, setTempBadgeName] = useState(badge.badge_name || "");

  const handleSave = () => {
    const formattedToken = tempIdToken.trim().toUpperCase();
    const formattedName = tempBadgeName.trim();

    if (formattedToken !== "" && formattedName !== "") {
      if (
        formattedToken !== badge.idToken ||
        formattedName !== badge.badge_name
      ) {
        onUpdateDetails(badge.id, formattedToken, formattedName);
      }
    }

    if (tempUserId !== currentUserIdStr) {
      onReassign(badge.id, currentUserBadge?.id, tempUserId);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempUserId(currentUserIdStr);
    setTempIdToken(badge.idToken);
    setTempBadgeName(badge.badge_name || "");
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
          <input
            value={tempBadgeName}
            onChange={(e) => setTempBadgeName(e.target.value)}
            style={{ ...inputStyle, padding: "6px 10px" }}
          />
        ) : (
          badge.badge_name || (
            <span style={{ color: "var(--text-mute)", fontStyle: "italic" }}>
              Sans nom
            </span>
          )
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
        {isEditing ? (
          <input
            value={tempIdToken}
            onChange={(e) => setTempIdToken(e.target.value)}
            style={{
              ...inputStyle,
              padding: "6px 10px",
              fontFamily: "monospace",
            }}
          />
        ) : (
          badge.idToken
        )}
      </td>
      <td style={tdStyle}>
        <span style={getStatusBadgeStyle(badge.status)}>{badge.status}</span>
      </td>
      <td style={tdStyle}>
        {isEditing ? (
          <select
            value={tempUserId}
            onChange={(e) => setTempUserId(e.target.value)}
            style={selectStyle}
          >
            <option
              value=""
              style={{ fontStyle: "italic", color: "var(--text-mute)" }}
            >
              -- Non assigné (Bloquer la carte) --
            </option>
            {usersList.map((u) => (
              <option
                key={u.id}
                value={String(u.id)}
                style={{
                  color: "var(--text-primary)",
                  background: "var(--bg-card)",
                }}
              >
                {u.last_name} {u.first_name}
              </option>
            ))}
          </select>
        ) : (
          <span
            style={{
              color: currentUserBadge
                ? "var(--text-primary)"
                : "var(--text-mute)",
              fontWeight: currentUserBadge ? "bold" : "normal",
              fontStyle: currentUserBadge ? "normal" : "italic",
            }}
          >
            {currentUserBadge && currentUserBadge.User
              ? `${currentUserBadge.User.last_name} ${currentUserBadge.User.first_name}`
              : "Non assigné"}
          </span>
        )}
      </td>
      <td
        style={{
          ...tdStyle,
          textAlign: "center",
          display: "flex",
          gap: "10px",
          justifyContent: "center",
        }}
      >
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              onMouseEnter={() => setIsValiderHovered(true)}
              onMouseLeave={() => setIsValiderHovered(false)}
              style={iconButtonStyle(
                isValiderHovered,
                "var(--color-user)",
                true,
              )}
            >
              <span style={{ marginRight: "5px", ...emojiStyle }}>✅</span>{" "}
              Valider
            </button>
            <button
              onClick={handleCancel}
              onMouseEnter={() => setIsAnnulerHovered(true)}
              onMouseLeave={() => setIsAnnulerHovered(false)}
              style={iconButtonStyle(
                isAnnulerHovered,
                "var(--error-color)",
                false,
              )}
            >
              <span style={{ marginRight: "5px", ...emojiStyle }}>❌</span>{" "}
              Annuler
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(true)}
              onMouseEnter={() => setIsModifierHovered(true)}
              onMouseLeave={() => setIsModifierHovered(false)}
              style={iconButtonStyle(
                isModifierHovered,
                "var(--text-secondary)",
                false,
              )}
            >
              <span style={{ marginRight: "5px", ...emojiStyle }}>✏️</span>{" "}
              Modifier
            </button>
            <ToggleButton
              isAccepted={badge.status === "Accepted"}
              onClick={() => onToggleStatus(badge.id, badge.status)}
            />
            <button
              onClick={onDelete}
              onMouseEnter={() => setIsSupprimerHovered(true)}
              onMouseLeave={() => setIsSupprimerHovered(false)}
              style={iconButtonStyle(
                isSupprimerHovered,
                "var(--error-color)",
                false,
              )}
            >
              <span style={{ marginRight: "5px" }}>🗑️</span>
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

function ToggleButton({
  isAccepted,
  onClick,
}: {
  isAccepted: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const color = isAccepted ? "var(--error-color)" : "var(--color-user)";
  const hoverBg = isAccepted
    ? "rgba(255, 82, 82, 0.15)"
    : "var(--bg-user-active)";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: "8px 16px",
        backgroundColor: isHovered ? hoverBg : "transparent",
        color: color,
        border: `1px solid ${isHovered ? color : "var(--color-border)"}`,
        borderRadius: "10px",
        cursor: "pointer",
        fontWeight: "bold",
        fontSize: "0.85em",
        transition: "var(--transition-standard)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ marginRight: "5px", ...emojiStyle }}>
        {isAccepted ? "🔒" : "🔓"}
      </span>
      {isAccepted ? "Bloquer" : "Accepter"}
    </button>
  );
}

const cardStyle: React.CSSProperties = {
  border: "3px solid transparent",
  background: `linear-gradient(var(--bg-card), var(--bg-card)) padding-box, var(--gradient-primary) border-box`,
  padding: "40px",
  borderRadius: "50px",
  boxShadow: "var(--shadow-card)",
  width: "fit-content",
  minWidth: "1000px",
  margin: "0 auto",
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
  marginTop: "10px",
  marginBottom: "35px",
  padding: "25px",
  backgroundColor: "var(--bg-input)",
  borderRadius: "20px",
  border: `1px solid var(--color-border)`,
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75em",
  color: "var(--text-mute)",
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontWeight: "700",
  marginBottom: "8px",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 15px",
  backgroundColor: "var(--bg-card)",
  color: "var(--text-primary)",
  border: `1px solid var(--color-border)`,
  borderRadius: "10px",
  fontSize: "1em",
  outline: "none",
  boxSizing: "border-box",
  transition: "var(--transition-standard)",
};
const getSubmitButtonStyle = (isHovered: boolean): React.CSSProperties => ({
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 15px",
  background: "var(--gradient-primary)",
  color: "white",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "1em",
  transition: "var(--transition-standard)",
  opacity: isHovered ? 0.9 : 1,
});
const getCancelButtonStyle = (isHovered: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 15px",
  backgroundColor: "transparent",
  color: isHovered ? "var(--text-primary)" : "var(--text-secondary)",
  border: `1px solid ${isHovered ? "var(--text-primary)" : "var(--color-border)"}`,
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "1em",
  transition: "var(--transition-standard)",
});
const thStyle: React.CSSProperties = {
  padding: "15px 10px",
  textTransform: "uppercase",
  fontSize: "0.85em",
  letterSpacing: "1px",
  fontWeight: "600",
};
const tdStyle: React.CSSProperties = {
  padding: "15px 10px",
  verticalAlign: "middle",
};
const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  backgroundColor: "var(--bg-input)",
  color: "var(--text-primary)",
  border: `1px solid var(--color-border)`,
  borderRadius: "8px",
  fontSize: "0.9em",
  outline: "none",
  cursor: "pointer",
  transition: "var(--transition-standard)",
};
const iconButtonStyle = (
  isHovered: boolean,
  color: string,
  isPrimary: boolean,
): React.CSSProperties => {
  const hoverBg = isPrimary
    ? color === "var(--color-user)"
      ? "var(--bg-user-active)"
      : "rgba(255, 82, 82, 0.15)"
    : "var(--bg-input)";
  return {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    backgroundColor: isHovered ? hoverBg : "transparent",
    color: isHovered ? (isPrimary ? color : "var(--text-primary)") : color,
    border: `1px solid ${isHovered ? (isPrimary ? color : "var(--text-primary)") : isPrimary ? color : "var(--color-border)"}`,
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "0.85em",
    transition: "var(--transition-standard)",
    whiteSpace: "nowrap",
  };
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
