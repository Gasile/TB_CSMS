import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { unassignAndBlockBadge } from "../../../api/adminApi";
import {
  fetchUserBadges,
  linkNewBadge,
  updateMyBadgeName,
} from "../../../api/userApi";

export default function MyBadges() {
  const { user } = useAuth();
  const userId = user?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [badges, setBadges] = useState<any[]>([]);

  // --- ÉTATS DE RECHERCHE ET FILTRES ---
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortConfig, setSortConfig] = useState({
    key: "badge_name",
    direction: "asc",
  });

  // --- ÉTATS POUR LA MODALE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<any>(null); // null = Mode Création
  const [formData, setFormData] = useState({
    idToken: "",
    badge_name: "",
  });

  useEffect(() => {
    if (userId) loadBadges();
  }, [userId]);

  const loadBadges = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUserBadges(userId!);

      // On "aplatit" les données pour faciliter le tri et l'affichage
      const flatBadges = (data || []).map((ub: any) => ({
        linkId: ub.id,
        authId: ub.Authorization.id,
        idToken: ub.Authorization.idToken,
        badge_name: ub.Authorization.badge_name,
        status: ub.Authorization.status,
      }));

      setBadges(flatBadges);
    } catch (error) {
      console.error("Erreur de chargement des badges:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- FILTRAGE ET TRI ---
  let filteredBadges = [...badges];

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
        b.idToken.toLowerCase().includes(lowerSearch),
    );
  }

  filteredBadges.sort((a: any, b: any) => {
    let valA = a[sortConfig.key]?.toString().toLowerCase() || "";
    let valB = b[sortConfig.key]?.toString().toLowerCase() || "";

    if (sortConfig.direction === "asc") {
      return valA.localeCompare(valB, "fr");
    } else {
      return valB.localeCompare(valA, "fr");
    }
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

  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key)
      return <span style={{ opacity: 0.3, marginLeft: "4px" }}>↕</span>;
    return (
      <span style={{ marginLeft: "4px" }}>
        {sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  // --- ACTIONS ---
  const openCreateModal = () => {
    setEditingBadge(null);
    setFormData({ idToken: "", badge_name: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (badge: any) => {
    setEditingBadge(badge);
    setFormData({ idToken: badge.idToken, badge_name: badge.badge_name });
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingBadge) {
        // Mode Édition : L'utilisateur ne peut modifier que le nom de son badge
        await updateMyBadgeName(editingBadge.authId, formData.badge_name);
      } else {
        // Mode Création : L'utilisateur associe un nouveau badge
        await linkNewBadge(userId!, formData.idToken, formData.badge_name);
      }
      setIsModalOpen(false);
      loadBadges();
    } catch (err: any) {
      console.error("Erreur :", err);
      alert(err.message || "Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveBadge = async (linkId: number, authId: number) => {
    if (
      window.confirm(
        "Voulez-vous vraiment retirer ce badge ? Il sera automatiquement bloqué.",
      )
    ) {
      setIsLoading(true);
      try {
        await unassignAndBlockBadge(linkId, authId);
        setIsModalOpen(false);
        loadBadges();
      } catch (err: any) {
        alert(err.message || "Erreur lors de la suppression.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (isLoading && badges.length === 0)
    return <div style={{ padding: "30px" }}>Chargement de vos badges...</div>;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#1f2937" }}>
            Mes Badges
          </h1>
          <p
            style={{
              margin: "5px 0 0 0",
              color: "#6b7280",
              fontSize: "0.95rem",
            }}
          >
            Gérez vos cartes RFID et moyens d'accès à la recharge.
          </p>
        </div>
        <button onClick={openCreateModal} style={createButtonStyle}>
          + Ajouter un badge
        </button>
      </div>

      {/* --- BARRE DE FILTRES --- */}
      <div style={filterBarContainerStyle}>
        <input
          type="text"
          placeholder="Rechercher par nom ou token..."
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

      {/* --- TABLEAU --- */}
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
              <th style={sortableThStyle} onClick={() => handleSort("status")}>
                Statut {getSortIndicator("status")}
              </th>
              <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBadges.map((badge: any) => (
              <tr
                key={badge.authId}
                style={{ borderBottom: "1px solid #f3f4f6" }}
              >
                <td style={tdStyle}>
                  <strong>{badge.badge_name}</strong>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontFamily: "monospace", color: "#6b7280" }}>
                    {badge.idToken}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={statusBadgeStyle(badge.status)}>
                    {badge.status}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <button
                    onClick={() => openEditModal(badge)}
                    style={editButtonStyle}
                  >
                    Éditer
                  </button>
                </td>
              </tr>
            ))}
            {filteredBadges.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    textAlign: "center",
                    padding: "30px",
                    color: "#6b7280",
                  }}
                >
                  Aucun badge trouvé.
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
              {editingBadge ? "Modifier le badge" : "Associer un badge"}
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
                  placeholder="Ex: Clé de voiture"
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
                  disabled={!!editingBadge} // Grisé en mode édition, on ne modifie que le nom
                  style={{
                    ...inputStyle,
                    background: editingBadge ? "#f3f4f6" : "#fff",
                    cursor: editingBadge ? "not-allowed" : "text",
                  }}
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
                {editingBadge && (
                  <button
                    type="button"
                    onClick={() =>
                      handleRemoveBadge(
                        editingBadge.linkId,
                        editingBadge.authId,
                      )
                    }
                    style={deleteButtonStyle}
                  >
                    Retirer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={cancelButtonStyle}
                >
                  Annuler
                </button>
                <button type="submit" style={createButtonStyle}>
                  {editingBadge ? "Enregistrer" : "Associer"}
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
const sortableThStyle: React.CSSProperties = { ...thStyle, cursor: "pointer" };
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
