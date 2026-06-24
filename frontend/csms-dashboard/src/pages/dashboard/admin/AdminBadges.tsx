import React, { useEffect, useState } from "react";
import {
  fetchAdminBadgesData,
  updateBadgeStatus,
  adminCreateBadge,
  updateBadgeDetails,
  assignBadge,
  reassignBadge,
  unassignAndBlockBadge,
  deleteBadge,
} from "../../../api/adminApi";

import { useNavigate } from "react-router-dom";

export default function AdminBadges() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>({
    Authorizations: [],
    Users: [],
    UserBadges: [],
  });

  // États de recherche et de filtres
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortConfig, setSortConfig] = useState({
    key: "badge_name",
    direction: "asc",
  });

  // États pour la Modale (Création & Édition)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<any>(null); // null = Mode Création
  const [formData, setFormData] = useState({
    idToken: "",
    badge_name: "",
    status: "Accepted",
    user_id: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetchAdminBadgesData();
      setData(res);
    } catch (error) {
      console.error("Erreur de chargement des badges:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 1. MAPPAGE DES DONNÉES ---
  // On croise les Authorizations avec UserBadges pour avoir le propriétaire sur chaque ligne
  const enrichedBadges = (data.Authorizations || []).map((auth: any) => {
    const userBadge = (data.UserBadges || []).find(
      (ub: any) => ub.authorization_id === auth.id,
    );
    return {
      ...auth,
      ownerName:
        userBadge && userBadge.User
          ? `${userBadge.User.first_name} ${userBadge.User.last_name}`
          : "Non assigné",
      userBadgeId: userBadge ? userBadge.id : null,
      userId: userBadge && userBadge.User ? userBadge.User.id : null,
    };
  });

  // --- 2. FILTRAGE ET TRI ---
  let filteredBadges = enrichedBadges;

  if (statusFilter !== "All") {
    filteredBadges = filteredBadges.filter(
      (b: any) => b.status === statusFilter,
    );
  }

  if (searchTerm) {
    const lowerSearch = searchTerm.toLowerCase();
    filteredBadges = filteredBadges.filter(
      (b: any) =>
        b.badge_name.toLowerCase().includes(lowerSearch) ||
        b.idToken.toLowerCase().includes(lowerSearch) ||
        b.ownerName.toLowerCase().includes(lowerSearch),
    );
  }

  filteredBadges.sort((a: any, b: any) => {
    let valA = a[sortConfig.key]?.toString().toLowerCase() || "";
    let valB = b[sortConfig.key]?.toString().toLowerCase() || "";
    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "asc"
          ? "desc"
          : "asc",
    });
  };

  // --- 3. ACTIONS ---
  const handleToggleStatus = async (badge: any) => {
    // RÈGLE MÉTIER : On bloque l'activation si pas de propriétaire
    if (badge.status === "Blocked" && !badge.userId) {
      alert(
        "Action impossible : Un badge sans propriétaire ne peut pas être activé. Veuillez d'abord lui assigner un utilisateur.",
      );
      return;
    }

    await updateBadgeStatus(badge.id, badge.status);
    loadData();
  };

  const handleDeleteBadge = async (authId: number) => {
    if (
      window.confirm(
        "Êtes-vous sûr de vouloir supprimer définitivement ce badge ?",
      )
    ) {
      setIsLoading(true);
      try {
        await deleteBadge(authId);
        setIsModalOpen(false); // On ferme la modale si elle était ouverte
        loadData();
      } catch (err: any) {
        console.error("Erreur lors de la suppression :", err);
        // Affiche le message clair qu'on vient de créer dans l'API
        alert(err.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const openCreateModal = () => {
    setEditingBadge(null);
    setFormData({
      idToken: "",
      badge_name: "",
      status: "Accepted",
      user_id: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (badge: any) => {
    setEditingBadge(badge);
    setFormData({
      idToken: badge.idToken,
      badge_name: badge.badge_name,
      status: badge.status,
      user_id: badge.userId ? badge.userId.toString() : "",
    });
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // RÈGLE MÉTIER : Statut forcé à Blocked si pas de user
      const finalStatus = formData.user_id ? formData.status : "Blocked";

      if (editingBadge) {
        // --- MODE ÉDITION ---
        await updateBadgeDetails(
          editingBadge.id,
          formData.idToken,
          formData.badge_name,
        );

        const newUserId = formData.user_id ? parseInt(formData.user_id) : null;
        if (newUserId !== editingBadge.userId) {
          if (editingBadge.userBadgeId && newUserId) {
            await reassignBadge(editingBadge.userBadgeId, newUserId);
          } else if (!editingBadge.userBadgeId && newUserId) {
            await assignBadge(editingBadge.id, newUserId);
          } else if (editingBadge.userBadgeId && !newUserId) {
            // Le badge perd son propriétaire : on supprime le lien ET on le bloque dans la base !
            await unassignAndBlockBadge(
              editingBadge.userBadgeId,
              editingBadge.id,
            );
          }
        }
      } else {
        // --- MODE CRÉATION ---
        const res = await adminCreateBadge(
          formData.idToken,
          formData.badge_name,
          finalStatus,
        );
        const newAuthId = res.insert_Authorizations_one.id;

        if (formData.user_id) {
          await assignBadge(newAuthId, parseInt(formData.user_id));
        }
      }

      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error("Erreur lors de la sauvegarde :", err);
      alert("Une erreur est survenue lors de la sauvegarde.");
    } finally {
      setIsLoading(false);
    }
  };

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

  if (isLoading && data.Authorizations.length === 0)
    return <div style={{ padding: "30px" }}>Chargement des badges...</div>;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#1f2937" }}>
            Gestion des Badges
          </h1>
          <p
            style={{
              margin: "5px 0 0 0",
              color: "#6b7280",
              fontSize: "0.95rem",
            }}
          >
            Administrez les accès RFID de la flotte
          </p>
        </div>
        <button onClick={openCreateModal} style={createButtonStyle}>
          + Nouveau Badge
        </button>
      </div>

      {/* --- BARRE DE FILTRES --- */}
      <div style={filterBarContainerStyle}>
        <input
          type="text"
          placeholder="Rechercher par nom, token ou propriétaire..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={searchInputStyle}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={selectFilterStyle}
        >
          <option value="All">Tous les statuts</option>
          <option value="Accepted">Acceptés uniquement</option>
          <option value="Blocked">Bloqués uniquement</option>
        </select>
      </div>

      {/* --- TABLEAU (Style aligné avec AdminOverview) --- */}
      <div style={tableCardStyle}>
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
                onClick={() => handleSort("badge_name")}
              >
                Nom {getSortIndicator("badge_name")}
              </th>
              <th style={sortableThStyle} onClick={() => handleSort("idToken")}>
                Token {getSortIndicator("idToken")}
              </th>
              <th
                style={sortableThStyle}
                onClick={() => handleSort("ownerName")}
              >
                Propriétaire {getSortIndicator("ownerName")}
              </th>
              <th style={sortableThStyle} onClick={() => handleSort("status")}>
                Statut {getSortIndicator("status")}
              </th>
              <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBadges.map((badge: any) => (
              <tr key={badge.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={tdStyle}>
                  <strong>{badge.badge_name}</strong>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontFamily: "monospace", color: "#6b7280" }}>
                    {badge.idToken}
                  </span>
                </td>
                <td style={tdStyle}>{badge.ownerName}</td>
                <td style={tdStyle}>
                  <span style={statusBadgeStyle(badge.status)}>
                    {badge.status}
                  </span>
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                  }}
                >
                  <button
                    onClick={() => handleToggleStatus(badge)}
                    style={
                      badge.status === "Accepted"
                        ? blockButtonStyle
                        : activateButtonStyle
                    }
                  >
                    {badge.status === "Accepted" ? "Bloquer" : "Activer"}
                  </button>
                  <button
                    onClick={() => openEditModal(badge)}
                    style={editButtonStyle}
                  >
                    Éditer
                  </button>
                  <button
                    onClick={() => navigate(`/admin-badges/${badge.id}`)}
                    style={detailsButtonStyle}
                  >
                    Sessions ➔
                  </button>
                </td>
              </tr>
            ))}
            {filteredBadges.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "center",
                    padding: "30px",
                    color: "#6b7280",
                  }}
                >
                  Aucun badge ne correspond à votre recherche.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- MODALE DE CRÉATION / ÉDITION --- */}
      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ marginTop: 0, color: "#1f2937" }}>
              {editingBadge ? "Éditer le Badge" : "Nouveau Badge"}
            </h2>
            <form
              onSubmit={handleSubmitModal}
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <div>
                <label style={labelStyle}>Nom du badge</label>
                <input
                  required
                  style={inputStyle}
                  value={formData.badge_name}
                  onChange={(e) =>
                    setFormData({ ...formData, badge_name: e.target.value })
                  }
                  placeholder="Ex: Badge Visiteur 1"
                />
              </div>

              <div>
                <label style={labelStyle}>ID Token (NFC/RFID)</label>
                <input
                  required
                  style={inputStyle}
                  value={formData.idToken}
                  onChange={(e) =>
                    setFormData({ ...formData, idToken: e.target.value })
                  }
                  placeholder="Ex: A1B2C3D4"
                />
              </div>

              <div>
                <label style={labelStyle}>Propriétaire</label>
                <select
                  style={inputStyle}
                  value={formData.user_id}
                  onChange={(e) => {
                    const selectedUserId = e.target.value;
                    setFormData({
                      ...formData,
                      user_id: selectedUserId,
                      // RÈGLE MÉTIER : On bascule le statut si l'utilisateur est retiré
                      status: selectedUserId ? formData.status : "Blocked",
                    });
                  }}
                >
                  <option value="">
                    -- Aucun propriétaire (Non assigné) --
                  </option>
                  {(data.Users || []).map((user: any) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {!editingBadge && (
                <div>
                  <label style={labelStyle}>Statut initial</label>
                  <select
                    style={{
                      ...inputStyle,
                      opacity: !formData.user_id ? 0.6 : 1,
                      cursor: !formData.user_id ? "not-allowed" : "pointer",
                    }}
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    disabled={!formData.user_id} // RÈGLE MÉTIER : Désactivé si aucun user
                  >
                    <option value="Accepted">Accepté (Actif)</option>
                    <option value="Blocked">Bloqué</option>
                  </select>
                  {!formData.user_id && (
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "#dc2626",
                        marginTop: "4px",
                        display: "block",
                      }}
                    >
                      * Un badge non assigné est obligatoirement bloqué.
                    </span>
                  )}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <button
                  onClick={() => handleDeleteBadge(editingBadge.id)}
                  style={deleteButtonStyle}
                >
                  Supprimer
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={cancelButtonStyle}
                >
                  Annuler
                </button>
                <button type="submit" style={createButtonStyle}>
                  Sauvegarder
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
const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const filterBarContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "15px",
  alignItems: "center",
};
const searchInputStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 15px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "0.95rem",
};
const selectFilterStyle: React.CSSProperties = {
  padding: "10px 15px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "0.95rem",
  backgroundColor: "#fff",
  cursor: "pointer",
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
  userSelect: "none",
};
const tdStyle: React.CSSProperties = {
  padding: "15px 10px",
  fontSize: "0.95rem",
  color: "#1f2937",
};

const statusBadgeStyle = (status: string): React.CSSProperties => {
  const isAccepted = status === "Accepted";
  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "0.8rem",
    fontWeight: "600",
    background: isAccepted ? "#dcfce7" : "#fee2e2",
    color: isAccepted ? "#16a34a" : "#dc2626",
  };
};

const createButtonStyle: React.CSSProperties = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
};
const editButtonStyle: React.CSSProperties = {
  background: "#f3f4f6",
  color: "#374151",
  border: "1px solid #d1d5db",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: "600",
};
const blockButtonStyle: React.CSSProperties = {
  background: "#fee2e2",
  color: "#dc2626",
  border: "1px solid #fca5a5",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: "600",
};
const activateButtonStyle: React.CSSProperties = {
  background: "#dcfce7",
  color: "#16a34a",
  border: "1px solid #86efac",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: "600",
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

// Styles Modale
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

const deleteButtonStyle: React.CSSProperties = {
  background: "#fff",
  color: "#dc2626",
  border: "1px solid #fca5a5",
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

// NOUVEAU STYLE POUR RENDRE L'EN-TÊTE CLIQUABLE
const sortableThStyle: React.CSSProperties = {
  ...thStyle,
  cursor: "pointer",
  userSelect: "none",
};
