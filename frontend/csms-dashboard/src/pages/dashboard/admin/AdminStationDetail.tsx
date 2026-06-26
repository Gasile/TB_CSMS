import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchStationById,
  fetchStationTransactions,
} from "../../../api/stationApi";

export default function StationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const stationId = Number(id);

  const [isLoading, setIsLoading] = useState(true);
  const [station, setStation] = useState<any>(null);
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
    if (stationId) {
      loadData();
    }
  }, [stationId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. On récupère les infos de la borne
      const stationData = await fetchStationById(stationId);
      setStation(stationData);

      // 2. Si la borne existe, on utilise son ocppConnectionName pour chercher ses sessions
      if (stationData && stationData.ocppConnectionName) {
        const sessionsData = await fetchStationTransactions(
          stationData.ocppConnectionName,
        );
        setSessions(sessionsData || []);
      }
    } catch (error) {
      console.error("Erreur lors du chargement de la borne :", error);
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

    // Cas particulier 1 : Trier par Statut
    if (sortConfig.key === "status") {
      valA = a.isActive ? "0_En_cours" : a.chargingState || "Terminé";
      valB = b.isActive ? "0_En_cours" : b.chargingState || "Terminé";
    }
    // Cas particulier 2 : Trier par Utilisateur (on concatène nom + prénom)
    else if (sortConfig.key === "User") {
      valA = a.User
        ? `${a.User.last_name} ${a.User.first_name}`.toLowerCase()
        : "zzzz"; // "zzzz" pour les mettre à la fin
      valB = b.User
        ? `${b.User.last_name} ${b.User.first_name}`.toLowerCase()
        : "zzzz";
    }
    // Cas particulier 3 : Trier par Date (startTime)
    else if (sortConfig.key === "startTime") {
      valA = a.startTime ? new Date(a.startTime).getTime() : 0;
      valB = b.startTime ? new Date(b.startTime).getTime() : 0;
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

  if (isLoading && !station)
    return (
      <div style={{ padding: "30px" }}>
        Chargement du dossier de la borne...
      </div>
    );
  if (!station)
    return (
      <div style={{ padding: "30px", color: "red" }}>Borne introuvable.</div>
    );

  // Calculs rapides pour les KPIs
  const totalKwh = sessions.reduce((sum, s) => sum + (s.totalKwh || 0), 0);
  const activeSessions = sessions.filter((s) => s.isActive).length;

  return (
    <div style={containerStyle}>
      {/* --- EN-TÊTE : BOUTON RETOUR ET INFOS BORNE --- */}
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
              <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#1f2937" }}>
                {station.ocppConnectionName}
              </h1>
              <span style={onlineBadgeStyle(station.isOnline)}>
                {station.isOnline ? "En ligne" : "Hors ligne"}
              </span>
            </div>
            <p style={{ margin: "5px 0 0 0", color: "#6b7280" }}>
              {station.chargePointVendor || "Marque inconnue"} •{" "}
              {station.chargePointModel || "Modèle inconnu"}
            </p>
          </div>
        </div>

        {/* Résumé (KPIs) */}
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

      {/* --- HISTORIQUE DES SESSIONS (Pleine largeur) --- */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={sectionTitleStyle}>Historique des sessions de charge</h2>
          {activeSessions > 0 && (
            <span
              style={{
                fontSize: "0.85rem",
                color: "#16a34a",
                fontWeight: "bold",
                background: "#dcfce7",
                padding: "4px 10px",
                borderRadius: "20px",
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
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
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
              {sessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      padding: "30px",
                      color: "#6b7280",
                    }}
                  >
                    Aucune session de charge enregistrée sur cette borne.
                  </td>
                </tr>
              ) : (
                sortedSessions.map((s: any) => {
                  const dateStr = s.startTime
                    ? new Date(s.startTime).toLocaleDateString()
                    : "N/A";
                  return (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        background: s.isActive
                          ? s.is_legal === false
                            ? "#fee2e2" // Fond rouge clair si illégal
                            : "#f0fdf4" // Fond vert clair si légal
                          : "transparent",
                      }}
                    >
                      <td style={tdStyle}>
                        <strong>{dateStr}</strong>
                        <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
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
                            style={{ color: "#9ca3af", fontStyle: "italic" }}
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
const backButtonStyle: React.CSSProperties = {
  background: "#f3f4f6",
  border: "1px solid #d1d5db",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "#4b5563",
};

const onlineBadgeStyle = (isOnline: boolean): React.CSSProperties => ({
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "0.8rem",
  fontWeight: "600",
  background: isOnline ? "#dcfce7" : "#fee2e2",
  color: isOnline ? "#16a34a" : "#dc2626",
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
const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.2rem",
  color: "#374151",
};

const thStyle: React.CSSProperties = {
  padding: "12px 10px",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "#6b7280",
  textTransform: "uppercase",
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

// NOUVEAU STYLE POUR RENDRE L'EN-TÊTE CLIQUABLE
const sortableThStyle: React.CSSProperties = {
  ...thStyle,
  cursor: "pointer",
  userSelect: "none",
};
