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
  const [timeWindow, setTimeWindow] = useState<[number, number]>([0, 0]);

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

      // Retour strict aux 24 dernières heures
      const endTimestamp = now.getTime();
      const startTimestamp = endTimestamp - 24 * 60 * 60 * 1000;
      const startDateIso = new Date(startTimestamp).toISOString();

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

      // --- MOTEUR ÉVÉNEMENTIEL (PAR PROFIL ISOLÉ) ---
      const allTx = telemetryData?.Transactions || [];
      const allMv = telemetryData?.MeterValues || [];

      // 1. Grouper les MeterValues (puissance uniquement) par transaction
      const mvsByTx: Record<number, { time: number; power: number }[]> = {};
      allMv.forEach((mv: any) => {
        let powerKW = null;
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
            }
          }
        } catch (e) {}

        if (powerKW !== null) {
          const txId = mv.transactionDatabaseId;
          if (!mvsByTx[txId]) mvsByTx[txId] = [];
          mvsByTx[txId].push({
            time: new Date(mv.timestamp).getTime(),
            power: powerKW,
          });
        }
      });

      // 2. Construire le profil de puissance pour CHAQUE transaction indépendamment
      const txProfiles: Record<number, { time: number; power: number }[]> = {};

      // On force l'existence du point de départ et de fin du graphique pour toujours avoir une ligne
      const allTimestamps = new Set<number>([startTimestamp, endTimestamp]);

      allTx.forEach((tx: any) => {
        const profile: { time: number; power: number }[] = [];
        const startTime = new Date(tx.startTime).getTime();

        profile.push({ time: startTime, power: 0 });
        allTimestamps.add(startTime);

        const mvs = mvsByTx[tx.id] || [];
        mvs.sort((a, b) => a.time - b.time); // Tri chronologique

        let lastTime = startTime;

        // NOUVEAU : Si la session a commencé AVANT le début du graphique, on extrapole
        // sa puissance avec le premier point de mesure disponible dans la fenêtre
        if (startTime <= startTimestamp && mvs.length > 0) {
          profile.push({ time: startTimestamp, power: mvs[0].power });
          // On avance lastTime au début du graphique pour ne pas déclencher la chute
          // d'inactivité de 2 min sur le "trou" temporel des données non téléchargées
          lastTime = startTimestamp;
        }

        mvs.forEach((mv) => {
          // Si plus de 2 min d'inactivité, la borne tombe à 0
          if (mv.time - lastTime > 120000) {
            profile.push({ time: lastTime + 120000, power: 0 });
            allTimestamps.add(lastTime + 120000);
          }
          profile.push({ time: mv.time, power: mv.power });
          allTimestamps.add(mv.time);
          lastTime = mv.time;
        });

        // Gestion de la fin ou de l'inactivité actuelle
        if (tx.endTime) {
          const endTime = new Date(tx.endTime).getTime();
          if (endTime - lastTime > 120000) {
            profile.push({ time: lastTime + 120000, power: 0 });
            allTimestamps.add(lastTime + 120000);
          }
          profile.push({ time: endTime, power: 0 });
          allTimestamps.add(endTime);
        } else {
          // Session active (si pas de endTime, elle est forcément en cours)
          if (endTimestamp - lastTime > 120000) {
            profile.push({ time: lastTime + 120000, power: 0 });
            allTimestamps.add(lastTime + 120000);

            // Inspiration SessionDetail : on force un point à 0 pour la fin du graphique
            profile.push({ time: endTimestamp, power: 0 });
          } else {
            // Si on a des données récentes, on prolonge la puissance jusqu'à "maintenant"
            const lastPowerValue =
              profile.length > 0 ? profile[profile.length - 1].power : 0;
            profile.push({ time: endTimestamp, power: lastPowerValue });
          }
        }

        txProfiles[tx.id] = profile;
      });

      // 3. Créer la ligne temporelle globale en superposant les profils
      const sortedTimestamps = Array.from(allTimestamps)
        .filter((t) => t >= startTimestamp && t <= endTimestamp)
        .sort((a, b) => a - b);

      const chartPoints: any[] = [];

      sortedTimestamps.forEach((t) => {
        let currentTotalPower = 0;

        // Pour chaque transaction, on évalue sa puissance à l'instant T exact
        allTx.forEach((tx: any) => {
          const profile = txProfiles[tx.id];
          let powerAtT = 0;

          // On cherche la valeur du dernier événement qui s'est produit AVANT ou PENDANT l'instant T
          for (let i = profile.length - 1; i >= 0; i--) {
            if (profile[i].time <= t) {
              powerAtT = profile[i].power;
              break;
            }
          }
          currentTotalPower += powerAtT;
        });

        chartPoints.push({ timestamp: t, puissance: currentTotalPower });
      });

      setChartData(chartPoints);
      setTimeWindow([startTimestamp, endTimestamp]);
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
  const nowMs = new Date().getTime();

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
              // NOUVEAU : On vérifie que la donnée date de moins de 2 minutes (120 000 ms)
              const mvTime = new Date(mv.timestamp).getTime();
              if (nowMs - mvTime <= 120000) {
                instantPowerKW += powerItem.value / 1000;
              }
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
                domain={
                  timeWindow[0] !== 0 ? timeWindow : ["dataMin", "dataMax"]
                }
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
                    {session.is_legal === false && (
                      <span style={illegalBadgeStyle}>Illégal</span>
                    )}
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

const illegalBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "0.8rem",
  fontWeight: "600",
  background: "#fee2e2",
  color: "#dc2626",
  marginLeft: "8px",
};
