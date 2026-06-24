import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchUserById, unassignAndBlockBadge } from "../../../api/adminApi";
import {
  fetchUserBadges,
  fetchUserSessions,
  linkNewBadge,
} from "../../../api/userApi";

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = Number(id);

  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  // Modale d'assignation de badge
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [badgeForm, setBadgeForm] = useState({ idToken: "", badgeName: "" });

  // --- ÉTAT DU TRI ---
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "startTime",
    direction: "desc", // Par défaut, la plus récente en premier
  });

  useEffect(() => {
    if (userId) {
      loadAllData();
    }
  }, [userId]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [userData, badgesData, sessionsData] = await Promise.all([
        fetchUserById(userId),
        fetchUserBadges(userId),
        fetchUserSessions(userId),
      ]);
      setUser(userData);
      setBadges(badgesData || []);
      setSessions(sessionsData || []);
    } catch (error) {
      console.error("Erreur lors du chargement du dossier :", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- ACTIONS BADGES ---
  const handleUnlinkBadge = async (ubId: number, authId: number) => {
    if (
      window.confirm(
        "Voulez-vous vraiment retirer ce badge ? Il sera automatiquement bloqué.",
      )
    ) {
      await unassignAndBlockBadge(ubId, authId);
      loadAllData();
    }
  };

  const handleLinkBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await linkNewBadge(userId, badgeForm.idToken, badgeForm.badgeName);
      setIsModalOpen(false);
      setBadgeForm({ idToken: "", badgeName: "" });
      loadAllData();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'assignation du badge.");
    }
  };

  // --- LOGIQUE DE TRI ---
  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"; // Inverse le tri si on reclique sur la même colonne
    }
    setSortConfig({ key, direction });
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];

    // Cas particulier : on veut trier correctement le statut "En cours"
    if (sortConfig.key === "status") {
      valA = a.isActive ? "0_En_cours" : a.chargingState || "Terminé";
      valB = b.isActive ? "0_En_cours" : b.chargingState || "Terminé";
    }

    // Sécurité contre les valeurs nulles
    if (valA == null) valA = "";
    if (valB == null) valB = "";

    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Petit Helper pour afficher les flèches (↑, ↓, ↕)
  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key)
      return <span style={{ opacity: 0.3, marginLeft: "4px" }}>↕</span>;
    return (
      <span style={{ marginLeft: "4px" }}>
        {sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  if (isLoading && !user)
    return <div style={{ padding: "30px" }}>Chargement du dossier...</div>;
  if (!user)
    return (
      <div style={{ padding: "30px", color: "red" }}>
        Utilisateur introuvable.
      </div>
    );

  // Calculs rapides
  const totalKwh = sessions.reduce((sum, s) => sum + (s.totalKwh || 0), 0);
  const activeSessions = sessions.filter((s) => s.isActive);

  return (
    <div style={containerStyle}>
      {/* --- EN-TÊTE : BOUTON RETOUR ET INFOS --- */}
      <div style={headerCardStyle}>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <button
            onClick={() => navigate("/admin-users")}
            style={backButtonStyle}
          >
            ← Retour
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#1f2937" }}>
              {user.first_name} {user.last_name}
            </h1>
            <p style={{ margin: "5px 0 0 0", color: "#6b7280" }}>
              {user.email} •{" "}
              <span style={roleBadgeStyle(user.role)}>{user.role}</span>
            </p>
          </div>
        </div>

        {/* Petit résumé (KPIs) */}
        <div style={{ display: "flex", gap: "30px" }}>
          <div style={kpiStyle}>
            <span style={kpiLabelStyle}>Énergie totale</span>
            <span style={kpiValueStyle}>
              {totalKwh.toFixed(1)}{" "}
              <small style={{ fontSize: "1rem" }}>kWh</small>
            </span>
          </div>
          <div style={kpiStyle}>
            <span style={kpiLabelStyle}>Sessions de charge</span>
            <span style={kpiValueStyle}>{sessions.length}</span>
          </div>
        </div>
      </div>

      <div style={gridStyle}>
        {/* --- COLONNE GAUCHE (span 2) : L'HISTORIQUE DES SESSIONS --- */}
        <div style={{ ...cardStyle, gridColumn: "span 2" }}>
          <h2 style={{ ...sectionTitleStyle, marginBottom: "20px" }}>
            Historique des sessions
          </h2>

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
                  <th
                    style={sortableThStyle}
                    onClick={() => handleSort("startTime")}
                  >
                    Date & Transaction {getSortIndicator("startTime")}
                  </th>
                  <th
                    style={sortableThStyle}
                    onClick={() => handleSort("ocppConnectionName")}
                  >
                    Borne {getSortIndicator("ocppConnectionName")}
                  </th>
                  <th
                    style={sortableThStyle}
                    onClick={() => handleSort("status")}
                  >
                    Statut {getSortIndicator("status")}
                  </th>
                  <th
                    style={sortableThStyle}
                    onClick={() => handleSort("totalKwh")}
                  >
                    Énergie {getSortIndicator("totalKwh")}
                  </th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>{" "}
                  {/* <-- NOUVELLE COLONNE */}
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: "center",
                        padding: "20px",
                        color: "#6b7280",
                      }}
                    >
                      Aucune session de charge enregistrée.
                    </td>
                  </tr>
                ) : (
                  sortedSessions.map((s: any) => {
                    // --- EXTRACTION DE LA DATE ---
                    const dateStr = s.startTime
                      ? new Date(s.startTime).toLocaleDateString()
                      : "N/A";

                    return (
                      <tr
                        key={s.id}
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          background: s.isActive ? "#f0fdf4" : "transparent",
                        }}
                      >
                        <td style={tdStyle}>
                          <strong>{dateStr}</strong>
                          <div
                            style={{
                              fontSize: "0.85rem",
                              color: "#6b7280",
                              wordBreak: "break-all",
                            }}
                          >
                            #{s.transactionId || s.id}
                          </div>
                        </td>
                        <td style={tdStyle}>{s.ocppConnectionName}</td>
                        <td style={tdStyle}>
                          <span
                            style={statusBadgeStyle(
                              s.chargingState || "Terminé",
                            )}
                          >
                            {s.isActive
                              ? "En cours"
                              : s.chargingState || "Terminé"}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <strong>
                            {s.totalKwh ? s.totalKwh.toFixed(2) : "0.00"}
                          </strong>{" "}
                          kWh
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <button
                            onClick={() => navigate(`/session/${s.id}`)}
                            style={detailsButtonStyle}
                          >
                            Détails ➔
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* --- COLONNE GAUCHE : LES BADGES --- */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h2 style={sectionTitleStyle}>Badges assignés ({badges.length})</h2>
            <button onClick={() => setIsModalOpen(true)} style={addButtonStyle}>
              + Assigner un badge
            </button>
          </div>

          {badges.length === 0 ? (
            <p
              style={{ color: "#6b7280", textAlign: "center", padding: "20px" }}
            >
              Aucun badge lié à ce compte.
            </p>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {badges.map((b: any) => (
                <div key={b.id} style={badgeListItemStyle}>
                  <div>
                    <strong>{b.Authorization.badge_name}</strong>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "#6b7280",
                        fontFamily: "monospace",
                        marginTop: "4px",
                      }}
                    >
                      {b.Authorization.idToken}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnlinkBadge(b.id, b.Authorization.id)}
                    style={deleteButtonStyle}
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- MODALE D'ASSIGNATION --- */}
      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ marginTop: 0, color: "#1f2937" }}>
              Assigner un Badge
            </h2>
            <p
              style={{
                fontSize: "0.9rem",
                color: "#6b7280",
                marginBottom: "20px",
              }}
            >
              Si le Token existe déjà et est bloqué, il sera réactivé et
              réassigné à cet utilisateur.
            </p>
            <form
              onSubmit={handleLinkBadge}
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <div>
                <label style={labelStyle}>Nom du badge</label>
                <input
                  required
                  style={inputStyle}
                  value={badgeForm.badgeName}
                  onChange={(e) =>
                    setBadgeForm({ ...badgeForm, badgeName: e.target.value })
                  }
                  placeholder="Ex: Clé de voiture"
                />
              </div>
              <div>
                <label style={labelStyle}>ID Token (RFID)</label>
                <input
                  required
                  style={inputStyle}
                  value={badgeForm.idToken}
                  onChange={(e) =>
                    setBadgeForm({ ...badgeForm, idToken: e.target.value })
                  }
                  placeholder="Ex: A1B2C3D4"
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={cancelButtonStyle}
                >
                  Annuler
                </button>
                <button type="submit" style={addButtonStyle}>
                  Assigner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- STYLES ---
const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "25px",
};
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
const roleBadgeStyle = (role: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: "12px",
  fontSize: "0.75rem",
  fontWeight: "600",
  background: role === "Admin" ? "#fef08a" : "#e5e7eb",
  color: role === "Admin" ? "#854d0e" : "#4b5563",
});

const kpiStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
};
const kpiLabelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "#6b7280",
  textTransform: "uppercase",
  fontWeight: "600",
  letterSpacing: "0.05em",
};
const kpiValueStyle: React.CSSProperties = {
  fontSize: "1.8rem",
  fontWeight: "bold",
  color: "#111827",
  lineHeight: "1.2",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "25px",
};
const cardStyle: React.CSSProperties = {
  background: "#fff",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
};
const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.2rem",
  color: "#374151",
};

const badgeListItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "15px",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  background: "#f9fafb",
};
const addButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: "600",
};
const deleteButtonStyle: React.CSSProperties = {
  background: "#fff",
  color: "#dc2626",
  border: "1px solid #fca5a5",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: "600",
};

const thStyle: React.CSSProperties = {
  padding: "12px 10px",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "#6b7280",
  textTransform: "uppercase",
};
const tdStyle: React.CSSProperties = {
  padding: "15px 10px",
  fontSize: "0.95rem",
  color: "#1f2937",
};
const statusBadgeStyle = (status: string): React.CSSProperties => {
  const isCharging = status === "Charging" || status === "Active";
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

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
const modalContentStyle: React.CSSProperties = {
  background: "#fff",
  padding: "30px",
  borderRadius: "12px",
  width: "100%",
  maxWidth: "400px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
};
const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "5px",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "#374151",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #d1d5db",
  fontSize: "0.95rem",
};
const cancelButtonStyle: React.CSSProperties = {
  background: "#fff",
  color: "#4b5563",
  border: "1px solid #d1d5db",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
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

const sortableThStyle: React.CSSProperties = {
  ...thStyle,
  cursor: "pointer",
  userSelect: "none",
};
