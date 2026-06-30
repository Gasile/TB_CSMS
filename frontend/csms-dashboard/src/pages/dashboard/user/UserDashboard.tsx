import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { fetchUserDashboardData } from "../../../api/sessionApi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// --- CONFIGURATION DYNAMIQUE ---
// Modifie cette valeur (ex: 4, 8, 12) et l'API ainsi que le graphique s'adapteront automatiquement !
const NUM_WEEKS = 16;

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);

  useEffect(() => {
    if (currentUserId) {
      loadDashboard();
    }
  }, [currentUserId]);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      // Calcul dynamique de la date limite en fonction de NUM_WEEKS (avec 2 jours de marge)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (NUM_WEEKS * 7 + 2));

      const data = await fetchUserDashboardData(
        currentUserId!,
        cutoffDate.toISOString(),
      );
      setDashboardData(data);

      if (data.RecentTransactions) {
        buildWeeklyChart(data.RecentTransactions);
      }
    } catch (error) {
      console.error("Erreur de chargement du dashboard :", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- HISTOGRAMME DYNAMIQUE ---
  // --- HISTOGRAMME DYNAMIQUE (Semaines calendaires - Lundi au Dimanche) ---
  const buildWeeklyChart = (transactions: any[]) => {
    // 1. Initialiser le tableau des colonnes
    const weeks = Array.from({ length: NUM_WEEKS }, (_, i) => ({
      name: i === NUM_WEEKS - 1 ? "Cette sem." : `S-${NUM_WEEKS - 1 - i}`,
      kwh: 0,
    }));

    // 2. Trouver le début de la semaine courante (Lundi à 00:00:00)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Dimanche, 1 = Lundi, ... 6 = Samedi
    // En Europe, la semaine commence lundi. On calcule le décalage pour retomber sur lundi.
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setDate(now.getDate() - daysSinceMonday);
    startOfCurrentWeek.setHours(0, 0, 0, 0);

    const startOfCurrentWeekMs = startOfCurrentWeek.getTime();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    // 3. Répartir les transactions
    transactions.forEach((tx) => {
      if (!tx.startTime || !tx.totalKwh) return;
      const txTime = new Date(tx.startTime).getTime();

      let diffWeeks = 0;

      // Si la transaction a lieu APRÈS lundi matin minuit, c'est la semaine 0
      if (txTime >= startOfCurrentWeekMs) {
        diffWeeks = 0;
      } else {
        // Sinon, on calcule combien de semaines complètes se sont écoulées avant ce Lundi
        diffWeeks = Math.floor((startOfCurrentWeekMs - txTime) / oneWeekMs) + 1;
      }

      // On place les kWh dans la bonne colonne si elle est dans la limite de NUM_WEEKS
      if (diffWeeks >= 0 && diffWeeks < NUM_WEEKS) {
        const index = NUM_WEEKS - 1 - diffWeeks;
        weeks[index].kwh += tx.totalKwh;
      }
    });

    setWeeklyData(weeks);
  };

  if (isLoading || !dashboardData)
    return <div style={{ padding: "30px" }}>Chargement de votre espace...</div>;

  const lastTx = dashboardData.LastTransaction[0];
  const stats = dashboardData.Transactions_aggregate.aggregate;
  const totalStations = dashboardData.ChargingStations.length;
  const availableStations = dashboardData.ChargingStations.filter(
    (st: any) => st.isOnline && st.Transactions.length === 0,
  ).length;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#1f2937" }}>
            Vue d'ensemble
          </h1>
          <p style={{ margin: "5px 0 0 0", color: "#6b7280" }}>
            Bienvenue sur votre espace de recharge.
          </p>
        </div>
        <button onClick={loadDashboard} style={refreshButtonStyle}>
          🔄 Rafraîchir
        </button>
      </div>

      {/* --- LIGNE 1 : FLOTTE (1/3) + DERNIÈRE SESSION (2/3) --- */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "25px" }}>
        {/* WIDGET FLOTTE */}
        <div
          style={{
            ...cardStyle,
            flex: "1 1 250px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <h3 style={{ margin: "0 0 15px 0", color: "#374151" }}>
            Statut de l'infrastructure
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ fontSize: "3rem" }}>
              {availableStations > 0 ? "🟢" : "🔴"}
            </div>
            <div>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: "bold",
                  color: "#111827",
                }}
              >
                {availableStations} / {totalStations}
              </div>
              <div style={{ color: "#6b7280", fontWeight: "500" }}>
                Bornes disponibles
              </div>
            </div>
          </div>
        </div>

        {/* WIDGET DERNIÈRE SESSION */}
        <div
          style={{
            ...(lastTx?.isActive
              ? lastTx.is_legal === false
                ? illegalSessionCardStyle
                : activeSessionCardStyle
              : cardStyle),
            flex: "2 1 450px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "1.2rem",
                color: lastTx?.isActive
                  ? lastTx.is_legal === false
                    ? "#991b1b"
                    : "#166534"
                  : "#374151",
              }}
            >
              {lastTx?.isActive
                ? lastTx.is_legal === false
                  ? "⚠️ Charge illégale"
                  : "⚡ Charge en cours"
                : "Dernière charge effectuée"}
            </h2>
            {lastTx && (
              <button
                onClick={() => navigate(`/session/${lastTx.id}`)}
                style={detailsButtonStyle}
              >
                Détails ➔
              </button>
            )}
          </div>

          {lastTx ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "15px",
                marginTop: "20px",
              }}
            >
              <div>
                <div style={smallLabelStyle}>Borne utilisée</div>
                <div style={strongValueStyle}>
                  {lastTx.ChargingStation?.chargePointModel
                    ? `${lastTx.ChargingStation.chargePointModel} `
                    : ""}
                  {lastTx.ocppConnectionName || "Inconnue"}
                </div>
              </div>
              <div>
                <div style={smallLabelStyle}>Date</div>
                <div style={strongValueStyle}>
                  {new Date(lastTx.startTime).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div style={smallLabelStyle}>Énergie</div>
                <div style={strongValueStyle}>
                  {lastTx.totalKwh ? lastTx.totalKwh.toFixed(2) : "0.00"} kWh
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: "#6b7280", marginTop: "20px" }}>
              Vous n'avez effectué aucune charge pour le moment.
            </p>
          )}
        </div>
      </div>

      {/* --- LIGNE 2 : STATISTIQUES GLOBALES (1/3) + HISTOGRAMME (2/3) --- */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "25px" }}>
        {/* WIDGET STATISTIQUES (Maintenant à gauche) */}
        <div
          style={{
            ...cardStyle,
            flex: "1 1 250px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <h3 style={{ margin: "0 0 20px 0", color: "#374151" }}>
            Mes statistiques (Total)
          </h3>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "15px",
            }}
          >
            <span style={{ color: "#6b7280" }}>Énergie consommée</span>
            <strong style={{ fontSize: "1.1rem" }}>
              {stats.sum.totalKwh ? stats.sum.totalKwh.toFixed(1) : "0.0"} kWh
            </strong>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "15px",
              borderTop: "1px solid #f3f4f6",
              paddingTop: "15px",
            }}
          >
            <span style={{ color: "#6b7280" }}>Sessions effectuées</span>
            <strong style={{ fontSize: "1.1rem" }}>{stats.count}</strong>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: "1px solid #f3f4f6",
              paddingTop: "15px",
            }}
          >
            <span style={{ color: "#6b7280" }}>Coût estimé</span>
            <strong style={{ fontSize: "1.1rem" }}>0.00 CHF</strong>
          </div>
        </div>

        {/* WIDGET HISTOGRAMME (Maintenant à droite) */}
        <div
          style={{
            ...cardStyle,
            flex: "2 1 450px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h3
            style={{
              margin: "0 0 20px 0",
              color: "#374151",
              fontSize: "1.1rem",
            }}
          >
            Consommation ({NUM_WEEKS} dernières semaines)
          </h3>
          <div style={{ flex: 1, minHeight: "220px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f3f4f6"
                />
                <XAxis
                  dataKey="name"
                  stroke="#9ca3af"
                  fontSize={11}
                  tickMargin={10}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val) => `${val}`}
                  stroke="#9ca3af"
                  fontSize={11}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#f9fafb" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                  }}
                  formatter={(value: any) => [
                    `${Number(value).toFixed(2)} kWh`,
                    "Énergie",
                  ]}
                />
                <Bar
                  dataKey="kwh"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
const cardStyle: React.CSSProperties = {
  background: "#fff",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
};
const activeSessionCardStyle: React.CSSProperties = {
  background: "#f0fdf4",
  border: "2px solid #bbf7d0",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 4px 15px rgba(22, 163, 74, 0.1)",
};

const smallLabelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#6b7280",
  textTransform: "uppercase",
  fontWeight: "600",
  marginBottom: "5px",
};
const strongValueStyle: React.CSSProperties = {
  fontSize: "1.2rem",
  fontWeight: "bold",
  color: "#111827",
};

const detailsButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  padding: "6px 12px",
  borderRadius: "6px",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "#374151",
  cursor: "pointer",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "10px",
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
  transition: "all 0.2s ease",
};

const illegalSessionCardStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "2px solid #fecaca",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 4px 15px rgba(220, 38, 38, 0.1)",
};
