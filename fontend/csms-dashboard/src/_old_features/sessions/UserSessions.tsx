import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom"; // <-- Ajout de useLocation
import { useAuth } from "../../context/AuthContext";
import { fetchUserSessions } from "../../api/userApi";

interface TransactionFromDB {
  id: number;
  transactionId: string;
  isActive: boolean;
  chargingState: string;
  totalKwh: number;
  stoppedReason: string | null;
  ocppConnectionName: string;
}

const emojiStyle: React.CSSProperties = {
  background: "var(--gradient-primary)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  display: "inline-block",
  lineHeight: "1.2",
};

export default function UserSessions({ user: propUser }: { user?: any }) {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  // --- NOUVEAU : Détection de la vue admin ---
  const location = useLocation();
  const isAdminView = location.pathname.includes("admin-users");

  const activeUser = propUser || authUser;

  const [transactions, setTransactions] = useState<TransactionFromDB[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMySessions = async () => {
      if (!activeUser?.id) return;
      try {
        const data = await fetchUserSessions(activeUser.id);
        if (data) setTransactions(data);
      } catch (err) {
        console.error("Erreur de récupération des sessions :", err);
      } finally {
        setLoading(false);
      }
    };
    loadMySessions();
  }, [activeUser?.id]);

  if (!activeUser) return null;

  if (loading)
    return (
      <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
        Récupération de l'historique...
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
          <span style={{ marginRight: "10px", ...emojiStyle }}>⚡</span>
          Sessions de Charge
        </h2>
        <p
          style={{
            margin: 0,
            color: "var(--text-secondary)",
            fontSize: "0.95em",
          }}
        >
          Historique et statistiques de recharges sur le réseau.
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
              <th style={thStyle}>Transaction ID</th>
              <th style={thStyle}>Borne</th>
              <th style={thStyle}>Énergie</th>
              <th style={thStyle}>Statut</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Détails</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "30px",
                    textAlign: "center",
                    color: "var(--text-mute)",
                    fontStyle: "italic",
                  }}
                >
                  Aucune session de charge pour le moment.
                </td>
              </tr>
            ) : (
              transactions.map((t) => (
                <SessionRow
                  key={t.id}
                  transaction={t}
                  onClick={() =>
                    navigate(`/dashboard/transactions/${t.id}`, {
                      state: isAdminView ? { fromAdmin: "users" } : undefined,
                    })
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SessionRow({
  transaction,
  onClick,
}: {
  transaction: TransactionFromDB;
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
        {transaction.transactionId.substring(0, 12)}...
      </td>
      <td
        style={{ ...tdStyle, fontWeight: "bold", color: "var(--color-admin)" }}
      >
        {transaction.ocppConnectionName}
      </td>
      <td
        style={{ ...tdStyle, fontWeight: "bold", color: "var(--color-user)" }}
      >
        {transaction.totalKwh
          ? `${Number(transaction.totalKwh).toFixed(3)} kWh`
          : "0.000 kWh"}
      </td>
      <td style={tdStyle}>
        <span
          style={{
            backgroundColor: transaction.isActive
              ? "var(--bg-user-active)"
              : "var(--bg-card)",
            color: transaction.isActive
              ? "var(--color-user)"
              : "var(--text-mute)",
            padding: "6px 12px",
            borderRadius: "8px",
            fontSize: "0.85em",
            fontWeight: "bold",
            border: `1px solid ${transaction.isActive ? "var(--color-user)" : "var(--color-border)"}`,
            whiteSpace: "nowrap",
          }}
        >
          {transaction.chargingState ||
            (transaction.isActive ? "Charging" : "Terminé")}
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
  width: "100%",
  maxWidth: "800px",
  boxSizing: "border-box",
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
