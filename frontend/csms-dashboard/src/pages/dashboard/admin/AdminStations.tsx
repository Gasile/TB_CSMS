import React, { useEffect, useState } from "react";
import { fetchAllStationsWithStatus } from "../../../api/adminApi"; // Adapte le chemin si besoin

import { useNavigate } from "react-router-dom";

export default function AdminStations() {
  const navigate = useNavigate();

  const [stations, setStations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStations();
  }, []);

  const loadStations = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllStationsWithStatus();
      setStations(data?.ChargingStations || []);
    } catch (err: any) {
      setError(err.message || "Erreur lors du chargement des bornes.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading)
    return <div style={{ padding: "20px" }}>Chargement de la flotte...</div>;
  if (error)
    return <div style={{ padding: "20px", color: "red" }}>{error}</div>;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#1f2937" }}>
            Flotte de bornes
          </h1>
          <p
            style={{
              margin: "5px 0 0 0",
              color: "#6b7280",
              fontSize: "0.95rem",
            }}
          >
            Vue d'ensemble et statuts en temps réel
          </p>
        </div>
        <button onClick={loadStations} style={refreshButtonStyle}>
          🔄 Rafraîchir
        </button>
      </div>

      <div style={gridStyle}>
        {stations.map((station) => {
          // --- LOGIQUE DE STATUT ---
          const isOnline = station.isOnline;
          const hasActiveTransaction =
            station.Transactions && station.Transactions.length > 0;

          let statusText = "Offline";
          let statusColor = "#dc2626"; // Rouge
          let statusBg = "#fee2e2";

          if (isOnline) {
            if (hasActiveTransaction) {
              statusText = "En charge";
              statusColor = "#16a34a"; // Vert
              statusBg = "#dcfce7";
            } else {
              statusText = "Disponible";
              statusColor = "#2563eb"; // Bleu
              statusBg = "#dbeafe";
            }
          }

          return (
            <div key={station.id} style={cardStyle}>
              {/* En-tête de la carte : Icone + Statut */}
              <div style={cardHeaderStyle}>
                <div style={iconContainerStyle}>🔌</div>
                <span
                  style={{
                    ...badgeStyle,
                    color: statusColor,
                    backgroundColor: statusBg,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: statusColor,
                      marginRight: "6px",
                    }}
                  ></span>
                  {statusText}
                </span>
              </div>

              {/* Corps de la carte : Nom et infos */}
              <div style={cardBodyStyle}>
                <h3 style={stationNameStyle}>
                  {station.chargePointModel
                    ? `${station.chargePointModel} `
                    : ""}
                  {station.ocppConnectionName}
                </h3>

                <div style={infoRowStyle}>
                  <span style={infoLabelStyle}>Identifiant ID:</span>
                  <span style={infoValueStyle}>#{station.id}</span>
                </div>

                <div style={infoRowStyle}>
                  <span style={infoLabelStyle}>Protocole:</span>
                  <span style={infoValueStyle}>
                    {station.protocol || "Inconnu"}
                  </span>
                </div>
              </div>

              {/* Bouton d'action : Historique des sessions de la borne */}
              <div style={cardFooterStyle}>
                <button
                  style={actionButtonStyle}
                  // Le onClick est prêt à être câblé avec un navigate() quand tu créeras la page
                  onClick={() => navigate(`/admin-stations/${station.id}`)}
                >
                  Détail des Sessions ➔
                </button>
              </div>
            </div>
          );
        })}
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
const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};
const refreshButtonStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d1d5db",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "#374151",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
};

// CSS Grid : Crée des colonnes automatiques d'au moins 280px de large
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: "25px",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "16px",
  padding: "20px",
  boxShadow: "0 4px 6px rgba(0,0,0,0.02), 0 1px 3px rgba(0,0,0,0.05)",
  display: "flex",
  flexDirection: "column",
  transition: "transform 0.2s, box-shadow 0.2s",
};
const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "20px",
};
const iconContainerStyle: React.CSSProperties = {
  fontSize: "2rem",
  background: "#f3f4f6",
  width: "50px",
  height: "50px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "12px",
};
const badgeStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "20px",
  fontSize: "0.8rem",
  fontWeight: "700",
  display: "flex",
  alignItems: "center",
};

const cardBodyStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  marginBottom: "20px",
};
const stationNameStyle: React.CSSProperties = {
  margin: "0 0 10px 0",
  fontSize: "1.25rem",
  color: "#111827",
  fontWeight: "700",
};
const infoRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "0.9rem",
  borderBottom: "1px dashed #e5e7eb",
  paddingBottom: "5px",
};
const infoLabelStyle: React.CSSProperties = { color: "#6b7280" };
const infoValueStyle: React.CSSProperties = {
  fontWeight: "600",
  color: "#374151",
};

const cardFooterStyle: React.CSSProperties = {
  paddingTop: "15px",
  borderTop: "1px solid #f3f4f6",
};
const actionButtonStyle: React.CSSProperties = {
  width: "100%",
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  padding: "10px",
  borderRadius: "8px",
  color: "#4b5563",
  fontWeight: "600",
  cursor: "pointer",
  transition: "background 0.2s",
};
