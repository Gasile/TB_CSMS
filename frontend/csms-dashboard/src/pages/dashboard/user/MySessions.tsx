import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { fetchUserSessions } from "../../../api/userApi";

export default function MySessions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);

  // --- ÉTAT DU TRI ---
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "startTime",
    direction: "desc", // Par défaut, la plus récente en premier
  });

  useEffect(() => {
    if (userId) loadSessions();
  }, [userId]);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUserSessions(userId!);
      setSessions(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des sessions :", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- LOGIQUE DE TRI ---
  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"; // Inverse le tri si on reclique sur la même colonne
    }
    setSortConfig({ key, direction });
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];

    // Cas particulier : on veut trier correctement le statut "En cours"
    if (sortConfig.key === "status") {
      valA = a.isActive ? "0_En_cours" : a.chargingState || "Terminé";
      valB = b.isActive ? "0_En_cours" : b.chargingState || "Terminé";
    }

    // Sécurité contre les valeurs nulles
    if (valA == null) valA = "";
    if (valB == null) valB = "";

    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Petit Helper pour afficher les flèches (↑, ↓, ↕)
  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key)
      return <span style={{ opacity: 0.3, marginLeft: "4px" }}>↕</span>;
    return (
      <span style={{ marginLeft: "4px" }}>
        {sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  if (isLoading)
    return <div style={{ padding: "30px" }}>Chargement de vos sessions...</div>;

  const totalKwh = sessions.reduce((sum, s) => sum + (s.totalKwh || 0), 0);

  return (
    <div style={containerStyle}>
      {/* --- EN-TÊTE --- */}
      <div style={headerCardStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#1f2937" }}>
            Mes Sessions de Charge
          </h1>
          <p style={{ margin: "5px 0 0 0", color: "#6b7280" }}>
            Retrouvez l'historique complet de vos recharges.
          </p>
        </div>

        {/* KPIs */}
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

      {/* --- HISTORIQUE DES SESSIONS --- */}
      <div style={cardStyle}>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
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
              {sortedSessions.length ===
              0 /* ATTENTION ICI : On boucle sur sortedSessions */ ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      padding: "30px",
                      color: "#6b7280",
                    }}
                  >
                    Vous n'avez effectué aucune session de charge pour le
                    moment.
                  </td>
                </tr>
              ) : (
                sortedSessions.map((s: any) => {
                  /* ATTENTION ICI : On boucle sur sortedSessions */
                  const dateStr = s.startTime
                    ? new Date(s.startTime).toLocaleDateString()
                    : "N/A";
                  return (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        background: s.isActive ? "#f0fdf4" : "transparent",
                      }}
                    >
                      <td style={tdStyle}>
                        <strong>{dateStr}</strong>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "#6b7280",
                            wordBreak: "break-all",
                          }}
                        >
                          #{s.transactionId || s.id}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        {s.ChargingStation?.chargePointModel
                          ? `${s.ChargingStation.chargePointModel} `
                          : ""}
                        {s.ocppConnectionName || "Inconnue"}
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
      </div>
    </div>
  );
}

// --- STYLES ---
const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "25px",
  paddingBottom: "30px",
};
const headerCardStyle: React.CSSProperties = {
  background: "#fff",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "20px",
};

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
    background: isCharging ? "#dcfce7" : "#f3f4f6",
    color: isCharging ? "#16a34a" : "#4b5563",
  };
};

const kpiStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
};
const kpiLabelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "#6b7280",
  textTransform: "uppercase",
  fontWeight: "600",
  letterSpacing: "0.05em",
};
const kpiValueStyle: React.CSSProperties = {
  fontSize: "1.8rem",
  fontWeight: "bold",
  color: "#111827",
  lineHeight: "1.2",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
};
const thStyle: React.CSSProperties = {
  padding: "12px 10px",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "#6b7280",
  textTransform: "uppercase",
};

// NOUVEAU STYLE POUR RENDRE L'EN-TÊTE CLIQUABLE
const sortableThStyle: React.CSSProperties = {
  ...thStyle,
  cursor: "pointer",
  userSelect: "none",
};

const tdStyle: React.CSSProperties = {
  padding: "15px 10px",
  fontSize: "0.95rem",
  color: "#1f2937",
};
const detailsButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  padding: "6px 12px",
  borderRadius: "6px",
  fontSize: "0.8rem",
  fontWeight: "600",
  color: "#374151",
  cursor: "pointer",
  transition: "all 0.2s ease",
};
