// ============================================================================
// IMPORTS
// ============================================================================

import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { unassignAndBlockBadge } from "../../../api/adminApi";
import {
  fetchUserBadges,
  linkNewBadge,
  updateMyBadgeName,
} from "../../../api/userApi";
import { Icon } from "../../../components/ui/Icon";

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

const BADGES_PER_PAGE = 10;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * End-user workspace view for searching, filtering, adding, or modifying personal RFID cards.
 */
export default function MyBadges() {
  const { user } = useAuth();
  const userId = user?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [badges, setBadges] = useState<any[]>([]);

  // --- SEARCH AND FILTERING STATES ---
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortConfig, setSortConfig] = useState({
    key: "badge_name",
    direction: "asc",
  });

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);

  // --- MODAL & FORM STATES ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<any>(null); // null represents Creation Mode
  const [formData, setFormData] = useState({
    idToken: "",
    badge_name: "",
  });

  useEffect(() => {
    if (userId) loadBadges();
  }, [userId]);

  /**
   * Fetches the badge linkages owned by the user and normalizes the payload layout.
   */
  const loadBadges = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUserBadges(userId!);

      // Flatten nested structures to simplify real-time sorting and conditional displays
      const flatBadges = (data || []).map((ub: any) => ({
        linkId: ub.id,
        authId: ub.Authorization.id,
        idToken: ub.Authorization.idToken,
        badge_name: ub.Authorization.badge_name,
        status: ub.Authorization.status,
      }));

      setBadges(flatBadges);
      setCurrentPage(1);
    } catch (error) {
      console.error("Erreur de chargement des badges:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- FILTERING AND SORTING PIPELINE ---
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

  // --- PAGINATION GRID LIMIT CALCULATIONS ---
  const totalPages = Math.ceil(filteredBadges.length / BADGES_PER_PAGE);
  const paginatedBadges = filteredBadges.slice(
    (currentPage - 1) * BADGES_PER_PAGE,
    currentPage * BADGES_PER_PAGE,
  );

  /**
   * Toggles direction or updates the active object reference key used for sorting columns.
   */
  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "asc"
          ? "desc"
          : "asc",
    });
    setCurrentPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  /**
   * Returns a dynamic indicator flag based on the column sorting configuration.
   */
  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key) {
      return (
        <Icon
          name="swap_vert"
          style={{ opacity: 0.3, fontSize: "1rem", marginLeft: "4px" }}
        />
      );
    }
    return (
      <Icon
        name={
          sortConfig.direction === "asc"
            ? "arrow_upward_alt"
            : "arrow_downward_alt"
        }
        style={{ fontSize: "1rem", marginLeft: "4px" }}
      />
    );
  };

  // --- INTERACTION HANDLERS ---

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

  /**
   * Handles modal submissions, branching into badge renaming or token link registration.
   */
  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingBadge) {
        await updateMyBadgeName(editingBadge.authId, formData.badge_name);
      } else {
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

  /**
   * Removes a badge association and calls the administrative API to block the token.
   */
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
    return (
      <div style={{ padding: "30px", color: "var(--text-main)" }}>
        Chargement de vos badges...
      </div>
    );

  return (
    <div style={containerStyle}>
      {/* Header Info Section */}
      <div style={headerStyle}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "1.8rem",
              color: "var(--text-main)",
              transition: "var(--theme-transition)",
            }}
          >
            Mes Badges
          </h1>
          <p
            style={{
              margin: "5px 0 0 0",
              color: "var(--text-muted)",
              fontSize: "0.95rem",
              transition: "var(--theme-transition)",
            }}
          >
            Gerez vos cartes RFID et moyens d'accès à la recharge.
          </p>
        </div>
        <button onClick={openCreateModal} style={createButtonStyle}>
          + Ajouter un badge
        </button>
      </div>

      {/* --- FILTER & SEARCH CONTROLS SEGMENT --- */}
      <div style={filterBarContainerStyle}>
        <input
          type="text"
          placeholder="Rechercher par nom ou token..."
          value={searchTerm}
          onChange={handleSearchChange}
          style={searchInputStyle}
        />
        <select
          value={statusFilter}
          onChange={handleStatusFilterChange}
          style={selectFilterStyle}
        >
          <option value="All">Tous les statuts</option>
          <option value="Accepted">Acceptés uniquement</option>
          <option value="Blocked">Bloqués uniquement</option>
        </select>
      </div>

      {/* --- TABLE LAYOUT WORKSPACE --- */}
      <div style={tableCardStyle}>
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
                <th
                  style={sortableThStyle}
                  onClick={() => handleSort("badge_name")}
                >
                  Nom {getSortIndicator("badge_name")}
                </th>
                <th
                  style={sortableThStyle}
                  onClick={() => handleSort("idToken")}
                >
                  Token {getSortIndicator("idToken")}
                </th>
                <th
                  style={sortableThStyle}
                  onClick={() => handleSort("status")}
                >
                  Statut {getSortIndicator("status")}
                </th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBadges.map((badge: any) => (
                <tr
                  key={badge.authId}
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    transition: "var(--theme-transition)",
                  }}
                >
                  <td style={tdStyle}>
                    <strong>{badge.badge_name}</strong>
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        color: "var(--text-muted)",
                        transition: "var(--theme-transition)",
                      }}
                    >
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
                      padding: "30px 20px",
                      color: "var(--text-muted)",
                      transition: "var(--theme-transition)",
                    }}
                  >
                    Aucun badge trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* --- PAGINATION CONTROL HOUSINGS --- */}
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={paginationButtonStyle(currentPage === totalPages)}
            >
              Suivant
            </button>
          </div>
        )}
      </div>

      {/* --- CREATION / EDITION POPUP MODAL --- */}
      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2
              style={{
                marginTop: 0,
                color: "var(--text-main)",
                transition: "var(--theme-transition)",
              }}
            >
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
                  value={formData.idToken}
                  onChange={(e) =>
                    setFormData({ ...formData, idToken: e.target.value })
                  }
                  placeholder="Ex: A1B2C3D4"
                  disabled={!!editingBadge}
                  style={{
                    ...inputStyle,
                    background: editingBadge
                      ? "var(--bg-app)"
                      : "var(--bg-card)",
                    cursor: editingBadge ? "not-allowed" : "text",
                    color: editingBadge
                      ? "var(--text-muted)"
                      : "var(--text-main)",
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

// ============================================================================
// STYLES & LAYOUTS (INLINE CSS VARIABLES ADAPTATION)
// ============================================================================

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
  border: "1px solid var(--border-color)",
  background: "var(--bg-card)",
  color: "var(--text-main)",
  fontSize: "0.95rem",
  outline: "none",
  transition: "var(--theme-transition)",
};

const selectFilterStyle: React.CSSProperties = {
  padding: "10px 15px",
  borderRadius: "8px",
  border: "1px solid var(--border-color)",
  background: "var(--bg-card)",
  color: "var(--text-main)",
  fontSize: "0.95rem",
  backgroundColor: "var(--bg-card)",
  cursor: "pointer",
  outline: "none",
  transition: "var(--theme-transition)",
};

const tableCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: "12px",
  border: "1px solid var(--border-color)",
  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
  transition: "var(--theme-transition)",
};

