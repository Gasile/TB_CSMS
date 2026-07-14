import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchStationById,
  fetchStationTransactions,
} from "../../../api/stationApi";

const SESSIONS_PER_PAGE = 10; // <-- Configurable ici

export default function StationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const stationId = Number(id);

  const [isLoading, setIsLoading] = useState(true);
  const [station, setStation] = useState<any>(null);
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
    if (stationId) {
      loadData();
    }
  }, [stationId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const stationData = await fetchStationById(stationId);
      setStation(stationData);

      if (stationData && stationData.ocppConnectionName) {
        const sessionsData = await fetchStationTransactions(
          stationData.ocppConnectionName,
        );
        setSessions(sessionsData || []);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error("Erreur lors du chargement de la borne :", error);
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
    setCurrentPage(1); // Reset de la pagination au tri
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];

    if (sortConfig.key === "status") {
      valA = a.isActive ? "0_En_cours" : a.chargingState || "Terminé";
      valB = b.isActive ? "0_En_cours" : b.chargingState || "Terminé";
    } else if (sortConfig.key === "User") {
      valA = a.User
        ? `${a.User.last_name} ${a.User.first_name}`.toLowerCase()
        : "zzzz";
      valB = b.User
        ? `${b.User.last_name} ${b.User.first_name}`.toLowerCase()
        : "zzzz";
    } else if (sortConfig.key === "startTime") {
      valA = a.startTime ? new Date(a.startTime).getTime() : 0;
      valB = b.startTime ? new Date(b.startTime).getTime() : 0;
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

  if (isLoading && !station)
    return (
      <div style={{ padding: "30px", color: "var(--text-main)" }}>
        Chargement du dossier de la borne...
      </div>
    );
  if (!station)
    return (
      <div style={{ padding: "30px", color: "var(--status-offline)" }}>
        Borne introuvable.
      </div>
    );

  const totalKwh = sessions.reduce((sum, s) => sum + (s.totalKwh || 0), 0);
  const activeSessions = sessions.filter((s) => s.isActive).length;

  return (
    <div style={containerStyle}>
      <div style={headerCardStyle}>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <button
            onClick={() => navigate("/admin-stations")}
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
                {station.ocppConnectionName}
              </h1>
              <span style={onlineBadgeStyle(station.isOnline)}>
                {station.isOnline ? "En ligne" : "Hors ligne"}
              </span>
            </div>
            <p
              style={{
                margin: "5px 0 0 0",
                color: "var(--text-muted)",
                transition: "var(--theme-transition)",
              }}
            >
              {station.chargePointVendor || "Marque inconnue"} •{" "}
              {station.chargePointModel || "Modèle inconnu"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "30px" }}>
          <div style={kpiStyle}>
            <span style={kpiLabelStyle}>Énergie totale délivrée</span>
            <span style={kpiValueStyle}>
              {totalKwh.toFixed(1)}{" "}
              <small style={{ fontSize: "1rem" }}>kWh</small>
            </span>
          </div>
          <div style={kpiStyle}>
            <span style={kpiLabelStyle}>Sessions totales</span>
            <span style={kpiValueStyle}>{sessions.length}</span>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px",
          }}
        >
          <h2 style={sectionTitleStyle}>Historique des sessions de charge</h2>
          {activeSessions > 0 && (
            <span
              style={{
                fontSize: "0.85rem",
                color: "var(--status-charging)",
                fontWeight: "bold",
                background: "rgba(0, 210, 143, 0.15)",
                padding: "4px 10px",
                borderRadius: "20px",
                transition: "var(--theme-transition)",
              }}
            >
              {activeSessions} session(s) en cours
            </span>
          )}
        </div>

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
                <th style={sortableThStyle} onClick={() => handleSort("User")}>
                  Utilisateur {getSortIndicator("User")}
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
                      padding: "30px",
                      color: "var(--text-muted)",
                    }}
                  >
                    Aucune session de charge enregistrée sur cette borne.
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
                            Utilisateur inconnu
                          </span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={statusBadgeStyle(
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
const onlineBadgeStyle = (isOnline: boolean): React.CSSProperties => ({
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "0.8rem",
  fontWeight: "600",
  background: isOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
  color: isOnline ? "var(--status-charging)" : "var(--status-offline)",
  transition: "var(--theme-transition)",
});
const statusBadgeStyle = (
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
  padding: "12px 20px",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  transition: "var(--theme-transition)",
};
const sortableThStyle: React.CSSProperties = {
  ...thStyle,
  cursor: "pointer",
  userSelect: "none",
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

const paginationContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "15px",
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
