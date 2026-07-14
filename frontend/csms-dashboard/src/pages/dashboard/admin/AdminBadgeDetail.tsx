import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchBadgeDetailAndSessions } from "../../../api/adminApi";

const SESSIONS_PER_PAGE = 10; // <-- Configurable ici

export default function AdminBadgeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const authId = Number(id);

  const [isLoading, setIsLoading] = useState(true);
  const [badge, setBadge] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "startTime",
    direction: "desc",
  });

  // --- ÉTAT DE LA PAGINATION ---
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (authId) loadData();
  }, [authId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchBadgeDetailAndSessions(authId);
      setBadge(data?.Authorizations_by_pk);
      setSessions(data?.Transactions || []);
      setCurrentPage(1);
    } catch (error) {
      console.error("Erreur lors du chargement du badge :", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset de la pagination
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];

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

  // --- LOGIQUE DE PAGINATION ---
  const totalPages = Math.ceil(sortedSessions.length / SESSIONS_PER_PAGE);
  const paginatedSessions = sortedSessions.slice(
    (currentPage - 1) * SESSIONS_PER_PAGE,
    currentPage * SESSIONS_PER_PAGE,
  );

  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key)
      return <span style={{ opacity: 0.3, marginLeft: "4px" }}>↕</span>;
    return (
      <span style={{ marginLeft: "4px" }}>
        {sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  if (isLoading && !badge)
    return (
      <div style={{ padding: "30px", color: "var(--text-main)" }}>
        Chargement du badge...
      </div>
    );
  if (!badge)
    return (
      <div style={{ padding: "30px", color: "var(--status-offline)" }}>
        Badge introuvable.
      </div>
    );

  const totalKwh = sessions.reduce((sum, s) => sum + (s.totalKwh || 0), 0);
  const owner =
    badge.UserBadges && badge.UserBadges.length > 0
      ? badge.UserBadges[0].User
      : null;

  return (
    <div style={containerStyle}>
      <div style={headerCardStyle}>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <button
            onClick={() => navigate("/admin-badges")}
            style={backButtonStyle}
          >
            ← Retour
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.8rem",
                  color: "var(--text-main)",
                  transition: "var(--theme-transition)",
                }}
              >
                {badge.badge_name || "Badge sans nom"}
              </h1>
              <span style={statusBadgeStyle(badge.status)}>{badge.status}</span>
            </div>
            <p
              style={{
                margin: "5px 0 0 0",
                color: "var(--text-muted)",
                fontFamily: "monospace",
                fontSize: "1rem",
                transition: "var(--theme-transition)",
              }}
            >
              {badge.idToken}
            </p>
            {owner ? (
              <p
                style={{
                  margin: "5px 0 0 0",
                  fontSize: "0.9rem",
                  color: "var(--text-main)",
                  transition: "var(--theme-transition)",
                }}
              >
                Appartient à :{" "}
                <strong>
                  {owner.first_name} {owner.last_name}
                </strong>
              </p>
            ) : (
              <p
                style={{
                  margin: "5px 0 0 0",
                  fontSize: "0.9rem",
                  color: "var(--text-muted)",
                  fontStyle: "italic",
                  transition: "var(--theme-transition)",
                }}
              >
                Aucun propriétaire assigné
              </p>
            )}
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
            <span style={kpiLabelStyle}>Sessions</span>
            <span style={kpiValueStyle}>{sessions.length}</span>
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 0 }}>
        <h2 style={{ ...sectionTitleStyle, margin: "20px" }}>
          Historique des charges avec ce badge
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
                <th style={thStyle}>Responsable</th>
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
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: "30px",
                      color: "var(--text-muted)",
                      transition: "var(--theme-transition)",
                    }}
                  >
                    Aucune session enregistrée pour ce badge.
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
                            transition: "var(--theme-transition)",
                          }}
                        >
                          #{s.transactionId || s.id}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        {s.User ? (
                          <span>
                            {s.User.first_name} {s.User.last_name}
                          </span>
                        ) : (
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontStyle: "italic",
                              transition: "var(--theme-transition)",
                            }}
                          >
                            Inconnu / Supprimé
                          </span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {s.ChargingStation?.chargePointModel
                          ? `${s.ChargingStation.chargePointModel} `
                          : ""}
                        {s.ocppConnectionName}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={txBadgeStyle(
                            s.chargingState || "Terminé",
                            s.isActive,
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

        {/* CONTRÔLES DE PAGINATION */}
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={paginationButtonStyle(currentPage === totalPages)}
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- STYLES ---
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
const statusBadgeStyle = (status: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "0.8rem",
  fontWeight: "600",
  background:
    status === "Accepted"
      ? "rgba(16, 185, 129, 0.15)"
      : "rgba(239, 68, 68, 0.15)",
  color:
    status === "Accepted" ? "var(--status-charging)" : "var(--status-offline)",
  transition: "var(--theme-transition)",
});
const txBadgeStyle = (
  status: string,
  isActive: boolean,
): React.CSSProperties => {
  const isCharging = isActive || status === "Charging";
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
const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  borderRadius: "12px",
  transition: "var(--theme-transition)",
};
const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.2rem",
  color: "var(--text-main)",
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
