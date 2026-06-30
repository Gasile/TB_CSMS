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

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dbId = Number(id);

  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (dbId) loadData();
  }, [dbId]);

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

  // --- TRAITEMENT DU GRAPHIQUE ---
  const buildChartData = (tx: any, meterValues: any[]) => {
    const points: any[] = [];
    let lastPowerTime: number | null = null;
    let lastPowerValue = 0;

    // 1. Point de départ
    if (tx.startTime) {
      points.push({
        time: new Date(tx.startTime).getTime(),
        power: 0,
        soc: null,
      });
    }

    // 2. Traitement des MeterValues
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
            // On cherche la puissance totale (sans propriété 'phase')
            if (item.measurand === "Power.Active.Import" && !item.phase) {
              powerKW = item.value / 1000;
              hasPowerData = true;
            }
            // On cherche l'état de la batterie (SoC)
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

    // 3. Traitement de la fin (Chute à 0 pour inactivité ou fin de session)
    if (tx.endTime && lastPowerTime) {
      const endMs = new Date(tx.endTime).getTime();
      if (endMs - lastPowerTime > 120000) {
        // Si plus de 2 min d'inactivité avant la fin, on met à 0
        points.push({ time: lastPowerTime + 120000, power: 0 });
      }
      points.push({ time: endMs, power: 0 });
    } else if (tx.isActive && lastPowerTime) {
      // Pour une session en cours, on prolonge la dernière valeur jusqu'à "maintenant" (optionnel)
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

  const handleForceStop = () => {
    // Bouton factice pour le moment
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
      <div style={{ padding: "30px" }}>
        Chargement des données de la session...
      </div>
    );
  if (!session)
    return (
      <div style={{ padding: "30px", color: "red" }}>Session introuvable.</div>
    );

  // Calcul du format d'affichage de la date
  const startDate = new Date(session.startTime);
  const endDate = session.endTime ? new Date(session.endTime) : null;
  const durationStr = endDate
    ? new Date(endDate.getTime() - startDate.getTime())
        .toISOString()
        .slice(11, 19)
    : "En cours";

  // Calcul du temps de dépassement
  const calculateOvertime = (timestamp: string) => {
    if (!timestamp) return "un temps indéterminé";
    const start = new Date(timestamp).getTime();
    const now = new Date().getTime();
    const diffMs = Math.max(0, now - start); // Évite les valeurs négatives

    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours > 0) return `${hours}h et ${mins}min`;
    return `${mins} min`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
      {/* --- EN-TÊTE --- */}
      <div style={headerCardStyle}>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <button onClick={() => navigate(-1)} style={backButtonStyle}>
            ← Retour
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 style={{ margin: 0, fontSize: "1.6rem", color: "#1f2937" }}>
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
            <p style={{ margin: "5px 0 0 0", color: "#6b7280" }}>
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

        {/* Actions de l'en-tête (Uniquement Admin et Session Active) */}
        {isAdmin && session.isActive && (
          <button onClick={handleForceStop} style={forceStopButtonStyle}>
            🛑 Forcer l'arrêt
          </button>
        )}
      </div>

      {/* --- ALERTE SESSION ILLÉGALE --- */}
      {session.isActive && session.is_legal === false && (
        <div style={illegalAlertStyle}>
          <span style={{ fontSize: "1.5rem", marginRight: "15px" }}>⚠️</span>
          <div>
            <strong style={{ fontSize: "1.05rem" }}>
              Action requise : Session marquée comme illégale.
            </strong>
            <div
              style={{
                marginTop: "4px",
                fontSize: "0.95rem",
                color: "#b91c1c",
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

      {/* --- KPIs --- */}
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
              color: "#111827",
              marginTop: "5px",
            }}
          >
            {session.Authorization?.badge_name || "Inconnu"}
          </span>
          <span
            style={{
              fontSize: "0.85rem",
              color: "#6b7280",
              fontFamily: "monospace",
            }}
          >
            {session.Authorization?.idToken || "N/A"}
          </span>
        </div>
      </div>

      {/* --- GRAPHIQUE PRINCIPAL (kW + SoC) --- */}
      <div style={chartCardStyle}>
        <h2
          style={{ margin: "0 0 20px 0", fontSize: "1.2rem", color: "#374151" }}
        >
          Courbe de Puissance & Batterie
        </h2>
        <div style={{ height: "350px", width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />

              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(unixTime) =>
                  new Date(unixTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                }
                stroke="#9ca3af"
                fontSize={12}
                tickMargin={10}
              />

              {/* Axe Y de Gauche (Puissance en kW) */}
              <YAxis
                yAxisId="left"
                tickFormatter={(val) => `${val} kW`}
                stroke="#9ca3af"
                fontSize={12}
              />

              {/* Axe Y de Droite (Batterie en %) */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
                stroke="#9ca3af"
                fontSize={12}
              />

              <Tooltip
                labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                formatter={(value: any, name: string) => [
                  name === "power"
                    ? `${Number(value).toFixed(2)} kW`
                    : `${value}%`,
                  name === "power" ? "Puissance" : "Batterie",
                ]}
              />

              {/* Courbe en escalier pour la puissance */}
              <Area
                yAxisId="left"
                type="stepAfter"
                dataKey="power"
                stroke="#3b82f6"
                fill="#dbeafe"
                strokeWidth={2}
                isAnimationActive={false}
              />

              {/* Ligne lissée pour la batterie (Ne s'affiche que s'il y a des données 'soc') */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="soc"
                stroke="#10b981"
                strokeWidth={3}
                dot={false}
                connectNulls={true}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* --- SECTION ADMIN : JOURNAL TECHNIQUE --- */}
      {isAdmin && (
        <div style={chartCardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#374151" }}>
              Journal Technique (Admin)
            </h2>
            <span
              style={{
                fontSize: "0.85rem",
                background: "#f3f4f6",
                padding: "4px 10px",
                borderRadius: "6px",
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
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={thStyle}>Horodatage</th>
                  <th style={thStyle}>Type d'Événement</th>
                  <th style={thStyle}>Déclencheur</th>
                  <th style={thStyle}>État / Infos</th>
                </tr>
              </thead>
              <tbody>
                {(session.TransactionEvents || []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        ...tdStyle,
                        textAlign: "center",
                        padding: "40px 20px",
                        color: "#6b7280",
                      }}
                    >
                      <div style={{ fontSize: "2rem", marginBottom: "10px" }}>
                        📭
                      </div>
                      <strong style={{ color: "#374151", fontSize: "1rem" }}>
                        Journal technique non disponible
                      </strong>
                      <p
                        style={{
                          margin: "5px 0 0 0",
                          fontSize: "0.9rem",
                          lineHeight: "1.4",
                        }}
                      >
                        Le suivi détaillé par événements (TransactionEvents) est
                        une fonctionnalité native du protocole{" "}
                        <strong>OCPP 2.0.1+</strong>.<br />
                        Pour les bornes utilisant <strong>OCPP 1.6</strong>, le
                        diagnostic s'effectue via les informations de l'en-tête
                        et la courbe de puissance ci-dessus.
                      </p>
                    </td>
                  </tr>
                ) : (
                  (session.TransactionEvents || []).map(
                    (event: any, idx: number) => {
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
                          style={{ borderBottom: "1px solid #f3f4f6" }}
                        >
                          <td style={{ ...tdStyle, color: "#6b7280" }}>
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
                    },
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// --- STYLES ---
const headerCardStyle: React.CSSProperties = {
  background: "#fff",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "20px",
};
const backButtonStyle: React.CSSProperties = {
  background: "#f3f4f6",
  border: "1px solid #d1d5db",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "#4b5563",
};
const forceStopButtonStyle: React.CSSProperties = {
  background: "#fee2e2",
  border: "1px solid #fca5a5",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "#dc2626",
};

const statusBadgeStyle = (status: string): React.CSSProperties => {
  const isCharging = status === "Charging" || status === "EVConnected";
  return {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "0.85rem",
    fontWeight: "600",
    background: isCharging ? "#dcfce7" : "#f3f4f6",
    color: isCharging ? "#16a34a" : "#4b5563",
  };
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
const kpiLabelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#6b7280",
  textTransform: "uppercase",
  fontWeight: "600",
  letterSpacing: "0.05em",
  marginBottom: "5px",
};
const kpiValueStyle: React.CSSProperties = {
  fontSize: "1.8rem",
  fontWeight: "bold",
  color: "#111827",
};

const chartCardStyle: React.CSSProperties = {
  background: "#fff",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
};

const thStyle: React.CSSProperties = {
  padding: "12px 10px",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "#6b7280",
  textTransform: "uppercase",
};
const tdStyle: React.CSSProperties = {
  padding: "12px 10px",
  fontSize: "0.95rem",
  color: "#1f2937",
};
const badgeSmallStyle: React.CSSProperties = {
  background: "#e0e7ff",
  color: "#4338ca",
  padding: "3px 8px",
  borderRadius: "6px",
  fontSize: "0.8rem",
  fontWeight: "600",
};

const illegalAlertStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  padding: "15px 20px",
  borderRadius: "12px",
  display: "flex",
  alignItems: "center",
  boxShadow: "0 2px 10px rgba(220, 38, 38, 0.05)",
};
