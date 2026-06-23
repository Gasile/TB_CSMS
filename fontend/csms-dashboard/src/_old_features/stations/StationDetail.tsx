import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchStationTransactions } from "../../api/stationApi";

interface TransactionWithUser {
  id: number;
  transactionId: string;
  isActive: boolean;
  chargingState: string;
  totalKwh: number;
  stoppedReason: string | null;
  User: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

const emojiStyle: React.CSSProperties = {
  background: "var(--gradient-primary)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  display: "inline-block",
  lineHeight: "1.2",
};

export default function StationDetail() {
  const { connectionName } = useParams();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<TransactionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBackHovered, setIsBackHovered] = useState(false);

  useEffect(() => {
    const loadStationTransactions = async () => {
      if (!connectionName) return;
      try {
        const data = await fetchStationTransactions(connectionName);
        if (data) setTransactions(data);
      } catch (err) {
        console.error("Erreur lors du chargement des sessions :", err);
      } finally {
        setLoading(false);
      }
    };
    loadStationTransactions();
  }, [connectionName]);

  const handleBack = () => navigate("/dashboard/admin-bornes");

  if (loading)
    return (
      <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
        Chargement de l'historique de la borne...
      </p>
    );

  return (
    <div style={cardStyle}>
      <div style={{ textAlign: "left", width: "100%" }}>
        <button
          onClick={handleBack}
          onMouseEnter={() => setIsBackHovered(true)}
          onMouseLeave={() => setIsBackHovered(false)}
          style={getBackButtonStyle(isBackHovered)}
        >
          <span style={{ marginRight: "8px", ...emojiStyle }}>🔙</span> Retour à
          la liste des bornes
        </button>
      </div>

      <div
        style={{
          backgroundColor: "var(--bg-input)",
          padding: "25px",
          borderRadius: "20px",
          border: `1px solid var(--color-border)`,
          marginBottom: "35px",
          marginTop: "25px",
          textAlign: "left",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            color: "var(--text-primary)",
            fontSize: "1.5em",
          }}
        >
          <span style={{ marginRight: "10px", ...emojiStyle }}>🔌</span> Borne
          connectée : {connectionName}
        </h3>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Supervision des sessions de recharge à distance et traçabilité des
          utilisateurs.
        </p>
      </div>

      <h3
        style={{
          textAlign: "left",
          color: "var(--text-primary)",
          textTransform: "uppercase",
          letterSpacing: "1px",
          fontSize: "1.1em",
          marginBottom: "20px",
        }}
      >
        Historique des recharges
      </h3>

      {transactions.length === 0 ? (
        <p
          style={{
            color: "var(--text-mute)",
            fontStyle: "italic",
            textAlign: "left",
          }}
        >
          Aucune session de charge enregistrée sur cette borne.
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
                <th style={thStyle}>OCPP Transaction ID</th>
                <th style={thStyle}>Utilisateur responsable</th>
                <th style={thStyle}>État</th>
                <th style={thStyle}>Énergie délivrée</th>
                <th style={thStyle}>Raison d'arrêt</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Détails</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <TransactionRow
                  key={t.id}
                  t={t}
                  onClick={() =>
                    navigate(`/dashboard/transactions/${t.id}`, {
                      state: { fromAdmin: "bornes" },
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TransactionRow({
  t,
  onClick,
}: {
  t: TransactionWithUser;
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
      <td
        style={{
          ...tdStyle,
          fontFamily: "monospace",
          fontSize: "13px",
          color: "var(--text-primary)",
        }}
      >
        {t.transactionId.substring(0, 12)}...
      </td>
      <td
        style={{ ...tdStyle, fontWeight: "bold", color: "var(--text-primary)" }}
      >
        {t.User ? (
          `${t.User.first_name} ${t.User.last_name}`
        ) : (
          <span
            style={{
              color: "var(--color-admin)",
              fontWeight: "normal",
              fontStyle: "italic",
            }}
          >
            Inconnu (Badge anonyme)
          </span>
        )}
      </td>
      <td style={tdStyle}>
        <span
          style={{
            backgroundColor: t.isActive
              ? "var(--bg-user-active)"
              : "var(--bg-card)",
            color: t.isActive ? "var(--color-user)" : "var(--text-mute)",
            padding: "6px 12px",
            borderRadius: "8px",
            fontSize: "0.85em",
            fontWeight: "bold",
            border: `1px solid ${t.isActive ? "var(--color-user)" : "var(--color-border)"}`,
          }}
        >
          {t.chargingState || (t.isActive ? "Charging" : "Terminé")}
        </span>
      </td>
      <td
        style={{ ...tdStyle, fontWeight: "bold", color: "var(--color-user)" }}
      >
        {t.totalKwh ? `${Number(t.totalKwh).toFixed(3)} kWh` : "0.000 kWh"}
      </td>
      <td style={{ ...tdStyle, color: "var(--color-admin)", fontSize: "14px" }}>
        {t.stoppedReason || "-"}
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
        Consulter ➔
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
  minWidth: "660px",
  margin: "0 auto",
  boxSizing: "border-box",
};

const getBackButtonStyle = (isHovered: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 18px",
  backgroundColor: isHovered ? "var(--bg-input)" : "transparent",
  color: isHovered ? "var(--text-primary)" : "var(--text-secondary)",
  border: `1px solid ${isHovered ? "var(--text-secondary)" : "var(--color-border)"}`,
  borderRadius: "12px",
  cursor: "pointer",
  fontSize: "0.9em",
  fontWeight: "600",
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
