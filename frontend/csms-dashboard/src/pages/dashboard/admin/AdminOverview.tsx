import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useNavigate } from "react-router-dom";
import {
  fetchAdminOverviewData,
  fetchAdminTelemetry,
} from "../../../api/adminApi";

export default function AdminOverview() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [stations, setStations] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [energyToday, setEnergyToday] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).toISOString();

      // --- MODIFICATION POUR LE TEST : DU 18.06 à 15h AU 18.06 à 17h ---
      // L'année "2026" est utilisée ici pour correspondre à ton environnement,
      // adapte-la au besoin si tes données ont été générées sur une autre année.
      const testStartDate = new Date("2026-06-18T15:00:00");
      const testEndDate = new Date("2026-06-18T17:00:00");

      const endTimestamp = now.getTime();
      const startTimestamp = endTimestamp - 24 * 60 * 60 * 1000; // 24 heures en millisecondes
      const startDateIso = new Date(startTimestamp).toISOString();
      // ----------------------------------------------------------------

      const [overviewData, telemetryData] = await Promise.all([
        fetchAdminOverviewData(startOfDay),
        fetchAdminTelemetry(startDateIso),
      ]);

      setStations(overviewData?.ChargingStations || []);
      setActiveSessions(overviewData?.ActiveTransactions || []);

      const totalKwh = (overviewData?.TodayTransactions || []).reduce(
        (sum: number, tx: any) => sum + (tx.totalKwh || 0),
        0,
      );
      setEnergyToday(totalKwh);

      // --- MOTEUR ÉVÉNEMENTIEL ---
      const events: {
        time: number;
        type: string;
        txId?: number;
        power?: number;
      }[] = [];

      // 1. Événements de limites (Force l'affichage complet de la fenêtre de test)
      events.push({ time: startTimestamp, type: "WINDOW_START" });
      events.push({ time: endTimestamp, type: "WINDOW_END" });

      // 2. Traitement des MeterValues ET suivi de la dernière mise à jour de puissance
      const lastPowerUpdatePerTx: Record<number, number> = {};

      (telemetryData?.MeterValues || []).forEach((mv: any) => {
        let powerKW = 0;
        let isPowerUpdate = false;

        try {
          const parsed =
            typeof mv.sampledValue === "string"
              ? JSON.parse(mv.sampledValue)
              : mv.sampledValue;
          if (Array.isArray(parsed)) {
            const powerItem = parsed.find(
              (item: any) => item.measurand === "Power.Active.Import",
            );
            if (powerItem && powerItem.value !== undefined) {
              powerKW = powerItem.value / 1000;
              isPowerUpdate = true;
            }
          }
        } catch (e) {}

        // On n'enregistre l'événement que si c'est une vraie donnée de puissance
        if (isPowerUpdate) {
          const mvTime = new Date(mv.timestamp).getTime();
          const txId = mv.transactionDatabaseId;

          events.push({
            time: mvTime,
            type: "UPDATE",
            txId: txId,
            power: powerKW,
          });

          // On mémorise l'heure exacte de la dernière puissance envoyée pour cette session
          if (
            !lastPowerUpdatePerTx[txId] ||
            mvTime > lastPowerUpdatePerTx[txId]
          ) {
            lastPowerUpdatePerTx[txId] = mvTime;
          }
        }
      });

      // 3. Événements de Transactions (START, END, et chute à 0 pour inactivité)
      (telemetryData?.Transactions || []).forEach((tx: any) => {
        if (tx.startTime) {
          events.push({
            time: new Date(tx.startTime).getTime(),
            type: "START",
            txId: tx.id,
          });
        }
        if (tx.endTime) {
          const endTimeMs = new Date(tx.endTime).getTime();
          const lastMvTime = lastPowerUpdatePerTx[tx.id];

          // Si on a un écart de plus de 2 minutes (120 000 ms) entre la dernière puissance et le vrai débranchement
          if (lastMvTime && endTimeMs - lastMvTime > 120000) {
            events.push({
              time: lastMvTime + 120000,
              type: "IDLE_ZERO",
              txId: tx.id,
            });
          }

          events.push({ time: endTimeMs, type: "END", txId: tx.id });
        }
      });

      // 4. On trie chronologiquement
      events.sort((a, b) => a.time - b.time);

      // 5. Calcul des totaux pas-à-pas
      const powerPerTx: Record<number, number> = {};
      const chartPoints: any[] = [];

      events.forEach((event) => {
        if (event.type === "START" && event.txId) powerPerTx[event.txId] = 0;
        // NOUVEAU : Si la session se termine OU si elle est inactive depuis 2 min, on la passe à 0 kW
        if (
          (event.type === "END" || event.type === "IDLE_ZERO") &&
          event.txId
        ) {
          powerPerTx[event.txId] = 0;
        }
        if (
          event.type === "UPDATE" &&
          event.txId &&
          event.power !== undefined
        ) {
          powerPerTx[event.txId] = event.power;
        }

        const currentTotalPower = Object.values(powerPerTx).reduce(
          (sum, val) => sum + val,
          0,
        );

        // Ajout du point uniquement si on est dans notre fenêtre de 2 heures
        if (event.time >= startTimestamp && event.time <= endTimestamp) {
          chartPoints.push({
            timestamp: event.time,
            puissance: currentTotalPower,
          });
        }
      });

      // 6. Nettoyage
      const uniqueChartPoints: any[] = [];
      chartPoints.forEach((point) => {
        if (
          uniqueChartPoints.length > 0 &&
          uniqueChartPoints[uniqueChartPoints.length - 1].timestamp ===
            point.timestamp
        ) {
          uniqueChartPoints[uniqueChartPoints.length - 1].puissance =
            point.puissance;
        } else {
          uniqueChartPoints.push(point);
        }
      });

      setChartData(uniqueChartPoints);
    } catch (err: any) {
      setError(err.message || "Erreur lors du chargement des données.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- CALCUL DES KPI ---
  const totalStations = stations.length;
  const offlineStations = stations.filter((s) => !s.isOnline).length;
  const activeStationNames = activeSessions.map((s) => s.ocppConnectionName);
  const chargingStations = stations.filter(
    (s) => s.isOnline && activeStationNames.includes(s.ocppConnectionName),
  ).length;
  const availableStations = totalStations - offlineStations - chargingStations;

  // --- PUISSANCE INSTANTANÉE ---
  let instantPowerKW = 0;
  activeSessions.forEach((session) => {
    if (session.MeterValues && session.MeterValues.length > 0) {
      // On parcourt les dernières MeterValues jusqu'à trouver celle qui contient la puissance
      for (const mv of session.MeterValues) {
        try {
          const parsed =
            typeof mv.sampledValue === "string"
              ? JSON.parse(mv.sampledValue)
              : mv.sampledValue;
          if (Array.isArray(parsed)) {
            const powerItem = parsed.find(
              (item: any) => item.measurand === "Power.Active.Import",
            );
            if (powerItem && powerItem.value !== undefined) {
              instantPowerKW += powerItem.value / 1000;
              break; // TRÈS IMPORTANT : On arrête de chercher dès qu'on a trouvé la vraie dernière puissance
            }
          }
        } catch (e) {}
      }
    }
  });
  const currentPower = instantPowerKW;

  // Formateur de date
  const formatTime = (unixTime: number) => {
    const d = new Date(unixTime);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  if (isLoading && chartData.length === 0)
    return (
      <div style={{ padding: "20px" }}>Chargement du centre de contrôle...</div>
    );
  if (error)
    return <div style={{ padding: "20px", color: "red" }}>{error}</div>;

  return (
    <div style={containerStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#1f2937" }}>
          Vue d'ensemble du réseau
        </h1>
        <button onClick={loadDashboardData} style={refreshButtonStyle}>
          🔄 Rafraîchir
        </button>
      </div>

      <div style={kpiGridStyle}>
        <div style={kpiCardStyle}>
          <span style={kpiTitleStyle}>Flotte de Chargeurs</span>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "10px",
              marginTop: "10px",
            }}
          >
            <span style={kpiValueStyle}>{totalStations}</span>
            <span
              style={{
                fontSize: "0.9rem",
                color: "#6b7280",
                marginBottom: "4px",
              }}
            >
              Total
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: "15px",
              marginTop: "10px",
              fontSize: "0.8rem",
              fontWeight: "600",
            }}
          >
            <span style={{ color: "#16a34a" }}>
              🟢 {chargingStations} Actif
            </span>
            <span style={{ color: "#2563eb" }}>
              🔵 {availableStations} Dispo
            </span>
            <span style={{ color: "#dc2626" }}>
              🔴 {offlineStations} Offline
            </span>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <span style={kpiTitleStyle}>Puissance instantanée</span>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "5px",
              marginTop: "10px",
            }}
          >
            <span style={kpiValueStyle}>{currentPower.toFixed(2)}</span>
            <span style={kpiUnitStyle}>kW</span>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <span style={kpiTitleStyle}>Énergie distribuée (Aujourd'hui)</span>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "5px",
              marginTop: "10px",
            }}
          >
            <span style={kpiValueStyle}>{energyToday.toFixed(1)}</span>
            <span style={kpiUnitStyle}>kWh</span>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <span style={kpiTitleStyle}>Sessions en cours</span>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "5px",
              marginTop: "10px",
            }}
          >
            <span style={kpiValueStyle}>{activeSessions.length}</span>
            <span style={kpiUnitStyle}>véhicules</span>
          </div>
        </div>
      </div>

      <div style={chartCardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#374151" }}>
            Consommation de la flotte (24h)
          </h2>
          <span
            style={{
              fontSize: "0.85rem",
              background: "#f3f4f6",
              padding: "4px 10px",
              borderRadius: "12px",
              color: "#4b5563",
            }}
          >
            Puissance en kW
          </span>
        </div>

        <div style={{ height: "300px", width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />

              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatTime}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                minTickGap={50}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
              />

              <Tooltip
                labelFormatter={(value) => formatTime(value as number)}
                formatter={(value: number) => [
                  `${value.toFixed(2)} kW`,
                  "Puissance totale",
                ]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                }}
                labelStyle={{
                  fontWeight: "bold",
                  color: "#374151",
                  marginBottom: "5px",
                }}
              />

              <Area
                type="StepAfter"
                dataKey="puissance"
                stroke="#16a34a"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorPower)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={tableCardStyle}>
        <h2
          style={{ margin: "0 0 20px 0", fontSize: "1.1rem", color: "#374151" }}
        >
          ⚡ Sessions actives en temps réel
        </h2>

        {activeSessions.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "30px",
              color: "#6b7280",
              background: "#f9fafb",
              borderRadius: "8px",
            }}
          >
            Aucune session de charge en cours actuellement.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th style={thStyle}>Borne</th>
                <th style={thStyle}>Utilisateur</th>
                <th style={thStyle}>Heure de début</th>
                <th style={thStyle}>Énergie (kWh)</th>
                <th style={thStyle}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {activeSessions.map((session) => (
                <tr
                  key={session.id}
                  style={{ borderBottom: "1px solid #f3f4f6" }}
                >
                  <td style={tdStyle}>
                    <strong>{session.ocppConnectionName}</strong>
                  </td>
                  <td style={tdStyle}>
                    {session.User
                      ? `${session.User.first_name} ${session.User.last_name}`
                      : "Badge inconnu"}
                  </td>
                  <td style={tdStyle}>
                    {new Date(session.startTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td style={tdStyle}>
                    {session.totalKwh ? session.totalKwh.toFixed(2) : "0.00"}
                  </td>
                  <td style={tdStyle}>
                    <span style={statusBadgeStyle(session.chargingState)}>
                      {session.chargingState || "Charging"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <button
                      onClick={() => navigate(`/session/${session.id}`)}
                      style={detailsButtonStyle}
                    >
                      Détails ➔
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
const refreshButtonStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d1d5db",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "#4b5563",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "20px",
};
const kpiCardStyle: React.CSSProperties = {
  background: "#fff",
  padding: "20px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};
const kpiTitleStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
const kpiValueStyle: React.CSSProperties = {
  fontSize: "2rem",
  fontWeight: "bold",
  color: "#111827",
  lineHeight: "1",
};
const kpiUnitStyle: React.CSSProperties = {
  fontSize: "1rem",
  color: "#6b7280",
  fontWeight: "600",
  marginBottom: "4px",
};

const chartCardStyle: React.CSSProperties = {
  background: "#fff",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
};
const tableCardStyle: React.CSSProperties = {
  background: "#fff",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
  overflowX: "auto",
};

const thStyle: React.CSSProperties = {
  padding: "12px 10px",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
const tdStyle: React.CSSProperties = {
  padding: "15px 10px",
  fontSize: "0.95rem",
  color: "#1f2937",
};

const statusBadgeStyle = (state: string): React.CSSProperties => {
  const isCharging = state === "Charging" || state === "Active";
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
