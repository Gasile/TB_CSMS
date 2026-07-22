// ============================================================================
// IMPORTS
// ============================================================================

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchAllStationsWithStatus,
  updateStationWeight,
} from "../../../api/adminApi";
import { Icon } from "../../../components/ui/Icon";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Administrative asset view displaying the full hardware fleet status in real-time grid tiles,
 * allowing instant weight/priority updates and deep linking to transaction histories.
 */
export default function AdminStations() {
  const navigate = useNavigate();

  // Core component reactive states
  const [stations, setStations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStations();
  }, []);

  /**
   * Queries the database for complete charging node attributes and ongoing transactions.
   */
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

  /**
   * Optimistically updates localized state weights and synchronizes priority constraints over the API.
   */
  const handleWeightChange = async (stationId: number, newWeight: number) => {
    try {
      setStations((prev) =>
        prev.map((s) => (s.id === stationId ? { ...s, weight: newWeight } : s)),
      );
      await updateStationWeight(stationId, newWeight);
    } catch (err: any) {
      alert("Erreur lors de la modification de la priorité.");
      loadStations();
    }
  };

  if (isLoading)
    return (
      <div style={{ padding: "20px", color: "var(--text-main)" }}>
        Chargement de la flotte...
      </div>
    );
  if (error)
    return (
      <div style={{ padding: "20px", color: "var(--status-offline)" }}>
        {error}
      </div>
    );

  return (
    <div style={containerStyle}>
      {/* Structural Controls Header */}
      <div style={headerStyle}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "1.8rem",
              color: "var(--text-main)",
              transition: "var(--theme-transition)",
            }}
          >
            Flotte de bornes
          </h1>
          <p
            style={{
              margin: "5px 0 0 0",
              color: "var(--text-muted)",
              fontSize: "0.95rem",
              transition: "var(--theme-transition)",
            }}
          >
            Vue d'ensemble et statuts en temps réel
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => navigate("/admin-power-blocks")}
            style={manageBlocksButtonStyle}
          >
            <Icon
              name="charger"
              style={{ fontSize: "1.4rem", color: "var(--primary)" }}
            />{" "}
            Gérer les blocs de puissance
          </button>
          <button onClick={loadStations} style={refreshButtonStyle}>
            <Icon
              name="cached"
              style={{ fontSize: "1.4rem", color: "var(--status-available)" }}
            />{" "}
            Rafraîchir
          </button>
        </div>
      </div>

      {/* --- INFRASTRUCTURE CARDS GRID COMPILATION --- */}
      <div style={gridStyle}>
        {stations.map((station) => {
          const isOnline = station.isOnline;
          const hasActiveTransaction =
            station.Transactions && station.Transactions.length > 0;

          // Compute dynamic threshold status tags parameters
          let statusText = "Offline";
          let statusColor = "var(--status-offline)";
          let statusBg = "rgba(239, 68, 68, 0.15)";

          if (isOnline) {
            if (hasActiveTransaction) {
              statusText = "En charge";
              statusColor = "var(--status-charging)";
              statusBg = "rgba(0, 210, 143, 0.15)";
            } else {
              statusText = "Disponible";
              statusColor = "var(--status-available)";
              statusBg = "rgba(14, 165, 233, 0.15)";
            }
          }

          return (
            <div key={station.id} style={cardStyle}>
              {/* Asset Header Info Section */}
              <div style={cardHeaderStyle}>
                <div style={iconContainerStyle}>
                  <Icon
                    name="ev_station"
                    style={{
                      fontSize: "2.2rem",
                      color: statusColor,
                      transition: "var(--theme-transition)",
                    }}
                  />{" "}
                </div>
                <span
                  style={{
                    ...badgeStyle,
                    color: statusColor,
                    backgroundColor: statusBg,
                    transition: "var(--theme-transition)",
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
                      transition: "var(--theme-transition)",
                    }}
                  ></span>
                  {statusText}
                </span>
              </div>

              {/* Technical Property Layout List */}
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

                {/* Priority Weight Adjustment Selection Block */}
                <div style={infoRowStyle}>
                  <span style={infoLabelStyle}>Priorité de charge:</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {[1, 2, 3].map((w) => (
                      <button
                        key={w}
                        onClick={() => handleWeightChange(station.id, w)}
                        style={{
                          ...weightButtonStyle,
                          background:
                            station.weight === w || (!station.weight && w === 1)
                              ? "var(--primary)"
                              : "var(--bg-app)",
                          color:
                            station.weight === w || (!station.weight && w === 1)
                              ? "#fff"
                              : "var(--text-main)",
                          borderColor:
                            station.weight === w || (!station.weight && w === 1)
                              ? "var(--primary)"
                              : "var(--border-color)",
                        }}
                        title={`Priorité ${w}`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Link Trigger Redirect Area */}
                <div style={cardFooterStyle}>
                  <button
                    style={actionButtonStyle}
                    onClick={() => navigate(`/admin-stations/${station.id}`)}
                  >
                    Détail des Sessions ➔
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
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

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const refreshButtonStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "8px 12px 8px 10px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: "25px",
};

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  borderRadius: "16px",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  transition: "var(--theme-transition)",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "20px",
};

const iconContainerStyle: React.CSSProperties = {
  fontSize: "2rem",
  background: "var(--bg-app)",
  width: "50px",
  height: "50px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "12px",
  transition: "var(--theme-transition)",
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
  color: "var(--text-main)",
  fontWeight: "700",
  transition: "var(--theme-transition)",
};

const infoRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "0.9rem",
  borderBottom: "1px dashed var(--border-color)",
  paddingBottom: "5px",
  transition: "var(--theme-transition)",
};

const infoLabelStyle: React.CSSProperties = {
  color: "var(--text-muted)",
  transition: "var(--theme-transition)",
};

const infoValueStyle: React.CSSProperties = {
  fontWeight: "600",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};

const cardFooterStyle: React.CSSProperties = {
  paddingTop: "15px",
  borderTop: "1px solid var(--border-color)",
  transition: "var(--theme-transition)",
};

const actionButtonStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-app)",
  border: "1px solid var(--border-color)",
  padding: "10px",
  borderRadius: "8px",
  color: "var(--text-main)",
  fontWeight: "600",
  cursor: "pointer",
  transition: "var(--theme-transition)",
};

const manageBlocksButtonStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "8px 12px 8px 10px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};

const weightButtonStyle: React.CSSProperties = {
  width: "26px",
  height: "26px",
  borderRadius: "6px",
  border: "1px solid",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.85rem",
  fontWeight: "bold",
  cursor: "pointer",
  transition: "all 0.2s ease, var(--theme-transition)",
};
