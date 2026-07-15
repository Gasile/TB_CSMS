// ============================================================================
// IMPORTS
// ============================================================================

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

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

const NUM_WEEKS = 16;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * End-user overview dashboard rendering localized infrastructure occupancy,
 * personal metrics totals, active session trackers, and rolling multi-week consumption trends.
 */
export default function UserDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id;

  // UI & Data Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);

  useEffect(() => {
    if (currentUserId) {
      loadDashboard();
    }
  }, [currentUserId]);

  /**
   * Fetches summary aggregates and parsing arrays relative to the dynamic historical threshold date.
   */
  const loadDashboard = async () => {
    setIsLoading(true);
    try {
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

  /**
   * Computes individual transaction metrics into a fixed chronological multi-week rolling array.
   */
  const buildWeeklyChart = (transactions: any[]) => {
    const weeks = Array.from({ length: NUM_WEEKS }, (_, i) => ({
      name: i === NUM_WEEKS - 1 ? "Cette sem." : `S-${NUM_WEEKS - 1 - i}`,
      kwh: 0,
    }));

    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setDate(now.getDate() - daysSinceMonday);
    startOfCurrentWeek.setHours(0, 0, 0, 0);

    const startOfCurrentWeekMs = startOfCurrentWeek.getTime();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    transactions.forEach((tx) => {
      if (!tx.startTime || !tx.totalKwh) return;
      const txTime = new Date(tx.startTime).getTime();

      let diffWeeks = 0;

      if (txTime >= startOfCurrentWeekMs) {
        diffWeeks = 0;
      } else {
        diffWeeks = Math.floor((startOfCurrentWeekMs - txTime) / oneWeekMs) + 1;
      }

      if (diffWeeks >= 0 && diffWeeks < NUM_WEEKS) {
        const index = NUM_WEEKS - 1 - diffWeeks;
        weeks[index].kwh += tx.totalKwh;
      }
    });

    setWeeklyData(weeks);
  };

  if (isLoading || !dashboardData)
    return (
      <div style={{ padding: "30px", color: "var(--text-main)" }}>
        Chargement de votre espace...
      </div>
    );

  // Destructure operational arrays and indicators from parsed response data
  const lastTx = dashboardData.LastTransaction[0];
  const activeTxs = dashboardData.ActiveTransactions || [];
  const stats = dashboardData.Transactions_aggregate.aggregate;
  const totalStations = dashboardData.ChargingStations.length;
  const availableStations = dashboardData.ChargingStations.filter(
    (st: any) => st.isOnline && st.Transactions.length === 0,
  ).length;

  return (
    <div style={containerStyle}>
      {/* En-tête Control Header */}
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
            Vue d'ensemble
          </h1>
          <p
            style={{
              margin: "5px 0 0 0",
              color: "var(--text-muted)",
              transition: "var(--theme-transition)",
            }}
          >
            Bienvenue sur votre espace de recharge.
          </p>
        </div>
        <button onClick={loadDashboard} style={refreshButtonStyle}>
          🔄 Rafraîchir
        </button>
      </div>

      {/* --- RESPONSIVE TWO-COLUMN GRID SEGMENTATION --- */}
      <div style={dashboardGridStyle}>
        {/* ================= LEFT COLUMN WORKSPACE (1/3) : AGGREGATES & HARD KPIS ================= */}
        <div style={leftColumnStyle}>
          {/* Infrastructure Station Occupancy Indicator */}
          <div style={cardStyle}>
            <h3
              style={{
                margin: "0 0 15px 0",
                color: "var(--text-main)",
                fontSize: "1rem",
                fontWeight: "600",
                transition: "var(--theme-transition)",
              }}
            >
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
                    color: "var(--text-main)",
                    transition: "var(--theme-transition)",
                  }}
                >
                  {availableStations} / {totalStations}
                </div>
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontWeight: "500",
                    transition: "var(--theme-transition)",
                  }}
                >
                  Bornes disponibles
                </div>
              </div>
            </div>
          </div>

          {/* Account Lifetime Consumption Summary Card */}
          <div style={cardStyle}>
            <h3
              style={{
                margin: "0 0 20px 0",
                color: "var(--text-main)",
                fontSize: "1rem",
                fontWeight: "600",
                transition: "var(--theme-transition)",
              }}
            >
              Mes statistiques (Total)
            </h3>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "15px",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>
                Énergie consommée
              </span>
              <strong style={{ fontSize: "1.1rem", color: "var(--text-main)" }}>
                {stats.sum.totalKwh ? stats.sum.totalKwh.toFixed(1) : "0.0"} kWh
              </strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "15px",
                borderTop: "1px solid var(--border-color)",
                paddingTop: "15px",
                transition: "var(--theme-transition)",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>
                Sessions effectuées
              </span>
              <strong style={{ fontSize: "1.1rem", color: "var(--text-main)" }}>
                {stats.count}
              </strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid var(--border-color)",
                paddingTop: "15px",
                transition: "var(--theme-transition)",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>Coût estimé</span>
              <strong style={{ fontSize: "1.1rem", color: "var(--text-main)" }}>
                0.00 CHF
              </strong>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN WORKSPACE (2/3) : LIVE ACTIVITY & HISTOGRAM TRENDS ================= */}
        <div style={rightColumnStyle}>
          {/* Active Transactions List Tracking Panels */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "15px" }}
          >
            {activeTxs.length > 0
              ? activeTxs.map((tx: any) => (
                  <div
                    key={tx.id}
                    style={
                      tx.is_legal === false
                        ? illegalSessionCardStyle
                        : activeSessionCardStyle
                    }
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
                          color:
                            tx.is_legal === false
                              ? "var(--status-offline)"
                              : "var(--status-charging)",
                          transition: "var(--theme-transition)",
                        }}
                      >
                        {tx.is_legal === false
                          ? "⚠️ Charge illégale"
                          : "⚡ Charge en cours"}
                      </h2>
                      <button
                        onClick={() => navigate(`/session/${tx.id}`)}
                        style={detailsButtonStyle}
                      >
                        Détails ➔
                      </button>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(130px, 1fr))",
                        gap: "15px",
                        marginTop: "20px",
                      }}
                    >
                      <div>
                        <div style={smallLabelStyle}>Borne utilisée</div>
                        <div style={strongValueStyle}>
                          {tx.ChargingStation?.chargePointModel
                            ? `${tx.ChargingStation.chargePointModel} `
                            : ""}
                          {tx.ocppConnectionName || "Inconnue"}
                        </div>
                      </div>
                      <div>
                        <div style={smallLabelStyle}>Débutée le</div>
                        <div style={strongValueStyle}>
                          {new Date(tx.startTime).toLocaleDateString()} à{" "}
                          {new Date(tx.startTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div>
                        <div style={smallLabelStyle}>Énergie</div>
                        <div style={strongValueStyle}>
                          {tx.totalKwh ? tx.totalKwh.toFixed(2) : "0.00"} kWh
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              : lastTx && (
                  /* Fallback Panel rendering the last completed charging sequence */
                  <div style={cardStyle}>
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
                          color: "var(--text-main)",
                          transition: "var(--theme-transition)",
                        }}
                      >
                        Dernière charge effectuée
                      </h2>
                      <button
                        onClick={() => navigate(`/session/${lastTx.id}`)}
                        style={detailsButtonStyle}
                      >
                        Détails ➔
                      </button>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(130px, 1fr))",
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
                          {lastTx.totalKwh
                            ? lastTx.totalKwh.toFixed(2)
                            : "0.00"}{" "}
                          kWh
                        </div>
                      </div>
                    </div>
                  </div>
                )}

            {!lastTx && activeTxs.length === 0 && (
              <div style={cardStyle}>
                <p
                  style={{
                    color: "var(--text-muted)",
                    margin: 0,
                    transition: "var(--theme-transition)",
                  }}
                >
                  Vous n'avez effectué aucune charge pour le moment.
                </p>
              </div>
            )}
          </div>

          {/* Monthly Consumption Bar Chart Block */}
          <div
            style={{ ...cardStyle, display: "flex", flexDirection: "column" }}
          >
            <h3
              style={{
                margin: "0 0 20px 0",
                color: "var(--text-main)",
                fontSize: "1.1rem",
                fontWeight: "600",
                transition: "var(--theme-transition)",
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
                    stroke="var(--border-color)"
                  />
                  <XAxis
                    dataKey="name"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickMargin={10}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val) => `${val}`}
                    stroke="var(--text-muted)"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                    contentStyle={{
                      background: "var(--bg-card)",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color)",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.15)",
                      color: "var(--text-main)",
                    }}
                    formatter={(value: any) => [
                      `${Number(value).toFixed(2)} kWh`,
                      "Énergie",
                    ]}
                  />
                  <Bar
                    dataKey="kwh"
                    fill="var(--status-available)"
                    radius={[4, 4, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
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
  paddingBottom: "30px",
};

const dashboardGridStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "25px",
  width: "100%",
};

