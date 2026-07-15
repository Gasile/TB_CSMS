// ============================================================================
// IMPORTS
// ============================================================================

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchUserById, unassignAndBlockBadge } from "../../../api/adminApi";
import {
  fetchUserBadges,
  fetchUserSessions,
  linkNewBadge,
} from "../../../api/userApi";

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

const SESSIONS_PER_PAGE = 10;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Administrative panel displaying a comprehensive user profile workspace,
 * linked RFID tokens management tools, and sorted historical charging logs.
 */
export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = Number(id);

  // Core component states
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  // Form & modal state fields
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [badgeForm, setBadgeForm] = useState({ idToken: "", badgeName: "" });

  // Column sorting configurations
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "startTime",
    direction: "desc",
  });

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (userId) {
      loadAllData();
    }
  }, [userId]);

  /**
   * Fetches the user identity card, linked badges, and charging transaction profiles concurrently.
   */
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [userData, badgesData, sessionsData] = await Promise.all([
        fetchUserById(userId),
        fetchUserBadges(userId),
        fetchUserSessions(userId),
      ]);
      setUser(userData);
      setBadges(badgesData || []);
      setSessions(sessionsData || []);
      setCurrentPage(1);
    } catch (error) {
      console.error("Erreur lors du chargement du dossier :", error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Triggers an unassignment cycle for a badge link and automatically flags the auth token as blocked.
   */
  const handleUnlinkBadge = async (ubId: number, authId: number) => {
    if (
      window.confirm(
        "Voulez-vous vraiment retirer ce badge ? Il sera automatiquement bloqué.",
      )
    ) {
      await unassignAndBlockBadge(ubId, authId);
      loadAllData();
    }
  };

  /**
   * Submits a link configuration request to register a new token under this user's context.
   */
  const handleLinkBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await linkNewBadge(userId, badgeForm.idToken, badgeForm.badgeName);
      setIsModalOpen(false);
      setBadgeForm({ idToken: "", badgeName: "" });
      loadAllData();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'assignation du badge.");
    }
  };

  /**
   * Adjusts active table layout sort keys and flips arrangement vector orientation flags.
   */
  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  // --- SORTING PIPELINE PARSING ---
  const sortedSessions = [...sessions].sort((a, b) => {
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];

    // Status description normalization mapping rule
    if (sortConfig.key === "status") {
      valA = a.isActive ? "0_En_cours" : a.chargingState || "Terminé";
      valB = b.isActive ? "0_En_cours" : b.chargingState || "Terminé";
    }
    if (valA == null) valA = "";
    if (valB == null) valB = "";

    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // --- PAGINATION LIMITS CALCULATIONS ---
  const totalPages = Math.ceil(sortedSessions.length / SESSIONS_PER_PAGE);
  const paginatedSessions = sortedSessions.slice(
    (currentPage - 1) * SESSIONS_PER_PAGE,
    currentPage * SESSIONS_PER_PAGE,
  );

  /**
   * Evaluates the active column sorting setup to render contextual state arrows.
   */
  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key)
      return <span style={{ opacity: 0.3, marginLeft: "4px" }}>↕</span>;
    return (
      <span style={{ marginLeft: "4px" }}>
        {sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  if (isLoading && !user)
    return (
      <div style={{ padding: "30px", color: "var(--text-main)" }}>
        Chargement du dossier...
      </div>
    );
  if (!user)
    return (
      <div style={{ padding: "30px", color: "var(--status-offline)" }}>
        Utilisateur introuvable.
      </div>
    );

  // Accumulate historical delivered electricity metrics for summary cards
  const totalKwh = sessions.reduce((sum, s) => sum + (s.totalKwh || 0), 0);

  return (
    <div style={containerStyle}>
      {/* Identity Profile & Aggregates Summary Header */}
      <div style={headerCardStyle}>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <button
            onClick={() => navigate("/admin-users")}
            style={backButtonStyle}
          >
            ← Retour
          </button>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "1.8rem",
                color: "var(--text-main)",
                transition: "var(--theme-transition)",
              }}
            >
              {user.first_name} {user.last_name}
            </h1>
            <p
              style={{
                margin: "5px 0 0 0",
                color: "var(--text-muted)",
                transition: "var(--theme-transition)",
              }}
            >
              {user.email} •{" "}
              <span style={roleBadgeStyle(user.role)}>{user.role}</span>
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "30px" }}>
          <div style={kpiStyle}>
            <span style={kpiLabelStyle}>Énergie totale</span>
            <span style={kpiValueStyle}>
              {totalKwh.toFixed(1)}{" "}
              <small style={{ fontSize: "1rem" }}>kWh</small>
            </span>
          </div>
          <div style={kpiStyle}>
            <span style={kpiLabelStyle}>Sessions de charge</span>
            <span style={kpiValueStyle}>{sessions.length}</span>
          </div>
        </div>
      </div>

      {/* Main Split Interface Area */}
      <div style={gridStyle}>
        {/* LEFT COMPONENT DESK (2/3) : PAGINATED TRANSACTIONS HISTORICAL DATA TABLE */}
        <div style={{ ...cardStyle, gridColumn: "span 2", padding: 0 }}>
          <h2 style={{ ...sectionTitleStyle, margin: "20px" }}>
            Historique des sessions
          </h2>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-color)" }}>
                  <th
                    style={sortableThStyle}
                    onClick={() => handleSort("startTime")}
                  >
                    Date & Transaction {getSortIndicator("startTime")}
                  </th>
                  <th
                    style={sortableThStyle}
                    onClick={() => handleSort("ocppConnectionName")}
                  >
                    Borne {getSortIndicator("ocppConnectionName")}
                  </th>
                  <th
                    style={sortableThStyle}
                    onClick={() => handleSort("status")}
                  >
                    Statut {getSortIndicator("status")}
                  </th>
                  <th
                    style={sortableThStyle}
                    onClick={() => handleSort("totalKwh")}
                  >
                    Énergie {getSortIndicator("totalKwh")}
                  </th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSessions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        padding: "20px",
                        color: "var(--text-muted)",
                      }}
                    >
                      Aucune session de charge enregistrée.
                    </td>
                  </tr>
                ) : (
                  paginatedSessions.map((s: any) => {
                    const dateStr = s.startTime
                      ? new Date(s.startTime).toLocaleDateString()
                      : "N/A";
                    let rowBg = "transparent";
                    if (s.isActive) {
                      rowBg =
                        s.is_legal === false
                          ? "rgba(239, 68, 68, 0.08)"
                          : "rgba(16, 185, 129, 0.08)";
                    }

                    return (
                      <tr
                        key={s.id}
                        style={{
                          borderBottom: "1px solid var(--border-color)",
                          background: rowBg,
                          transition: "var(--theme-transition)",
                        }}
                      >
                        <td style={tdStyle}>
                          <strong>{dateStr}</strong>
                          <div
                            style={{
                              fontSize: "0.85rem",
                              color: "var(--text-muted)",
                              wordBreak: "break-all",
                              transition: "var(--theme-transition)",
                            }}
                          >
                            #{s.transactionId || s.id}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          {s.ChargingStation?.chargePointModel
                            ? `${s.ChargingStation.chargePointModel} `
                            : ""}
                          {s.ocppConnectionName}
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={statusBadgeStyle(
                              s.chargingState || "Terminé",
                            )}
                          >
                            {s.isActive
                              ? "En cours"
                              : s.chargingState || "Terminé"}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <strong>
                            {s.totalKwh ? s.totalKwh.toFixed(2) : "0.00"}
                          </strong>{" "}
                          kWh
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <button
                            onClick={() => navigate(`/session/${s.id}`)}
                            style={detailsButtonStyle}
                          >
                            Détails ➔
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Section */}
          {totalPages > 1 && (
            <div style={paginationContainerStyle}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={paginationButtonStyle(currentPage === 1)}
              >
                Précédent
              </button>
              <span style={paginationTextStyle}>
                Page {currentPage} sur {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                style={paginationButtonStyle(currentPage === totalPages)}
              >
                Suivant
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COMPONENT DESK (1/3) : ASSIGNED RFID CREDENTIALS MANAGEMENT PANEL */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h2 style={sectionTitleStyle}>Badges assignés ({badges.length})</h2>
            <button onClick={() => setIsModalOpen(true)} style={addButtonStyle}>
              + Assigner un badge
            </button>
          </div>

          {badges.length === 0 ? (
            <p
              style={{
                color: "var(--text-muted)",
                textAlign: "center",
                padding: "20px",
                transition: "var(--theme-transition)",
              }}
            >
              Aucun badge lié à ce compte.
            </p>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {badges.map((b: any) => (
                <div key={b.id} style={badgeListItemStyle}>
                  <div>
                    <strong
                      style={{
                        color: "var(--text-main)",
                        transition: "var(--theme-transition)",
                      }}
                    >
                      {b.Authorization.badge_name}
                    </strong>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--text-muted)",
                        fontFamily: "monospace",
                        marginTop: "4px",
                        transition: "var(--theme-transition)",
                      }}
                    >
                      {b.Authorization.idToken}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnlinkBadge(b.id, b.Authorization.id)}
                    style={deleteButtonStyle}
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- CREDIT ASSOCIATION SUBMIT FORM POPUP MODAL --- */}
      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ marginTop: 0, color: "var(--text-main)" }}>
              Assigner un Badge
            </h2>
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--text-muted)",
                marginBottom: "20px",
              }}
            >
              Si le Token existe déjà et est bloqué, il sera réactivé et
              réassigné à cet utilisateur.
            </p>
            <form
              onSubmit={handleLinkBadge}
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <div>
                <label style={labelStyle}>Nom du badge</label>
                <input
                  required
                  style={inputStyle}
                  value={badgeForm.badgeName}
                  onChange={(e) =>
                    setBadgeForm({ ...badgeForm, badgeName: e.target.value })
                  }
                  placeholder="Ex: Clé de voiture"
                />
              </div>
              <div>
                <label style={labelStyle}>ID Token (RFID)</label>
                <input
                  required
                  style={inputStyle}
                  value={badgeForm.idToken}
                  onChange={(e) =>
                    setBadgeForm({ ...badgeForm, idToken: e.target.value })
                  }
                  placeholder="Ex: A1B2C3D4"
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={cancelButtonStyle}
                >
                  Annuler
                </button>
                <button type="submit" style={addButtonStyle}>
                  Assigner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STYLES & LAYOUTS (INLINE CSS VARIABLES ADAPTATION)