const thStyle: React.CSSProperties = {
  padding: "20px 20px",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  userSelect: "none",
  transition: "var(--theme-transition)",
};

const sortableThStyle: React.CSSProperties = { ...thStyle, cursor: "pointer" };

const tdStyle: React.CSSProperties = {
  padding: "15px 20px",
  fontSize: "0.95rem",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};

const statusBadgeStyle = (status: string): React.CSSProperties => {
  const isAccepted = status === "Accepted";
  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "0.8rem",
    fontWeight: "600",
    background: isAccepted
      ? "rgba(16, 185, 129, 0.15)"
      : "rgba(239, 68, 68, 0.15)",
    color: isAccepted ? "var(--status-charging)" : "var(--status-offline)",
    transition: "var(--theme-transition)",
  };
};

const createButtonStyle: React.CSSProperties = {
  background: "var(--primary)",
  color: "#fff",
  border: "none",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  transition: "background 0.2s, var(--theme-transition)",
};

const editButtonStyle: React.CSSProperties = {
  background: "var(--bg-app)",
  color: "var(--text-main)",
  border: "1px solid var(--border-color)",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: "600",
  transition: "var(--theme-transition)",
};

const cancelButtonStyle: React.CSSProperties = {
  background: "var(--bg-app)",
  color: "var(--text-muted)",
  border: "1px solid var(--border-color)",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  transition: "var(--theme-transition)",
};

const deleteButtonStyle: React.CSSProperties = {
  background: "rgba(239, 68, 68, 0.15)",
  color: "var(--status-offline)",
  border: "1px solid var(--status-offline)",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  transition: "var(--theme-transition)",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "30px",
  borderRadius: "12px",
  width: "100%",
  maxWidth: "400px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
  transition: "var(--theme-transition)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "5px",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "var(--text-muted)",
  transition: "var(--theme-transition)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid var(--border-color)",
  background: "var(--bg-card)",
  color: "var(--text-main)",
  fontSize: "0.95rem",
  outline: "none",
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
