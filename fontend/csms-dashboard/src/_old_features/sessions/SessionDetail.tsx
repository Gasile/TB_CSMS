import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { fetchSessionDetailData } from "../../api/sessionApi";

// --- TYPES ---
interface TransactionDetail {
  id: number;
  transactionId: string;
  ocppConnectionName: string;
  connectorId: number;
  isActive: boolean;
  chargingState: string;
  startTime: string;
  endTime: string | null;
  stoppedReason: string | null;
  totalKwh: number;
  User: { first_name: string; last_name: string } | null;
  Authorization: { idToken: string } | null;
}

interface ChartDataPoint {
  time: number;
  powerTotal?: number;
  powerL1?: number;
  powerL2?: number;
  powerL3?: number;
  currentTotal?: number;
  currentL1?: number;
  currentL2?: number;
  currentL3?: number;
  voltageL1?: number;
  voltageL2?: number;
  voltageL3?: number;
  soc?: number;
}

const emojiStyle: React.CSSProperties = {
  background: "var(--gradient-primary)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  display: "inline-block",
  lineHeight: "1.2",
};

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [transaction, setTransaction] = useState<TransactionDetail | null>(
    null,
  );
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPhases, setShowPhases] = useState(false);
  const [isBackHovered, setIsBackHovered] = useState(false);

  useEffect(() => {
    const fetchSessionData = async () => {
      if (!id) return;

      try {
        const data = await fetchSessionDetailData(Number(id));

        if (data) {
          const tx = data.Transactions[0];
          setTransaction(tx || null);

          const rawMeterValues = data.MeterValues || [];
          const formattedData: ChartDataPoint[] = rawMeterValues.map(
            (mv: any) => {
              const timeObj = new Date(mv.timestamp);
              const point: ChartDataPoint = {
                time: timeObj.getTime(),
              };

              let samples = [];
              if (typeof mv.sampledValue === "string") {
                try {
                  samples = JSON.parse(mv.sampledValue);
                } catch (e) {}
              } else {
                samples = mv.sampledValue || [];
              }

              if (Array.isArray(samples)) {
                samples.forEach((s: any) => {
                  const val = parseFloat(s.value);
                  if (isNaN(val)) return;

                  if (s.measurand === "Power.Active.Import") {
                    if (!s.phase) point.powerTotal = val;
                    else if (s.phase === "L1") point.powerL1 = val;
                    else if (s.phase === "L2") point.powerL2 = val;
                    else if (s.phase === "L3") point.powerL3 = val;
                  }
                  if (s.measurand === "Current.Import") {
                    if (!s.phase) point.currentTotal = val;
                    else if (s.phase === "L1") point.currentL1 = val;
                    else if (s.phase === "L2") point.currentL2 = val;
                    else if (s.phase === "L3") point.currentL3 = val;
                  }
                  if (s.measurand === "Voltage") {
                    if (s.phase === "L1-N" || s.phase === "L1")
                      point.voltageL1 = val;
                    else if (s.phase === "L2-N" || s.phase === "L2")
                      point.voltageL2 = val;
                    else if (s.phase === "L3-N" || s.phase === "L3")
                      point.voltageL3 = val;
                  }
                  if (s.measurand === "SoC") {
                    point.soc = val;
                  }
                });
              }
              return point;
            },
          );

          setChartData(formattedData);
        }
      } catch (err) {
        console.error("Erreur chargement session :", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [id]);

  const formatTime = (unixTime: number) => {
    return new Date(unixTime).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
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
        Analyse des relevés de la session...
      </p>
    );
  if (!transaction)
    return (
      <p
        style={{
          color: "var(--error-color)",
          textAlign: "center",
          marginTop: "50px",
        }}
      >
        Session introuvable.
      </p>
    );

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
        <button
          onClick={() => navigate(-1)}
          onMouseEnter={() => setIsBackHovered(true)}
          onMouseLeave={() => setIsBackHovered(false)}
          style={getBackButtonStyle(isBackHovered)}
        >
          <span style={{ marginRight: "8px", ...emojiStyle }}>🔙</span> Retour
        </button>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <div>
            <h3
              style={{
                marginTop: 0,
                color: "var(--text-primary)",
                fontSize: "1.6em",
                marginBottom: "5px",
              }}
            >
              <span style={{ marginRight: "10px", ...emojiStyle }}>📝</span>{" "}
              Rapport de Session
            </h3>
            <p
              style={{
                margin: 0,
                color: "var(--text-mute)",
                fontFamily: "monospace",
                fontSize: "0.95em",
              }}
            >
              ID: {transaction.transactionId}
            </p>
          </div>
          <span style={getStatusBadgeStyle(transaction.isActive)}>
            {transaction.isActive
              ? "🟢 En cours de charge"
              : "⚪ Session Terminée"}
          </span>
        </div>

        <div
          style={{
            height: "1px",
            background: "var(--color-border)",
            margin: "25px 0",
          }}
        />

        <div style={gridStyle}>
          <InfoBlock
            label="Borne & Connecteur"
            value={`${transaction.ocppConnectionName} - Connecteur ${transaction.connectorId}`}
            icon="🔌"
          />
          <InfoBlock
            label="Utilisateur"
            value={
              transaction.User
                ? `${transaction.User.first_name} ${transaction.User.last_name}`
                : "Badge Anonyme"
            }
            icon="👤"
          />
          <InfoBlock
            label="Badge Utilisé (RFID)"
            value={transaction.Authorization?.idToken || "Non identifié"}
            icon="💳"
            isMono
          />
          <InfoBlock
            label="Début"
            value={new Date(transaction.startTime).toLocaleString()}
            icon="⏱️"
          />
          <InfoBlock
            label="Fin"
            value={
              transaction.endTime
                ? new Date(transaction.endTime).toLocaleString()
                : "-"
            }
            icon="🏁"
          />
          <InfoBlock
            label="Raison d'arrêt"
            value={transaction.stoppedReason || "En cours"}
            icon="🛑"
          />
        </div>
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
          <span style={{ fontSize: "2em", ...emojiStyle }}>⚡</span>
          <p style={summaryLabelStyle}>Énergie Délivrée</p>
          <h2 style={summaryValueStyle}>
            {transaction.totalKwh
              ? Number(transaction.totalKwh).toFixed(3)
              : "0.000"}{" "}
            <span style={{ fontSize: "0.6em", color: "var(--text-secondary)" }}>
              kWh
            </span>
          </h2>
        </div>
        <div style={{ ...summaryCardStyle, flex: 1 }}>
          <span style={{ fontSize: "2em", ...emojiStyle }}>💰</span>
          <p style={summaryLabelStyle}>Coût de la session</p>
          <h2 style={summaryValueStyle}>
            0.00{" "}
            <span style={{ fontSize: "0.6em", color: "var(--text-secondary)" }}>
              CHF
            </span>
          </h2>
        </div>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "30px",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <h3
            style={{
              margin: 0,
              color: "var(--text-primary)",
              fontSize: "1.4em",
            }}
          >
            <span style={{ marginRight: "10px", ...emojiStyle }}>📈</span>{" "}
            Télémétrie
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <span
              style={{
                color: !showPhases ? "var(--text-primary)" : "var(--text-mute)",
                fontWeight: "bold",
                fontSize: "0.9em",
              }}
            >
              Général
            </span>
            <div
              onClick={() => setShowPhases(!showPhases)}
              style={getSwitchContainerStyle(showPhases)}
            >
              <div style={getSwitchThumbStyle(showPhases)}></div>
            </div>
            <span
              style={{
                color: showPhases ? "var(--text-primary)" : "var(--text-mute)",
                fontWeight: "bold",
                fontSize: "0.9em",
              }}
            >
              Détail Phases (L1/L2/L3)
            </span>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div
            style={{
              padding: "50px",
              textAlign: "center",
              color: "var(--text-mute)",
              fontStyle: "italic",
              border: "1px dashed var(--color-border)",
              borderRadius: "20px",
            }}
          >
            Aucun relevé (MeterValue) disponible pour générer les graphiques.
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "40px" }}
          >
            {!showPhases ? (
              <>
                <ChartContainer title="Puissance Appliquée (Watts)">
                  <LineChart
                    data={chartData}
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
                      tickFormatter={formatTime}
                      stroke="var(--text-secondary)"
                      fontSize={12}
                      tickMargin={10}
                    />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} />
                    <Tooltip
                      labelFormatter={formatTime}
                      contentStyle={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "10px",
                        color: "var(--text-primary)",
                      }}
                    />
                    <Legend />
                    <Line
                      connectNulls={true}
                      type="monotone"
                      dataKey="powerTotal"
                      name="Puissance Totale (W)"
                      stroke="var(--accent-primary)"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ChartContainer>

                <ChartContainer title="État de charge du véhicule (SoC %)">
                  <LineChart
                    data={chartData}
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
                      tickFormatter={formatTime}
                      stroke="var(--text-secondary)"
                      fontSize={12}
                      tickMargin={10}
                    />
                    <YAxis
                      stroke="var(--text-secondary)"
                      fontSize={12}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      labelFormatter={formatTime}
                      contentStyle={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "10px",
                        color: "var(--text-primary)",
                      }}
                    />
                    <Legend />
                    <Line
                      connectNulls={true}
                      type="stepAfter"
                      dataKey="soc"
                      name="SoC (%)"
                      stroke="var(--accent-secondary)"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </>
            ) : (
              <>
                <ChartContainer title="Ampérage par Phase (A)">
                  <LineChart
                    data={chartData}
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
                      tickFormatter={formatTime}
                      stroke="var(--text-secondary)"
                      fontSize={12}
                      tickMargin={10}
                    />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} />
                    <Tooltip
                      labelFormatter={formatTime}
                      contentStyle={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "10px",
                        color: "var(--text-primary)",
                      }}
                    />
                    <Legend />
                    <Line
                      connectNulls={true}
                      type="monotone"
                      dataKey="currentL1"
                      name="Courant L1"
                      stroke="#ff4757"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      connectNulls={true}
                      type="monotone"
                      dataKey="currentL2"
                      name="Courant L2"
                      stroke="#2ed573"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      connectNulls={true}
                      type="monotone"
                      dataKey="currentL3"
                      name="Courant L3"
                      stroke="#1e90ff"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      connectNulls={true}
                      type="monotone"
                      dataKey="currentTotal"
                      name="Courant Total"
                      stroke="var(--text-mute)"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>

                <ChartContainer title="Tension par Phase (V)">
                  <LineChart
                    data={chartData}
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
                      tickFormatter={formatTime}
                      stroke="var(--text-secondary)"
                      fontSize={12}
                      tickMargin={10}
                    />
                    <YAxis
                      stroke="var(--text-secondary)"
                      fontSize={12}
                      domain={["dataMin - 10", "dataMax + 10"]}
                    />
                    <Tooltip
                      labelFormatter={formatTime}
                      contentStyle={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--color-border)",
                        borderRadius: "10px",
                        color: "var(--text-primary)",
                      }}
                    />
                    <Legend />
                    <Line
                      connectNulls={true}
                      type="monotone"
                      dataKey="voltageL1"
                      name="Tension L1"
                      stroke="#ff4757"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      connectNulls={true}
                      type="monotone"
                      dataKey="voltageL2"
                      name="Tension L2"
                      stroke="#2ed573"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      connectNulls={true}
                      type="monotone"
                      dataKey="voltageL3"
                      name="Tension L3"
                      stroke="#1e90ff"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  icon,
  isMono,
}: {
  label: string;
  value: string;
  icon: string;
  isMono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        backgroundColor: "var(--bg-input)",
        padding: "18px 20px",
        borderRadius: "16px",
        border: "1px solid var(--color-border)",
      }}
    >
      <span
        style={{
          fontSize: "0.8em",
          color: "var(--text-mute)",
          textTransform: "uppercase",
          letterSpacing: "1px",
          fontWeight: "700",
        }}
      >
        <span style={{ marginRight: "6px" }}>{icon}</span> {label}
      </span>
      <span
        style={{
          fontSize: "1.1em",
          color: "var(--text-primary)",
          fontWeight: "500",
          fontFamily: isMono ? "monospace" : "inherit",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ChartContainer({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--bg-input)",
        padding: "20px",
        borderRadius: "20px",
        border: "1px solid var(--color-border)",
      }}
    >
      <h4
        style={{
          margin: "0 0 20px 0",
          color: "var(--text-secondary)",
          textAlign: "center",
          fontSize: "1.1em",
        }}
      >
        {title}
      </h4>
      <div style={{ width: "100%", height: "300px" }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

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
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "20px",
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
const getStatusBadgeStyle = (isActive: boolean): React.CSSProperties => ({
  backgroundColor: isActive ? "var(--bg-user-active)" : "var(--bg-input)",
  color: isActive ? "var(--color-user)" : "var(--text-mute)",
  padding: "8px 16px",
  borderRadius: "12px",
  fontSize: "0.9em",
  fontWeight: "bold",
  border: `1px solid ${isActive ? "var(--color-user)" : "var(--color-border)"}`,
});
const getSwitchContainerStyle = (isActive: boolean): React.CSSProperties => ({
  width: "50px",
  height: "26px",
  borderRadius: "13px",
  backgroundColor: isActive ? "var(--color-user)" : "var(--bg-input)",
  border: "1px solid var(--color-border)",
  display: "flex",
  alignItems: "center",
  cursor: "pointer",
  position: "relative",
  transition: "var(--transition-standard)",
  boxSizing: "border-box",
});
const getSwitchThumbStyle = (isActive: boolean): React.CSSProperties => ({
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  backgroundColor: "#fff",
  position: "absolute",
  left: isActive ? "calc(100% - 22px)" : "2px",
  transition: "left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
});