// ============================================================================

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "25px",
};

const headerCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "25px",
  borderRadius: "12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "20px",
  transition: "var(--theme-transition)",
};

const backButtonStyle: React.CSSProperties = {
  background: "var(--bg-app)",
  border: "1px solid var(--border-color)",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};

const roleBadgeStyle = (role: string): React.CSSProperties => {
  const isAdmin = role === "Admin";
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "0.75rem",
    fontWeight: "600",
    background: isAdmin ? "rgba(251, 191, 36, 0.15)" : "var(--border-color)",
    color: isAdmin ? "var(--status-maintenance)" : "var(--text-muted)",
    transition: "var(--theme-transition)",
  };
};

const kpiStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  fontWeight: "600",
  letterSpacing: "0.05em",
  transition: "var(--theme-transition)",
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: "1.8rem",
  fontWeight: "bold",
  color: "var(--text-main)",
  lineHeight: "1.2",
  transition: "var(--theme-transition)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "25px",
};

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "25px",
  borderRadius: "12px",
  transition: "var(--theme-transition)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.2rem",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};

const badgeListItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "15px",
  border: "1px solid var(--border-color)",
  borderRadius: "8px",
  background: "var(--bg-app)",
  transition: "var(--theme-transition)",
};

const addButtonStyle: React.CSSProperties = {
  background: "var(--primary)",
  color: "#fff",
  border: "none",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: "600",
  transition: "var(--theme-transition)",
};

