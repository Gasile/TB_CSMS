import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllStations } from "../../api/stationApi";

interface StationFromDB {
  id: number;
  ocppConnectionName: string;
  isOnline: boolean | null;
  chargePointVendor: string | null;
  chargePointModel: string | null;
}

const emojiStyle: React.CSSProperties = {
  background: "var(--gradient-primary)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  display: "inline-block",
  lineHeight: "1.2",
};

export default function StationList() {
  const [stations, setStations] = useState<StationFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadStations = async () => {
      try {
        const data = await fetchAllStations();
        if (data) setStations(data);
      } catch (err) {
        console.error("Erreur lors de la récupération des bornes :", err);
      } finally {
        setLoading(false);
      }
    };
    loadStations();
  }, []);

  if (loading)
    return (
      <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
        Chargement des infrastructures du réseau...
      </p>
    );

  return (
    <div style={cardStyle}>
      <div style={{ textAlign: "left", marginBottom: "30px" }}>
        <h2
          style={{
            margin: "0 0 5px 0",
            color: "var(--text-primary)",
            fontSize: "1.8em",
          }}
        >
          <span style={{ marginRight: "10px", ...emojiStyle }}>🔌</span>
          Supervision des Bornes
        </h2>
        <p
          style={{
            margin: 0,
            color: "var(--text-secondary)",
            fontSize: "0.95em",
          }}
        >
          État en temps réel de l'infrastructure de recharge.
        </p>
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
            <tr
              style={{
                borderBottom: `2px solid var(--color-border)`,
                color: "var(--text-secondary)",
              }}
            >
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Borne</th>
              <th style={thStyle}>Modèle</th>
              <th style={thStyle}>Statut</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Supervision</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <StationRow
                key={s.id}
                station={s}
                onClick={() =>
                  navigate(`/dashboard/admin-bornes/${s.ocppConnectionName}`)
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StationRow({
  station,
  onClick,
}: {
  station: StationFromDB;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderBottom: `1px solid var(--color-border)`,
        backgroundColor: isHovered ? "var(--bg-input)" : "transparent",
        cursor: "pointer",
        transition: "var(--transition-standard)",
      }}
    >
      <td style={{ ...tdStyle, color: "var(--text-mute)", fontWeight: "bold" }}>
        #{station.id}
      </td>
      <td
        style={{ ...tdStyle, color: "var(--text-primary)", fontWeight: "bold" }}
      >
        {station.ocppConnectionName}
      </td>
      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>
        {station.chargePointVendor
          ? `${station.chargePointVendor} ${station.chargePointModel}`
          : "Modèle inconnu"}
      </td>
      <td style={tdStyle}>
        <span style={getStatusBadgeStyle(station.isOnline)}>
          {station.isOnline ? "⬤ En ligne" : "⬤ Hors ligne"}
        </span>
      </td>
      <td
        style={{
          ...tdStyle,
          textAlign: "center",
          color: isHovered ? "var(--accent-primary)" : "var(--text-secondary)",
          fontWeight: "bold",
          transition: "var(--transition-standard)",
        }}
      >
        Historique ➔
      </td>
    </tr>
  );
}

const cardStyle: React.CSSProperties = {
  border: "3px solid transparent",
  background: `linear-gradient(var(--bg-card), var(--bg-card)) padding-box, var(--gradient-primary) border-box`,
  padding: "40px",
  borderRadius: "50px",
  boxShadow: "var(--shadow-card)",
  width: "fit-content",
  minWidth: "800px",
  margin: "0 auto",
};

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

const getStatusBadgeStyle = (isOnline: boolean | null): React.CSSProperties => {
  const color = isOnline ? "var(--color-user)" : "var(--error-color)";
  const bgColor = isOnline
    ? "var(--bg-user-active)"
    : "rgba(255, 82, 82, 0.15)";
  const borderColor = isOnline ? "var(--color-user)" : "var(--error-color)";
  return {
    backgroundColor: bgColor,
    color: color,
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "0.85em",
    fontWeight: "bold",
    border: `1px solid ${borderColor}`,
    whiteSpace: "nowrap",
  };
};
