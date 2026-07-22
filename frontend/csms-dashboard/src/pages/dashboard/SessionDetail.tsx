// ============================================================================
// IMPORTS
// ============================================================================

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fetchSessionDetailData } from "../../api/sessionApi";
import { useAuth } from "../../context/AuthContext";
import { Icon } from "../../components/ui/Icon";

// ============================================================================
// CONFIGURATION Constants
// ============================================================================

const EVENTS_PER_PAGE = 15;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Renders the comprehensive details of a specific charging session, including metrics, telemetry charts, and technical event logs.
 */
export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dbId = Number(id);

  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  // Data & UI loading states
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  // Pagination state for the technical events journal
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (dbId) loadData();
  }, [dbId]);

  /**
   * Loads the transaction details and historical meter values from the database backend.
   */
  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSessionDetailData(dbId);
      if (data && data.Transactions && data.Transactions.length > 0) {
        const tx = data.Transactions[0];
        setSession(tx);
        buildChartData(tx, data.MeterValues || []);
      }
    } catch (error) {
      console.error("Erreur de chargement :", error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Structures active power (kW) and battery State of Charge (SoC) points into a chronological timeline for the chart.
   */
  const buildChartData = (tx: any, meterValues: any[]) => {
    const points: any[] = [];
    let lastPowerTime: number | null = null;
    let lastPowerValue = 0;

    // Push initial baseline time-point
    if (tx.startTime) {
      points.push({
        time: new Date(tx.startTime).getTime(),
        power: 0,
        soc: null,
      });
    }

    // Process and extract measurand indicators (Active Power Import & SoC)
    meterValues.forEach((mv) => {
      let powerKW = 0;
      let socValue = null;
      let hasPowerData = false;

      try {
        const parsed =
          typeof mv.sampledValue === "string"
            ? JSON.parse(mv.sampledValue)
            : mv.sampledValue;
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item.measurand === "Power.Active.Import" && !item.phase) {
              powerKW = item.value / 1000;
              hasPowerData = true;
            }
            if (item.measurand === "SoC") {
              socValue = item.value;
            }
          });
        }
      } catch (e) {}

      if (hasPowerData || socValue !== null) {
        const timeMs = new Date(mv.timestamp).getTime();
        points.push({ time: timeMs, power: powerKW, soc: socValue });
        if (hasPowerData) {
          lastPowerTime = timeMs;
          lastPowerValue = powerKW;
        }
      }
    });

    // Handle terminal boundary conditions based on session state (Active vs Finished)
    if (tx.endTime && lastPowerTime) {
      const endMs = new Date(tx.endTime).getTime();
      if (endMs - lastPowerTime > 120000) {
        points.push({ time: lastPowerTime + 120000, power: 0 });
      }
      points.push({ time: endMs, power: 0 });
    } else if (tx.isActive && lastPowerTime) {
      const nowMs = new Date().getTime();
      if (nowMs - lastPowerTime > 120000) {
        points.push({ time: lastPowerTime + 120000, power: 0 });
        points.push({ time: nowMs, power: 0 });
      } else {
        points.push({ time: nowMs, power: lastPowerValue });
      }
    }

    points.sort((a, b) => a.time - b.time);
    setChartData(points);
  };

  /**
   * Prompts the administrator to confirm sending an OCPP hard-stop signal to the remote station.
   */
  const handleForceStop = () => {
    if (
      window.confirm(
        "Voulez-vous vraiment forcer l'arrêt de cette session à distance ?",
      )
    ) {
      alert("Fonctionnalité de forçage OCPP en cours de développement.");
    }
  };

  if (isLoading)
    return (
      <div style={{ padding: "30px", color: "var(--text-main)" }}>
        Chargement des données de la session...
      </div>
    );
  if (!session)
    return (
      <div style={{ padding: "30px", color: "var(--status-offline)" }}>
        Session introuvable.
      </div>
    );

  const startDate = new Date(session.startTime);
  const endDate = session.endTime ? new Date(session.endTime) : null;

  /**
   * Converts the start and end dates of a charging session into a user-friendly duration format.
   */
  const formatDuration = (start: Date, end: Date | null): string => {
    if (!end) return "En cours";
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return "00:00:00";

    const totalSeconds = Math.floor(diffMs / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const totalHours = Math.floor(totalMinutes / 60);
    const hours = totalHours % 24;
    const days = Math.floor(totalHours / 24);
    const pad = (num: number) => String(num).padStart(2, "0");

    if (days > 0)
      return `${days}j ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const durationStr = formatDuration(startDate, endDate);

  /**
   * Computes the elapsed duration spent waiting at the station without charging.
   */
  const calculateOvertime = (timestamp: string) => {
    if (!timestamp) return "un temps indéterminé";
    const start = new Date(timestamp).getTime();
    const now = new Date().getTime();
    const diffMs = Math.max(0, now - start);

    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours > 0) return `${hours}h et ${mins}min`;
    return `${mins} min`;
  };

  // --- EVENTS PAGINATION LOGIC ---
  const events = session.TransactionEvents || [];
  const totalPages = Math.ceil(events.length / EVENTS_PER_PAGE);
  const paginatedEvents = events.slice(
    (currentPage - 1) * EVENTS_PER_PAGE,
    currentPage * EVENTS_PER_PAGE,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
      {/* Overview Details Section */}
      <div style={headerCardStyle}>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <button onClick={() => navigate(-1)} style={backButtonStyle}>
            <Icon name="arrow_back" style={{ fontSize: "1.1rem" }} /> Retour
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.6rem",
                  color: "var(--text-main)",
                  transition: "var(--theme-transition)",
                }}
              >
                Session #{session.transactionId || session.id}
              </h1>
              <span
                style={statusBadgeStyle(session.chargingState || "Finished")}
              >
                {session.isActive
                  ? "En charge"
                  : session.chargingState || "Terminé"}
              </span>
            </div>
            <p
              style={{
                margin: "5px 0 0 0",
                color: "var(--text-muted)",
                transition: "var(--theme-transition)",
              }}
            >
              Borne :{" "}
              <strong>
                {session.ChargingStation?.chargePointModel
                  ? `${session.ChargingStation.chargePointModel} `
                  : ""}
                {session.ocppConnectionName}
              </strong>{" "}
              (Connecteur{" "}
              {session.Connector?.connectorId || session.connectorId}) •{" "}
              {startDate.toLocaleDateString()}
            </p>
          </div>
        </div>

        {isAdmin && session.isActive && (
          <button onClick={handleForceStop} style={forceStopButtonStyle}>
            <Icon name="stop_circle" style={{ fontSize: "1.1rem" }} /> Forcer
            l'arrêt
          </button>
        )}
      </div>

      {/* Warning Area for Parking Misuse */}
      {session.isActive && session.is_legal === false && (
        <div style={illegalAlertStyle}>
          <Icon
            name="warning"
            style={{ fontSize: "1.8rem", marginRight: "15px" }}
          />
          <div>
            <strong style={{ fontSize: "1.05rem" }}>
              Action requise : Session marquée comme illégale.
            </strong>
            <div
              style={{
                marginTop: "4px",
                fontSize: "0.95rem",
                color: "var(--status-offline)",
                transition: "var(--theme-transition)",
              }}
            >
              Le véhicule occupe la borne sans charger depuis{" "}
              <strong>
                {calculateOvertime(session.overtime_start_timestamp)}
              </strong>
              .
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "20px",
        }}
      >
        <div style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Énergie Délivrée</span>
          <span style={kpiValueStyle}>
            {session.totalKwh ? session.totalKwh.toFixed(2) : "0.00"}{" "}
            <small style={{ fontSize: "1rem" }}>kWh</small>
          </span>
        </div>
        <div style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Coût Estimé</span>
          <span style={kpiValueStyle}>
            0.00 <small style={{ fontSize: "1rem" }}>CHF</small>
          </span>
        </div>
        <div style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Durée</span>
          <span style={kpiValueStyle}>{durationStr}</span>
        </div>
        <div style={kpiCardStyle}>
          <span style={kpiLabelStyle}>Badge Utilisé</span>
          <span
            style={{
              fontSize: "1.1rem",
              fontWeight: "bold",
              color: "var(--text-main)",
              marginTop: "5px",
              transition: "var(--theme-transition)",
            }}
          >
            {session.Authorization?.badge_name || "Inconnu"}
          </span>
          <span
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              fontFamily: "monospace",
              transition: "var(--theme-transition)",
            }}
          >
            {session.Authorization?.idToken || "N/A"}
          </span>
        </div>
      </div>

      {/* Telemetry Chart Section */}
      <div style={chartCardStyle}>
        <h2
          style={{
            margin: "0 0 20px 0",
            fontSize: "1.2rem",
            color: "var(--text-main)",
            transition: "var(--theme-transition)",
          }}
        >
          Courbe de Puissance & Batterie
        </h2>
        <div style={{ height: "350px", width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border-color)"
              />
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(unixTime) => {
                  const d = new Date(unixTime);
                  const day = d.getDate().toString().padStart(2, "0");
                  const month = (d.getMonth() + 1).toString().padStart(2, "0");
                  const time = d.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return `${day}/${month} ${time}`;
                }}
                stroke="var(--text-muted)"
                fontSize={11}
                tickMargin={10}
              />
              <YAxis
                yAxisId="left"
                width={50}
                tickFormatter={(val) => `${val} kW`}
                stroke="var(--text-muted)"
                fontSize={12}
              />
              <YAxis
                yAxisId="right"
                width={40}
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
                stroke="var(--text-muted)"
                fontSize={12}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-card)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-main)",
                }}
                labelFormatter={(label) => {
                  const d = new Date(label);
                  return `${d.toLocaleDateString()} à ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                }}
                formatter={(value: any, name: any) => [
                  String(name) === "power"
                    ? `${Number(value ?? 0).toFixed(2)} kW`
                    : `${value}%`,
                  String(name) === "power" ? "Puissance" : "Batterie",
                ]}
              />
              <Area
                yAxisId="left"
                type="stepAfter"
                dataKey="power"
                stroke="var(--status-available)"
                fill="rgba(14, 165, 233, 0.15)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="soc"
                stroke="var(--primary)"
                strokeWidth={3}
                dot={false}
                connectNulls={true}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Admin exclusive Technical Event Journal Section */}
      {isAdmin && (
        <div style={{ ...chartCardStyle, padding: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "25px",
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
              Journal Technique (Admin)
            </h2>
            <span
              style={{
                fontSize: "0.85rem",
                background: "var(--bg-app)",
                border: "1px solid var(--border-color)",
                color: "var(--text-main)",
                padding: "4px 10px",
                borderRadius: "6px",
                transition: "var(--theme-transition)",
              }}
            >
              Raison d'arrêt finale :{" "}
              <strong>{session.stoppedReason || "N/A"}</strong>
            </span>
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
                <tr style={{ borderBottom: "2px solid var(--border-color)" }}>
                  <th style={thStyle}>Horodatage</th>
                  <th style={thStyle}>Type d'Événement</th>
                  <th style={thStyle}>Déclencheur</th>
                  <th style={thStyle}>État / Infos</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        textAlign: "center",
                        padding: "40px 20px",
                        color: "var(--text-muted)",
                        transition: "var(--theme-transition)",
                      }}
                    >
                      <div style={{ marginBottom: "10px" }}>
                        <Icon name="inbox" style={{ fontSize: "2.5rem" }} />
                      </div>
                      <strong
                        style={{ color: "var(--text-main)", fontSize: "1rem" }}
                      >
                        Journal technique non disponible
                      </strong>
                      <p
                        style={{
                          margin: "5px 0 0 0",
                          fontSize: "0.9rem",
                          lineHeight: "1.4",
                        }}
                      >
                        Le suivi détaillé par événements est une fonctionnalité
                        native d'OCPP 2.0.1+.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedEvents.map((event: any, idx: number) => {
                    const timeStr = new Date(
                      event.timestamp,
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });
                    let infoStr = "";
                    try {
                      const parsed =
                        typeof event.transactionInfo === "string"
                          ? JSON.parse(event.transactionInfo)
                          : event.transactionInfo;
                      infoStr = parsed?.chargingState
                        ? `Statut: ${parsed.chargingState}`
                        : "";
                      if (parsed?.stoppedReason)
                        infoStr += ` | Motif: ${parsed.stoppedReason}`;
                    } catch (e) {}

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid var(--border-color)",
                          transition: "var(--theme-transition)",
                        }}
                      >
                        <td style={{ ...tdStyle, color: "var(--text-muted)" }}>
                          {timeStr}
                        </td>
                        <td style={tdStyle}>
                          <strong>{event.eventType}</strong>
                        </td>
                        <td style={tdStyle}>
                          <span style={badgeSmallStyle}>
                            {event.triggerReason}
                          </span>
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            fontFamily: "monospace",
                            fontSize: "0.85rem",
                          }}
                        >
                          {infoStr}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Block */}
          {totalPages > 1 && (
            <div style={paginationContainerStyle}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={paginationButtonStyle(currentPage === 1)}
              >
                Précédent
              </button>
              <span style={paginationTextStyle}>
                Page {currentPage} sur {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                style={paginationButtonStyle(currentPage === totalPages)}
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STYLES & LAYOUTS (INLINE CSS VARIABLES ADAPTATION)
// ============================================================================

const headerCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  padding: "25px",
  borderRadius: "12px",
  border: "1px solid var(--border-color)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "20px",
  transition: "var(--theme-transition)",
};

const backButtonStyle: React.CSSProperties = {
  background: "var(--bg-app)",
  border: "1px solid var(--border-color)",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const forceStopButtonStyle: React.CSSProperties = {
  background: "rgba(239, 68, 68, 0.15)",
  border: "1px solid var(--status-offline)",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "var(--status-offline)",
  transition: "var(--theme-transition)",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const statusBadgeStyle = (status: string): React.CSSProperties => {
  const isCharging =
    status === "Charging" || status === "EVConnected" || status === "En charge";
  return {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "0.85rem",
    fontWeight: "600",
    background: isCharging ? "rgba(16, 185, 129, 0.15)" : "var(--bg-app)",
    color: isCharging ? "var(--status-charging)" : "var(--text-muted)",
    transition: "var(--theme-transition)",
  };
};

const kpiCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  padding: "20px",
  borderRadius: "12px",
  border: "1px solid var(--border-color)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  transition: "var(--theme-transition)",
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  fontWeight: "600",
  letterSpacing: "0.05em",
  marginBottom: "5px",
  transition: "var(--theme-transition)",
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: "1.8rem",
  fontWeight: "bold",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};

const chartCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  padding: "25px",
  borderRadius: "12px",
  border: "1px solid var(--border-color)",
  transition: "var(--theme-transition)",
};

const thStyle: React.CSSProperties = {
  padding: "15px 20px",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  transition: "var(--theme-transition)",
};

const tdStyle: React.CSSProperties = {
  padding: "15px 20px",
  fontSize: "0.95rem",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};

const badgeSmallStyle: React.CSSProperties = {
  background: "var(--bg-app)",
  border: "1px solid var(--border-color)",
  color: "var(--status-available)",
  padding: "3px 8px",
  borderRadius: "6px",
  fontSize: "0.8rem",
  fontWeight: "600",
  transition: "var(--theme-transition)",
};

const illegalAlertStyle: React.CSSProperties = {
  background: "rgba(239, 68, 68, 0.15)",
  border: "1px solid var(--status-offline)",
  color: "var(--status-offline)",
  padding: "15px 20px",
  borderRadius: "12px",
  display: "flex",
  alignItems: "center",
  boxShadow: "0 2px 10px rgba(220, 38, 38, 0.05)",
  transition: "var(--theme-transition)",
};

const paginationContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "15px 20px",
  borderTop: "1px solid var(--border-color)",
  background: "var(--bg-app)",
  borderBottomLeftRadius: "12px",
  borderBottomRightRadius: "12px",
  transition: "var(--theme-transition)",
};

const paginationButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "6px 12px",
  borderRadius: "6px",
  border: "1px solid var(--border-color)",
  background: disabled ? "transparent" : "var(--bg-card)",
  color: disabled ? "var(--text-muted)" : "var(--text-main)",
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: "0.85rem",
  fontWeight: "600",
  transition: "var(--theme-transition)",
  opacity: disabled ? 0.5 : 1,
});

const paginationTextStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "var(--text-muted)",
  fontWeight: "500",
  transition: "var(--theme-transition)",
};