const leftColumnStyle: React.CSSProperties = {
  flex: "1 1 300px",
  display: "flex",
  flexDirection: "column",
  gap: "25px",
};

const rightColumnStyle: React.CSSProperties = {
  flex: "2 1 500px",
  display: "flex",
  flexDirection: "column",
  gap: "25px",
};

const cardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "25px",
  borderRadius: "12px",
  transition: "var(--theme-transition)",
};

const activeSessionCardStyle: React.CSSProperties = {
  background: "rgba(16, 185, 129, 0.08)",
  border: "2px solid var(--status-charging)",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 4px 15px rgba(0, 210, 143, 0.1)",
  transition: "var(--theme-transition)",
};

const illegalSessionCardStyle: React.CSSProperties = {
  background: "rgba(239, 68, 68, 0.08)",
  border: "2px solid var(--status-offline)",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 4px 15px rgba(239, 68, 68, 0.1)",
  transition: "var(--theme-transition)",
};

const smallLabelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  fontWeight: "600",
  marginBottom: "5px",
  transition: "var(--theme-transition)",
};

const strongValueStyle: React.CSSProperties = {
  fontSize: "1.2rem",
  fontWeight: "bold",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};

const detailsButtonStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "6px 12px",
  borderRadius: "6px",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "var(--text-main)",
  cursor: "pointer",
  transition: "var(--theme-transition)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "10px",
};

const refreshButtonStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "var(--text-main)",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  transition: "all 0.2s ease, var(--theme-transition)",
};
