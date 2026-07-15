// ============================================================================
// IMPORTS
// ============================================================================

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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Administrative command center view rendering real-time network infrastructure metrics,
 * a layered 24-hour fleet power demand curve, and ongoing active charging tables.
 */
export default function AdminOverview() {
  const navigate = useNavigate();

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Fleet & Telemetry States
  const [stations, setStations] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [energyToday, setEnergyToday] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [timeWindow, setTimeWindow] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  /**
   * Fetches data updates, groups individual transaction profiles, and compiles the timeline telemetry.
   */
  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).toISOString();

      // Configure a strict 24-hour sliding chronological window
      const endTimestamp = now.getTime();
      const startTimestamp = endTimestamp - 24 * 60 * 60 * 1000;
      const startDateIso = new Date(startTimestamp).toISOString();

      const [overviewData, telemetryData] = await Promise.all([
        fetchAdminOverviewData(startOfDay),
        fetchAdminTelemetry(startDateIso),
      ]);

      setStations(overviewData?.ChargingStations || []);
      setActiveSessions(overviewData?.ActiveTransactions || []);

      // Calculate accumulated energy delivered throughout the calendar day
      const totalKwh = (overviewData?.TodayTransactions || []).reduce(
        (sum: number, tx: any) => sum + (tx.totalKwh || 0),
        0,
      );
      setEnergyToday(totalKwh);

      // --- EVENEMENTIAL TELEMETRY PROCESSING ENGINE (PER ISOLATED PROFILE) ---
      const allTx = telemetryData?.Transactions || [];
      const allMv = telemetryData?.MeterValues || [];

      // 1. Group raw active power meter values by their database transaction references
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

      // 2. Map isolated active power curves independently for each transaction timeline
      const txProfiles: Record<number, { time: number; power: number }[]> = {};
      const allTimestamps = new Set<number>([startTimestamp, endTimestamp]);

      allTx.forEach((tx: any) => {
        const profile: { time: number; power: number }[] = [];
        const startTime = new Date(tx.startTime).getTime();

        profile.push({ time: startTime, power: 0 });
        allTimestamps.add(startTime);

        const mvs = mvsByTx[tx.id] || [];
        mvs.sort((a, b) => a.time - b.time);

        let lastTime = startTime;

        // Push continuous padding if transaction started before the current 24h graph frame
        if (startTime <= startTimestamp && mvs.length > 0) {
          profile.push({ time: startTimestamp, power: mvs[0].power });
          lastTime = startTimestamp;
        }

        mvs.forEach((mv) => {
          // If a meter value interval exceeds 2 minutes, register a fallback drop to 0 kW
          if (mv.time - lastTime > 120000) {
            profile.push({ time: lastTime + 120000, power: 0 });
            allTimestamps.add(lastTime + 120000);
          }
          profile.push({ time: mv.time, power: mv.power });
          allTimestamps.add(mv.time);
          lastTime = mv.time;
        });

        if (tx.endTime) {
          const endTime = new Date(tx.endTime).getTime();
          if (endTime - lastTime > 120000) {
            profile.push({ time: lastTime + 120000, power: 0 });
            allTimestamps.add(lastTime + 120000);
          }
          profile.push({ time: endTime, power: 0 });
          allTimestamps.add(endTime);
        } else {
          // Keep active sequences projecting up to the current boundary frame marker
          if (endTimestamp - lastTime > 120000) {
            profile.push({ time: lastTime + 120000, power: 0 });
            allTimestamps.add(lastTime + 120000);
            profile.push({ time: endTimestamp, power: 0 });
          } else {
            const lastPowerValue =
              profile.length > 0 ? profile[profile.length - 1].power : 0;
            profile.push({ time: endTimestamp, power: lastPowerValue });
          }
        }

        txProfiles[tx.id] = profile;
      });

      // 3. Superimpose transaction timelines into a unified total power load matrix
      const sortedTimestamps = Array.from(allTimestamps)
        .filter((t) => t >= startTimestamp && t <= endTimestamp)
        .sort((a, b) => a - b);

      const chartPoints: any[] = [];

      sortedTimestamps.forEach((t) => {
        let currentTotalPower = 0;

        allTx.forEach((tx: any) => {
          const profile = txProfiles[tx.id];
          let powerAtT = 0;

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

  // --- KPI CALCULATIONS ---
  const totalStations = stations.length;
  const offlineStations = stations.filter((s) => !s.isOnline).length;
  const activeStationNames = activeSessions.map((s) => s.ocppConnectionName);
  const chargingStations = stations.filter(
    (s) => s.isOnline && activeStationNames.includes(s.ocppConnectionName),
  ).length;
  const availableStations = totalStations - offlineStations - chargingStations;

  const nowMs = new Date().getTime();

  /**
   * Retrieves the most recent real-time active power reading for a session, filtering outdated packets.
   */
  const getSessionInstantPower = (session: any): number => {
    if (session.MeterValues && session.MeterValues.length > 0) {
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
              const mvTime = new Date(mv.timestamp).getTime();
              // Drop readings older than 2 minutes to handle vehicle unplug actions safely
              if (nowMs - mvTime <= 120000) {
                return powerItem.value / 1000;
              }
              break;
            }
          }
        } catch (e) {}
      }
    }
    return 0;
  };

  // Sum total real-time system power consumption metrics
  let instantPowerKW = 0;
  activeSessions.forEach((session) => {
    instantPowerKW += getSessionInstantPower(session);
  });
  const currentPower = instantPowerKW;

  /**
   * Formats a unix timestamp into a readable date and hour indicator layout.
   */
  const formatTime = (unixTime: number) => {
    const d = new Date(unixTime);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  if (isLoading && chartData.length === 0)
    return (
      <div style={{ padding: "20px", color: "var(--text-main)" }}>
        Chargement du centre de contrôle...
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
      {/* Title & Synchronization Header controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "1.8rem",
            color: "var(--text-main)",
            transition: "var(--theme-transition)",
          }}
        >
          Vue d'ensemble du réseau
        </h1>
        <button onClick={loadDashboardData} style={refreshButtonStyle}>
          🔄 Rafraîchir
        </button>
      </div>

      {/* KPI Display Metrics Summary Grid */}
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
                color: "var(--text-muted)",
                marginBottom: "4px",
                transition: "var(--theme-transition)",
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
            <span
              style={{
                color: "var(--status-charging)",
                transition: "var(--theme-transition)",
              }}
            >
              🟢 {chargingStations} Actif
            </span>
            <span
              style={{
                color: "var(--status-available)",
                transition: "var(--theme-transition)",
              }}
            >
              🔵 {availableStations} Dispo
            </span>
            <span
              style={{
                color: "var(--status-offline)",
                transition: "var(--theme-transition)",
              }}
            >
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

      {/* Fleet 24-Hour Telemetry Total Demand Area Chart */}
      <div style={chartCardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "1.1rem",
              color: "var(--text-main)",
              transition: "var(--theme-transition)",
            }}
          >
            Consommation de la flotte (24h)
          </h2>
          <span
            style={{
              fontSize: "0.85rem",
              background: "var(--bg-app)",
              padding: "4px 10px",
              borderRadius: "12px",
              color: "var(--text-muted)",
              transition: "var(--theme-transition)",
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
                  <stop
                    offset="5%"
                    stopColor="var(--primary)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--primary)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border-color)"
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
                tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                minTickGap={50}
              />

              <YAxis
                width={50}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "var(--text-muted)" }}
              />

              <Tooltip
                labelFormatter={(value) => formatTime(value as number)}
                formatter={(value: number) => [
                  `${value.toFixed(2)} kW`,
                  "Puissance totale",
                ]}
                contentStyle={{
                  background: "var(--bg-card)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  color: "var(--text-main)",
                }}
                labelStyle={{
                  fontWeight: "bold",
                  color: "var(--text-main)",
                  marginBottom: "5px",
                }}
              />

              <Area
                type="StepAfter"
                dataKey="puissance"
                stroke="var(--primary)"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorPower)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live Active Sessions Monitoring Table */}
      <div style={tableCardStyle}>
        <h2
          style={{
            margin: "0 0 20px 0",
            fontSize: "1.1rem",
            color: "var(--text-main)",
            transition: "var(--theme-transition)",
          }}
        >
          ⚡ Sessions actives en temps réel
        </h2>

        {activeSessions.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "30px",
              color: "var(--text-muted)",
              background: "var(--bg-app)",
              borderRadius: "8px",
              transition: "var(--theme-transition)",
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
              <tr style={{ borderBottom: "2px solid var(--border-color)" }}>
                <th style={thStyle}>Borne</th>
                <th style={thStyle}>Utilisateur</th>
                <th style={thStyle}>Heure de début</th>
                <th style={thStyle}>Puissance (kW)</th>
                <th style={thStyle}>Énergie (kWh)</th>
                <th style={thStyle}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {activeSessions.map((session) => {
                const sessionPower = getSessionInstantPower(session);
                const percentOfTotal =
                  currentPower > 0 ? (sessionPower / currentPower) * 100 : 0;

                return (
                  <tr
                    key={session.id}
                    style={{
                      borderBottom: "1px solid var(--border-color)",
                      transition: "var(--theme-transition)",
                    }}
                  >
                    <td style={tdStyle}>
                      <strong>
                        {session.ChargingStations_by_pk?.chargePointModel ||
                        session.ChargingStation?.chargePointModel
                          ? `${session.ChargingStations_by_pk?.chargePointModel || session.ChargingStation.chargePointModel} `
                          : ""}
                        {session.ocppConnectionName}
                      </strong>
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
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: "bold",
                            color:
                              sessionPower > 0
                                ? "var(--status-charging)"
                                : "var(--text-muted)",
                            transition: "var(--theme-transition)",
                          }}
                        >
                          {sessionPower.toFixed(2)} kW
                        </span>
                        {sessionPower > 0 && currentPower > 0 && (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                              fontWeight: "500",
                              transition: "var(--theme-transition)",
                            }}
                          >
                            {percentOfTotal.toFixed(1)}% du total
                          </span>
                        )}
                      </div>
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
                );
              })}
            </tbody>
          </table>
        )}
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

const refreshButtonStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "20px",
};

const kpiCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  padding: "20px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  transition: "var(--theme-transition)",
};

const kpiTitleStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  transition: "var(--theme-transition)",
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: "2rem",
  fontWeight: "bold",
  color: "var(--text-main)",
  lineHeight: "1",
  transition: "var(--theme-transition)",
};

const kpiUnitStyle: React.CSSProperties = {
  fontSize: "1rem",
  color: "var(--text-muted)",
  fontWeight: "600",
  marginBottom: "4px",
  transition: "var(--theme-transition)",
};

const chartCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
  transition: "var(--theme-transition)",
};

const tableCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
  overflowX: "auto",
  transition: "var(--theme-transition)",
};

const thStyle: React.CSSProperties = {
  padding: "12px 10px",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  transition: "var(--theme-transition)",
};

const tdStyle: React.CSSProperties = {
  padding: "15px 10px",
  fontSize: "0.95rem",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};

const statusBadgeStyle = (state: string): React.CSSProperties => {
  const isCharging = state === "Charging" || state === "Active";
  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "0.8rem",
    fontWeight: "600",
    background: isCharging ? "var(--border-color)" : "var(--bg-app)",
    color: isCharging ? "var(--status-charging)" : "var(--text-muted)",
    transition: "var(--theme-transition)",
  };
};

const detailsButtonStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "6px 12px",
  borderRadius: "6px",
  fontSize: "0.8rem",
  fontWeight: "600",
  color: "var(--text-main)",
  cursor: "pointer",
  transition: "all 0.2s ease, var(--theme-transition)",
};

const illegalBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "0.8rem",
  fontWeight: "600",
  background: "var(--border-color)",
  color: "var(--status-offline)",
  marginLeft: "8px",
  transition: "var(--theme-transition)",
};
