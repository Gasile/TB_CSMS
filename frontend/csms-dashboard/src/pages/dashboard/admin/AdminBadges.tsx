// ============================================================================
// IMPORTS
// ============================================================================

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
  fetchUnknownBadges,
  deleteUnknownBadge,
} from "../../../api/adminApi";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../../components/ui/Icon";

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

const ITEMS_PER_PAGE = 10;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Administrative panel for managing registered RFID badges and handling unregistered card scans.
 */
export default function AdminBadges() {
  const navigate = useNavigate();

  // Loading & Global dataset states
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>({
    Authorizations: [],
    Users: [],
    UserBadges: [],
  });

  // Search and column filtering states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortConfig, setSortConfig] = useState({
    key: "badge_name",
    direction: "asc",
  });

  // Creation & Editing popup modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<any>(null); // null represents Creation Mode
  const [formData, setFormData] = useState({
    idToken: "",
    badge_name: "",
    status: "Accepted",
    user_id: "",
  });

  // Tab navigation & Unknown card scans states
  const [activeTab, setActiveTab] = useState<"known" | "unknown">("known");
  const [unknownBadges, setUnknownBadges] = useState<any[]>([]);

  // --- PAGINATION STATES ---
  const [currentPageKnown, setCurrentPageKnown] = useState(1);
  const [currentPageUnknown, setCurrentPageUnknown] = useState(1);

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Fetches registered badge authorizations and anonymous scans simultaneously.
   */
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [resKnown, resUnknown] = await Promise.all([
        fetchAdminBadgesData(),
        fetchUnknownBadges(),
      ]);
      setData(resKnown);
      setUnknownBadges(resUnknown || []);
    } catch (error) {
      console.error("Erreur de chargement des badges:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 1. DATA MAPPING & NORMALIZATION ---
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

  // --- 2. FILTERING & SORTING PIPELINE ---
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

  // --- PAGINATION COMPUTATIONS FOR KNOWN BADGES ---
  const totalPagesKnown = Math.ceil(filteredBadges.length / ITEMS_PER_PAGE);
  const paginatedKnownBadges = filteredBadges.slice(
    (currentPageKnown - 1) * ITEMS_PER_PAGE,
    currentPageKnown * ITEMS_PER_PAGE,
  );

  // --- PAGINATION COMPUTATIONS FOR UNKNOWN BADGES ---
  const totalPagesUnknown = Math.ceil(unknownBadges.length / ITEMS_PER_PAGE);
  const paginatedUnknownBadges = unknownBadges.slice(
    (currentPageUnknown - 1) * ITEMS_PER_PAGE,
    currentPageUnknown * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    if (totalPagesKnown > 0 && currentPageKnown > totalPagesKnown) {
      setCurrentPageKnown(totalPagesKnown);
    }
  }, [totalPagesKnown, currentPageKnown]);

  useEffect(() => {
    if (totalPagesUnknown > 0 && currentPageUnknown > totalPagesUnknown) {
      setCurrentPageUnknown(totalPagesUnknown);
    }
  }, [totalPagesUnknown, currentPageUnknown]);

  /**
   * Updates sort targets and arrangement directions across table header triggers.
   */
  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "asc"
          ? "desc"
          : "asc",
    });
    setCurrentPageKnown(1);
  };

  // Reset pagination state on tab or search/filter changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPageKnown(1);
  };

  const handleStatusFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setStatusFilter(e.target.value);
    setCurrentPageKnown(1);
  };

  // --- 3. INTERACTION HANDLERS ---

  /**
   * Toggles an existing badge configuration status, preventing activation if unassigned.
   */
  const handleToggleStatus = async (badge: any) => {
    if (badge.status === "Blocked" && !badge.userId) {
      alert(
        "Action impossible : Un badge sans propriétaire ne peut pas être activé. Veuillez d'abord lui assigner un utilisateur.",
      );
      return;
    }

    await updateBadgeStatus(badge.id, badge.status);
    loadData();
  };

  /**
   * Dispatches a permanent deletion request after user confirmation.
   */
  const handleDeleteBadge = async (authId: number) => {
    if (
      window.confirm(
        "Êtes-vous sûr de vouloir supprimer définitivement ce badge ?",
      )
    ) {
      setIsLoading(true);
      try {
        await deleteBadge(authId);
        setIsModalOpen(false);
        loadData();
      } catch (err: any) {
        console.error("Erreur lors de la suppression :", err);
        alert(err.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  /**
   * Dispatches a permanent deletion request for an unregistered scan item.
   */
  const handleDeleteUnknownBadge = async (idToken: string) => {
    if (
      window.confirm(
        `Êtes-vous sûr de vouloir supprimer définitivement le scan du token "${idToken}" ?`,
      )
    ) {
      setIsLoading(true);
      try {
        await deleteUnknownBadge(idToken);
        loadData();
      } catch (err: any) {
        console.error("Erreur lors de la suppression du scan inconnu :", err);
        alert("Une erreur est survenue lors de la suppression du scan.");
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

  const openCreateFromUnknown = (token: string) => {
    setEditingBadge(null);
    setFormData({
      idToken: token,
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

  /**
   * Submits the modal form configuration, determining branching steps for reassignments or creations.
   */
  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const finalStatus = formData.user_id ? formData.status : "Blocked";

      if (editingBadge) {
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
            await unassignAndBlockBadge(
              editingBadge.userBadgeId,
              editingBadge.id,
            );
          }
        }
      } else {
        const res = await adminCreateBadge(
          formData.idToken,
          formData.badge_name,
          finalStatus,
        );
        const newAuthId = res.insert_Authorizations_one.id;

        if (formData.user_id) {
          await assignBadge(newAuthId, parseInt(formData.user_id));
        }

        try {
          await deleteUnknownBadge(formData.idToken);
        } catch (e) {}
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

  /**
   * Returns a directional matching arrow indicator reflecting active sorting setups.
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

  if (isLoading && data.Authorizations.length === 0)
    return (
      <div style={{ padding: "30px", color: "var(--text-main)" }}>
        Chargement des badges...
      </div>
    );

  return (
    <div style={containerStyle}>
      {/* View Header Section */}
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
            Gestion des Badges
          </h1>
          <p
            style={{
              margin: "5px 0 0 0",
              color: "var(--text-muted)",
              fontSize: "0.95rem",
              transition: "var(--theme-transition)",
            }}
          >
            Administrez les accès RFID de la flotte
          </p>
        </div>
        <button onClick={openCreateModal} style={createButtonStyle}>
          + Nouveau Badge
        </button>
      </div>

      {/* --- WORKSPACE TABS LINKING CONTROLS --- */}
      <div style={tabsContainerStyle}>
        <button
          style={activeTab === "known" ? activeTabStyle : inactiveTabStyle}
          onClick={() => setActiveTab("known")}
        >
          Badges Enregistrés ({filteredBadges.length})
        </button>
        <button
          style={activeTab === "unknown" ? activeTabStyle : inactiveTabStyle}
          onClick={() => setActiveTab("unknown")}
        >
          Scans Inconnus ({unknownBadges.length})
        </button>
      </div>

      {/* --- REGISTERED KNOWN BADGES PANEL VIEW --- */}
      {activeTab === "known" && (
        <>
          <div style={filterBarContainerStyle}>
            <input
              type="text"
              placeholder="Rechercher par nom, token ou propriétaire..."
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
                      onClick={() => handleSort("ownerName")}
                    >
                      Propriétaire {getSortIndicator("ownerName")}
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
                  {paginatedKnownBadges.map((badge: any) => (
                    <tr
                      key={badge.id}
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
                          color: "var(--text-muted)",
                          transition: "var(--theme-transition)",
                        }}
                      >
                        Aucun badge ne correspond à votre recherche.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* --- PAGINATION CONTROL HOUSINGS FOR KNOWN BADGES --- */}
            {totalPagesKnown > 1 && (
              <div style={paginationContainerStyle}>
                <button
                  onClick={() => setCurrentPageKnown((p) => Math.max(1, p - 1))}
                  disabled={currentPageKnown === 1}
                  style={paginationButtonStyle(currentPageKnown === 1)}
                >
                  Précédent
                </button>
                <span style={paginationTextStyle}>
                  Page {currentPageKnown} sur {totalPagesKnown}
                </span>
                <button
                  onClick={() =>
                    setCurrentPageKnown((p) => Math.min(totalPagesKnown, p + 1))
                  }
                  disabled={currentPageKnown === totalPagesKnown}
                  style={paginationButtonStyle(
                    currentPageKnown === totalPagesKnown,
                  )}
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* --- UNREGISTERED ANONYMOUS SCANS PANEL VIEW --- */}
      {activeTab === "unknown" && (
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
                  <th style={thStyle}>Token Scanné</th>
                  <th style={thStyle}>Dernière vue</th>
                  <th style={thStyle}>Borne</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>
                    Tentatives
                  </th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUnknownBadges.map((badge: any) => (
                  <tr
                    key={badge.id_token}
                    style={{
                      borderBottom: "1px solid var(--border-color)",
                      transition: "var(--theme-transition)",
                    }}
                  >
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontFamily: "monospace",
                          color: "var(--text-main)",
                          fontWeight: "bold",
                          transition: "var(--theme-transition)",
                        }}
                      >
                        {badge.id_token}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {new Date(badge.last_seen).toLocaleString()}
                    </td>
                    <td style={tdStyle}>{badge.station_id}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span
                        style={{
                          background: "var(--bg-app)",
                          padding: "4px 8px",
                          borderRadius: "12px",
                          fontSize: "0.85rem",
                          transition: "var(--theme-transition)",
                        }}
                      >
                        {badge.attempt_count}
                      </span>
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "010px",
                      }}
                    >
                      <button
                        onClick={() => openCreateFromUnknown(badge.id_token)}
                        style={createButtonStyle}
                      >
                        + Enregistrer
                      </button>
                      <button
                        onClick={() => handleDeleteUnknownBadge(badge.id_token)}
                        style={deleteUnknownScanButtonStyle}
                        title="Supprimer ce scan"
                      >
                        <Icon
                          name="delete"
                          style={{
                            fontSize: "1.1rem",
                            color: "var(--status-offline)",
                          }}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
                {unknownBadges.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        padding: "30px",
                        color: "var(--text-muted)",
                        transition: "var(--theme-transition)",
                      }}
                    >
                      Aucun scan inconnu. Votre flotte est sécurisée !
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* --- PAGINATION CONTROL HOUSINGS FOR UNKNOWN BADGES --- */}
          {totalPagesUnknown > 1 && (
            <div style={paginationContainerStyle}>
              <button
                onClick={() => setCurrentPageUnknown((p) => Math.max(1, p - 1))}
                disabled={currentPageUnknown === 1}
                style={paginationButtonStyle(currentPageUnknown === 1)}
              >
                Précédent
              </button>
              <span style={paginationTextStyle}>
                Page {currentPageUnknown} sur {totalPagesUnknown}
              </span>
              <button
                onClick={() =>
                  setCurrentPageUnknown((p) =>
                    Math.min(totalPagesUnknown, p + 1),
                  )
                }
                disabled={currentPageUnknown === totalPagesUnknown}
                style={paginationButtonStyle(
                  currentPageUnknown === totalPagesUnknown,
                )}
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- FORM SPECIFICATIONS CREATION/EDITION POPUP MODAL --- */}
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
                    disabled={!formData.user_id}
                  >
                    <option value="Accepted">Accepté (Actif)</option>
                    <option value="Blocked">Bloqué</option>
                  </select>
                  {!formData.user_id && (
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--status-offline)",
                        marginTop: "4px",
                        display: "block",
                        transition: "var(--theme-transition)",
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
                {editingBadge && (
                  <button
                    type="button"
                    onClick={() => handleDeleteBadge(editingBadge.id)}
                    style={deleteButtonStyle}
                  >
                    Supprimer
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
  border: "1px solid var(--border-color)",
  borderRadius: "12px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
  transition: "var(--theme-transition)",
};

const thStyle: React.CSSProperties = {
  padding: "20px",
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  userSelect: "none",
  transition: "var(--theme-transition)",
};

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
  padding: "8px 16px 8px 12px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  transition: "var(--theme-transition)",
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

const blockButtonStyle: React.CSSProperties = {
  background: "rgba(239, 68, 68, 0.15)",
  color: "var(--status-offline)",
  border: "1px solid var(--status-offline)",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.8rem",
  fontWeight: "600",
  transition: "var(--theme-transition)",
};

const activateButtonStyle: React.CSSProperties = {
  background: "rgba(16, 185, 129, 0.15)",
  color: "var(--status-charging)",
  border: "1px solid var(--status-charging)",
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

const deleteUnknownScanButtonStyle: React.CSSProperties = {
  background: "rgba(239, 68, 68, 0.12)",
  color: "var(--status-offline)",
  border: "1px solid rgba(239, 68, 68, 0.25)",
  padding: "6px 10px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.85rem",
  transition: "all 0.2s ease, var(--theme-transition)",
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

const sortableThStyle: React.CSSProperties = {
  ...thStyle,
  cursor: "pointer",
  userSelect: "none",
};

const tabsContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  borderBottom: "2px solid var(--border-color)",
  paddingBottom: "10px",
  transition: "var(--theme-transition)",
};

const activeTabStyle: React.CSSProperties = {
  background: "var(--primary)",
  color: "#fff",
  border: "none",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.95rem",
  fontWeight: "600",
  transition: "all 0.2s ease, var(--theme-transition)",
};

const inactiveTabStyle: React.CSSProperties = {
  background: "transparent",
  color: "var(--text-muted)",
  border: "none",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.95rem",
  fontWeight: "600",
  transition: "all 0.2s ease, var(--theme-transition)",
};

const paginationContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "15px",
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
