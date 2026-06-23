import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ActivityCalendar } from "react-activity-calendar";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { fetchUserOverview, fetchLiveTelemetry } from "../../api/sessionApi";

interface SummaryData {
  total_energy_kwh: number;
  last_7_days_energy_kwh: number;
}

interface DailyCharge {
  charge_date: string;
  daily_kwh: number;
}

interface LatestTransaction {
  id: number;
  transactionId: string;
  ocppConnectionName: string;
  connectorId: number;
  isActive: boolean;
  chargingState: string;
  startTime: string;
  endTime: string | null;
  totalKwh: number;
}

interface TelemetryPoint {
  time: number;
  power?: number;
  soc?: number;
}

const emojiStyle: React.CSSProperties = {
  background: "var(--gradient-primary)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  display: "inline-block",
  lineHeight: "1.2",
};

export default function Overview() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<SummaryData>({
    total_energy_kwh: 0,
    last_7_days_energy_kwh: 0,
  });
  const [calendarData, setCalendarData] = useState<any[]>([]);
  const [latestTx, setLatestTx] = useState<LatestTransaction | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysCharged, setDaysCharged] = useState(0);

  if (!user) return null;

  useEffect(() => {
    const loadOverviewData = async () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const dateString = oneYearAgo.toISOString().split("T")[0];

      try {
        const data = await fetchUserOverview(user.id, dateString);

        if (
          data.user_charging_summary &&
          data.user_charging_summary.length > 0
        ) {
          setSummary(data.user_charging_summary[0]);
        }

        const dailyRecords: DailyCharge[] = data.user_daily_charging || [];
        const calendarMap = new Map(
          dailyRecords.map((r) => [r.charge_date, r.daily_kwh]),
        );

        const calendarPoints = [];
        let daysWithCharge = 0;

        for (let i = 365; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const s = d.toISOString().split("T")[0];

          const kwh = calendarMap.get(s) || 0;
          let level = 0;

          if (kwh > 0) {
            daysWithCharge++;
            const norm = Math.min(kwh, 80); // Seuil de saturation à 80 kWh
            if (norm <= 20) level = 1;
            else if (norm <= 40) level = 2;
            else if (norm <= 60) level = 3;
            else level = 4;
          }

          calendarPoints.push({
            date: s,
            count: parseFloat(kwh.toFixed(1)),
            level: level,
          });
        }
        setCalendarData(calendarPoints);
        setDaysCharged(daysWithCharge);

        const tx: LatestTransaction = data.Transactions[0];
        setLatestTx(tx || null);

        if (tx && tx.isActive) {
          loadTelemetry(tx.id);
        }
      } catch (err) {
        console.error("Erreur chargement vue d'ensemble :", err);
      } finally {
        setLoading(false);
      }
    };

    loadOverviewData();
  }, [user.id]);

  const loadTelemetry = async (dbId: number) => {
    try {
      const data = await fetchLiveTelemetry(dbId);
      if (data && data.MeterValues) {
        const points: TelemetryPoint[] = data.MeterValues.map((mv: any) => {
          const pt: TelemetryPoint = { time: new Date(mv.timestamp).getTime() };
          let samples =
            typeof mv.sampledValue === "string"
              ? JSON.parse(mv.sampledValue)
              : mv.sampledValue || [];

          samples.forEach((s: any) => {
            if (s.measurand === "Power.Active.Import" && !s.phase)
              pt.power = parseFloat(s.value);
            if (s.measurand === "SoC") pt.soc = parseFloat(s.value);
          });
          return pt;
        });
        setTelemetry(points);
      }
    } catch (e) {
      console.error("Erreur télémétrie live :", e);
    }
  };

  if (loading)
    return (
      <p
        style={{
          color: "var(--text-secondary)",
          textAlign: "center",
          marginTop: "50px",
        }}
      >
        Chargement de votre tableau de bord...
      </p>
    );

  // PALETTE TRANSPARENTE AVEC COLOR-MIX
  const transparentThemeColors = [
    "var(--bg-input)",
    "color-mix(in srgb, var(--color-user) 25%, transparent)",
    "color-mix(in srgb, var(--color-user) 50%, transparent)",
    "color-mix(in srgb, var(--color-user) 75%, transparent)",
    "var(--color-user)",
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "30px",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "1200px", textAlign: "left" }}>
        <h2
          style={{
            margin: "0 0 5px 0",
            color: "var(--text-primary)",
            fontSize: "2em",
          }}
        >
          Ravi de vous revoir, {user.firstName} !
        </h2>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Voici un aperçu de votre activité sur le réseau de recharge.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: "30px",
          width: "100%",
          maxWidth: "1200px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ ...summaryCardStyle, flex: 1 }}>
          <span style={{ fontSize: "2em", ...emojiStyle }}>🔋</span>
          <p style={summaryLabelStyle}>Énergie Totale Consommée</p>
          <h2 style={summaryValueStyle}>
            {Number(summary.total_energy_kwh).toFixed(2)}{" "}
            <span style={{ fontSize: "0.5em", color: "var(--text-secondary)" }}>
              kWh
            </span>
          </h2>
        </div>
        <div style={{ ...summaryCardStyle, flex: 1 }}>
          <span style={{ fontSize: "2em", ...emojiStyle }}>📅</span>
          <p style={summaryLabelStyle}>7 Derniers Jours</p>
          <h2 style={summaryValueStyle}>
            {Number(summary.last_7_days_energy_kwh).toFixed(2)}{" "}
            <span style={{ fontSize: "0.5em", color: "var(--text-secondary)" }}>
              kWh
            </span>
          </h2>
        </div>
      </div>

      <div style={cardStyle}>
        {latestTx && latestTx.isActive ? (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "25px",
                flexWrap: "wrap",
                gap: "15px",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: "var(--text-primary)",
                    fontSize: "1.4em",
                  }}
                >
                  <span style={{ marginRight: "10px" }}>⚡</span> Session en
                  cours...
                </h3>
                <p style={{ margin: "5px 0 0 0", color: "var(--text-mute)" }}>
                  Borne : {latestTx.ocppConnectionName} | Conn.{" "}
                  {latestTx.connectorId}
                </p>
              </div>
              <div style={{ display: "flex", gap: "20px" }}>
                <div style={{ textAlign: "center" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.7em",
                      color: "var(--text-secondary)",
                    }}
                  >
                    CONSOMMÉ
                  </p>
                  <p style={{ margin: 0, fontWeight: "bold" }}>
                    {latestTx.totalKwh.toFixed(2)} kWh
                  </p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.7em",
                      color: "var(--text-secondary)",
                    }}
                  >
                    PRIX
                  </p>
                  <p style={{ margin: 0, fontWeight: "bold" }}>0.00 CHF</p>
                </div>
                <DetailButton
                  onClick={() =>
                    navigate(`/dashboard/transactions/${latestTx.id}`)
                  }
                />
              </div>
            </div>

            <div
              style={{
                backgroundColor: "var(--bg-input)",
                padding: "20px",
                borderRadius: "20px",
                border: "1px solid var(--color-border)",
                minWidth: 0,
              }}
            >
              <div
                style={{ width: "100%", height: "320px", position: "relative" }}
              >
                <ResponsiveContainer width="99%" height="100%">
                  <LineChart
                    data={telemetry}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="time"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(t) =>
                        new Date(t).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      }
                      stroke="var(--text-secondary)"
                      fontSize={11}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="var(--color-user)"
                      fontSize={11}
                      label={{
                        value: "Puissance (W)",
                        angle: -90,
                        position: "insideLeft",
                        fill: "var(--color-user)",
                        offset: 10,
                      }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="var(--color-admin)"
                      fontSize={11}
                      domain={[0, 100]}
                      label={{
                        value: "SoC (%)",
                        angle: 90,
                        position: "insideRight",
                        fill: "var(--color-admin)",
                        offset: 10,
                      }}
                    />
                    <Tooltip
                      labelFormatter={(t) => new Date(t).toLocaleTimeString()}
                      contentStyle={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "10px",
                        color: "var(--text-primary)",
                      }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      connectNulls
                      type="monotone"
                      dataKey="power"
                      name="Puissance (W)"
                      stroke="var(--color-user)"
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      connectNulls
                      type="monotone"
                      dataKey="soc"
                      name="SoC (%)"
                      stroke="var(--color-admin)"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h3
              style={{
                marginTop: 0,
                color: "var(--text-primary)",
                fontSize: "1.4em",
                marginBottom: "20px",
              }}
            >
              <span style={{ marginRight: "10px", ...emojiStyle }}>🏁</span>{" "}
              Dernière session effectuée
            </h3>
            {latestTx ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "var(--bg-input)",
                  padding: "20px 30px",
                  borderRadius: "20px",
                  border: "1px solid var(--color-border)",
                  flexWrap: "wrap",
                  gap: "20px",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: "bold",
                      fontSize: "1.1em",
                      color: "var(--text-primary)",
                    }}
                  >
                    {latestTx.ocppConnectionName} | Conn. {latestTx.connectorId}
                  </p>
                  <p
                    style={{
                      margin: "5px 0 0 0",
                      color: "var(--text-secondary)",
                      fontSize: "0.9em",
                    }}
                  >
                    Le {new Date(latestTx.startTime).toLocaleDateString()} à{" "}
                    {new Date(latestTx.startTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <p
                    style={{
                      margin: 0,
                      color: "var(--text-mute)",
                      fontSize: "0.8em",
                      textTransform: "uppercase",
                      fontWeight: "700",
                    }}
                  >
                    Énergie
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0 0",
                      fontWeight: "bold",
                      color: "var(--color-user)",
                    }}
                  >
                    {Number(latestTx.totalKwh).toFixed(3)} kWh
                  </p>
                </div>
                <DetailButton
                  onClick={() =>
                    navigate(`/dashboard/transactions/${latestTx.id}`)
                  }
                />
              </div>
            ) : (
              <p
                style={{
                  margin: 0,
                  color: "var(--text-mute)",
                  fontStyle: "italic",
                }}
              >
                Aucune session de charge enregistrée sur votre compte.
              </p>
            )}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h3
          style={{
            marginTop: 0,
            color: "var(--text-primary)",
            fontSize: "1.4em",
            marginBottom: "25px",
            textAlign: "left",
          }}
        >
          <span style={{ marginRight: "10px", ...emojiStyle }}>📆</span>{" "}
          Activité
        </h3>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
            overflowX: "auto",
            padding: "10px 0",
          }}
        >
          <ActivityCalendar
            data={calendarData}
            theme={{
              light: transparentThemeColors,
              dark: transparentThemeColors,
            }}
            labels={{
              months: [
                "Jan",
                "Fév",
                "Mar",
                "Avr",
                "Mai",
                "Juin",
                "Juil",
                "Août",
                "Sep",
                "Oct",
                "Nov",
                "Déc",
              ],
              weekdays: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
              totalCount: `${daysCharged} jours de recharge sur les 365 derniers jours`,
              legend: { less: "Moins d'énergie", more: "Plus d'énergie" },
            }}
          />
        </div>
      </div>
    </div>
  );
}