const deleteButtonStyle: React.CSSProperties = {
  background: "rgba(239, 68, 68, 0.15)",
  color: "var(--status-offline)",
  border: "1px solid var(--status-offline)",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: "600",
  transition: "var(--theme-transition)",
};

const thStyle: React.CSSProperties = {
  padding: "15px 20px",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  transition: "var(--theme-transition)",
};

const tdStyle: React.CSSProperties = {
  padding: "15px 20px",
  fontSize: "0.95rem",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};

const statusBadgeStyle = (status: string): React.CSSProperties => {
  const isCharging = status === "Charging" || status === "Active";
  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "0.8rem",
    fontWeight: "600",
    background: isCharging ? "rgba(16, 185, 129, 0.15)" : "var(--bg-app)",
    color: isCharging ? "var(--status-charging)" : "var(--text-muted)",
    transition: "var(--theme-transition)",
  };
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "30px",
  borderRadius: "12px",
  width: "100%",
  maxWidth: "400px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
  transition: "var(--theme-transition)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "5px",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "var(--text-muted)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid var(--border-color)",
  background: "var(--bg-card)",
  color: "var(--text-main)",
  fontSize: "0.95rem",
  outline: "none",
};

const cancelButtonStyle: React.CSSProperties = {
  background: "var(--bg-app)",
  color: "var(--text-muted)",
  border: "1px solid var(--border-color)",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  transition: "var(--theme-transition)",
};

const detailsButtonStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "6px 12px",
  borderRadius: "6px",
  fontSize: "0.8rem",
  fontWeight: "600",
  color: "var(--text-main)",
  cursor: "pointer",
  transition: "all 0.2s ease, var(--theme-transition)",
};

const sortableThStyle: React.CSSProperties = {
  ...thStyle,
  cursor: "pointer",
  userSelect: "none",
};

const paginationContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "15px 20px",
  borderTop: "1px solid var(--border-color)",
  background: "var(--bg-app)",
  borderBottomLeftRadius: "12px",
  borderBottomRightRadius: "12px",
  transition: "var(--theme-transition)",
};

const paginationButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "6px 12px",
  borderRadius: "6px",
  border: "1px solid var(--border-color)",
  background: disabled ? "transparent" : "var(--bg-card)",
  color: disabled ? "var(--text-muted)" : "var(--text-main)",
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: "0.85rem",
  fontWeight: "600",
  transition: "var(--theme-transition)",
  opacity: disabled ? 0.5 : 1,
});

const paginationTextStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "var(--text-muted)",
  fontWeight: "500",
  transition: "var(--theme-transition)",
};
