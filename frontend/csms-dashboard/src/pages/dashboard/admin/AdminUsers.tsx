// ============================================================================
// IMPORTS
// ============================================================================

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createNewUser,
  fetchAllUsers,
  updateUserDetails,
  deleteUser,
} from "../../../api/adminApi";

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

const USERS_PER_PAGE = 10;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Administrative user directory panel for searching, sorting, filtering,
 * creating, and modifying user accounts and access roles.
 */
export default function AdminUsers() {
  const navigate = useNavigate();
  const [editingUser, setEditingUser] = useState<any>(null);

  // Core component dataset states
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [sortConfig, setSortConfig] = useState({
    key: "last_name",
    direction: "asc",
  });

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);

  // Modal and form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "User",
    user_notifications: true,
    admin_notifications: true,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  /**
   * Fetches the full roster of registered application users from the admin API.
   */
  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const usersList = await fetchAllUsers();
      setUsers(usersList || []);
      setCurrentPage(1);
    } catch (error) {
      console.error("Erreur de chargement des utilisateurs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- FILTERING AND SORTING PIPELINE ---
  let filteredUsers = [...users];

  if (roleFilter !== "All") {
    filteredUsers = filteredUsers.filter((u) => u.role === roleFilter);
  }

  if (searchTerm) {
    const lowerSearch = searchTerm.toLowerCase();
    filteredUsers = filteredUsers.filter(
      (u) =>
        u.first_name.toLowerCase().includes(lowerSearch) ||
        u.last_name.toLowerCase().includes(lowerSearch) ||
        u.email.toLowerCase().includes(lowerSearch),
    );
  }

  filteredUsers.sort((a: any, b: any) => {
    let valA = a[sortConfig.key]?.toString().toLowerCase() || "";
    let valB = b[sortConfig.key]?.toString().toLowerCase() || "";

    if (sortConfig.key === "last_name") {
      valA = `${a.first_name} ${a.last_name}`.toLowerCase();
      valB = `${b.first_name} ${b.last_name}`.toLowerCase();
    }

    if (sortConfig.direction === "asc") {
      return valA.localeCompare(valB, "fr");
    } else {
      return valB.localeCompare(valA, "fr");
    }
  });

  // --- PAGINATION GRID LIMIT CALCULATIONS ---
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * USERS_PER_PAGE,
    currentPage * USERS_PER_PAGE,
  );

  /**
   * Toggles the table configuration sort target keys and flips ordering directions.
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

  const handleRoleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRoleFilter(e.target.value);
    setCurrentPage(1);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      role: "User",
      user_notifications: true,
      admin_notifications: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      password: "",
      role: user.role,
      user_notifications: user.user_notifications ?? true,
      admin_notifications: user.admin_notifications ?? true,
    });
    setIsModalOpen(true);
  };

  /**
   * Submits form payloads, branching out into user record creation or details update requests.
   */
  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingUser) {
        await updateUserDetails(
          editingUser.id,
          formData.first_name,
          formData.last_name,
          formData.email,
          formData.role,
          formData.user_notifications,
          formData.admin_notifications,
        );
      } else {
        await createNewUser(
          formData.first_name,
          formData.last_name,
          formData.email,
          formData.password,
          formData.role,
          formData.user_notifications,
          formData.admin_notifications,
        );
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (err: any) {
      alert("Erreur lors de la sauvegarde : " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Requests account erasure and structural unassignments using the administrative API.
   */
  const handleDeleteUser = async (userId: number) => {
    if (
      window.confirm(
        "Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ? (Ses badges seront désassignés)",
      )
    ) {
      setIsLoading(true);
      try {
        await deleteUser(userId);
        setIsModalOpen(false);
        loadUsers();
      } catch (err: any) {
        alert("Erreur lors de la suppression : " + err.message);
        setIsLoading(false);
      }
    }
  };

  /**
   * Returns column arrow status indicators matching the active layout constraints.
   */
  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key)
      return <span style={{ opacity: 0.3, marginLeft: "4px" }}>↕</span>;
    return (
      <span style={{ marginLeft: "4px" }}>
        {sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  if (isLoading && users.length === 0)
    return (
      <div style={{ padding: "30px", color: "var(--text-main)" }}>
        Chargement des utilisateurs...
      </div>
    );

  return (
    <div style={containerStyle}>
      {/* Control View Header Area */}
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
            Gestion des Utilisateurs
          </h1>
          <p
            style={{
              margin: "5px 0 0 0",
              color: "var(--text-muted)",
              fontSize: "0.95rem",
              transition: "var(--theme-transition)",
            }}
          >
            Annuaire et droits d'accès
          </p>
        </div>
        <button onClick={openCreateModal} style={createButtonStyle}>
          + Nouvel Utilisateur
        </button>
      </div>

      {/* Filtering and Query Bars */}
      <div style={filterBarContainerStyle}>
        <input
          type="text"
          placeholder="Rechercher un nom, email..."
          value={searchTerm}
          onChange={handleSearchChange}
          style={searchInputStyle}
        />
        <select
          value={roleFilter}
          onChange={handleRoleFilterChange}
          style={selectFilterStyle}
        >
          <option value="All">Tous les rôles</option>
          <option value="Admin">Administrateurs</option>
          <option value="User">Utilisateurs standards</option>
        </select>
      </div>

      {/* Main Directory Table Workspace */}
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
                  onClick={() => handleSort("last_name")}
                >
                  Nom complet {getSortIndicator("last_name")}
                </th>
                <th style={sortableThStyle} onClick={() => handleSort("email")}>
                  Email {getSortIndicator("email")}
                </th>
                <th style={sortableThStyle} onClick={() => handleSort("role")}>
                  Rôle {getSortIndicator("role")}
                </th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user: any) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    transition: "var(--theme-transition)",
                  }}
                >
                  <td style={tdStyle}>
                    <strong>
                      {user.first_name} {user.last_name}
                    </strong>
                  </td>
                  <td style={tdStyle}>{user.email}</td>
                  <td style={tdStyle}>
                    <span style={roleBadgeStyle(user.role)}>{user.role}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "10px",
                      }}
                    >
                      <button
                        onClick={() => openEditModal(user)}
                        style={editButtonStyle}
                      >
                        Éditer
                      </button>
                      <button
                        onClick={() => navigate(`/users/${user.id}`)}
                        style={detailsButtonStyle}
                      >
                        Détails ➔
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
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
                    Aucun utilisateur trouvé.
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

      {/* Creation and Account Management Overlay Modal */}
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
              {editingUser ? "Éditer l'Utilisateur" : "Nouvel Utilisateur"}
            </h2>
            <form
              onSubmit={handleSubmitModal}
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Prénom</label>
                  <input
                    required
                    style={inputStyle}
                    value={formData.first_name}
                    onChange={(e) =>
                      setFormData({ ...formData, first_name: e.target.value })
                    }
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Nom</label>
                  <input
                    required
                    style={inputStyle}
                    value={formData.last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, last_name: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  required
                  style={inputStyle}
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>

              {!editingUser && (
                <div>
                  <label style={labelStyle}>Mot de passe provisoire</label>
                  <input
                    type="password"
                    required
                    style={inputStyle}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                  />
                </div>
              )}
              <div>
                <label style={labelStyle}>Rôle</label>
                <select
                  style={inputStyle}
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value,
                      admin_notifications:
                        e.target.value === "Admin"
                          ? formData.admin_notifications
                          : false,
                    })
                  }
                >
                  <option value="User">Utilisateur standard</option>
                  <option value="Admin">Administrateur</option>
                </select>
              </div>

              {/* Notification Settings */}
              <div
                style={{
                  borderTop: "1px solid var(--border-color)",
                  paddingTop: "15px",
                  marginTop: "5px",
                }}
              >
                <label style={labelStyle}>Préférences de notification</label>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    marginTop: "10px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      cursor: "pointer",
                      color: "var(--text-main)",
                      fontSize: "0.95rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.user_notifications}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          user_notifications: e.target.checked,
                        })
                      }
                      style={checkboxStyle}
                    />
                    Recevoir les notifications standards
                  </label>

                  {formData.role === "Admin" && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                        color: "var(--text-main)",
                        fontSize: "0.95rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.admin_notifications}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            admin_notifications: e.target.checked,
                          })
                        }
                        style={checkboxStyle}
                      />
                      Recevoir les alertes administrateur
                    </label>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                {editingUser && (
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(editingUser.id)}
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
                  {editingUser ? "Sauvegarder" : "Créer le compte"}
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
  padding: "20px 20px",
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

const roleBadgeStyle = (role: string): React.CSSProperties => {
  const isAdmin = role === "Admin";
  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "0.8rem",
    fontWeight: "600",
    background: isAdmin ? "rgba(251, 191, 36, 0.15)" : "var(--border-color)",
    color: isAdmin ? "var(--status-maintenance)" : "var(--text-muted)",
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

const checkboxStyle: React.CSSProperties = {
  width: "18px",
  height: "18px",
  accentColor: "var(--primary)",
  cursor: "pointer",
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

const sortableThStyle: React.CSSProperties = {
  ...thStyle,
  cursor: "pointer",
  userSelect: "none",
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