// --- SOUS-COMPOSANT BOUTON DÉTAIL ---
function DetailButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "10px 20px",
        background: hover ? "var(--color-user)" : "var(--bg-input)",
        color: hover ? "#fff" : "var(--text-primary)",
        border: "1px solid var(--color-border)",
        borderRadius: "12px",
        cursor: "pointer",
        fontWeight: "600",
        transition: "all 0.2s ease",
      }}
    >
      Détail ➔
    </button>
  );
}

// --- STYLE BLOCKS ---
const cardStyle: React.CSSProperties = {
  border: "3px solid transparent",
  background: `linear-gradient(var(--bg-card), var(--bg-card)) padding-box, var(--gradient-primary) border-box`,
  padding: "40px",
  borderRadius: "40px",
  boxShadow: "var(--shadow-card)",
  width: "100%",
  maxWidth: "1200px",
  boxSizing: "border-box",
};
const summaryCardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-card)",
  padding: "25px",
  borderRadius: "30px",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-card)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
};
const summaryLabelStyle: React.CSSProperties = {
  margin: "10px 0 0 0",
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontSize: "0.85em",
  fontWeight: "bold",
};
const summaryValueStyle: React.CSSProperties = {
  margin: "5px 0 0 0",
  color: "var(--text-primary)",
  fontSize: "2.4em",
  fontWeight: "bold",
};
