import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createNewUser,
  fetchAllUsers,
  updateUserRole,
  updateUserDetails,
  deleteUser,
} from "../../../api/adminApi";

export default function AdminUsers() {
  const navigate = useNavigate();
  const [editingUser, setEditingUser] = useState<any>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [sortConfig, setSortConfig] = useState({
    key: "last_name",
    direction: "asc",
  });

  // Modale
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "User",
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const usersList = await fetchAllUsers(); // Retourne directement le tableau des utilisateurs
      setUsers(usersList || []);
    } catch (error) {
      console.error("Erreur de chargement des utilisateurs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- FILTRAGE ET TRI ---
  // 1. On crée une VRAIE copie pour ne jamais muter l'état React original
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

  // 2. On trie la copie
  filteredUsers.sort((a: any, b: any) => {
    let valA = a[sortConfig.key]?.toString().toLowerCase() || "";
    let valB = b[sortConfig.key]?.toString().toLowerCase() || "";

    // Cas particulier : on concatène "Prénom Nom" pour correspondre EXACTEMENT
    // à ce qui est affiché à l'écran, de gauche à droite.
    if (sortConfig.key === "last_name") {
      valA = `${a.first_name} ${a.last_name}`.toLowerCase();
      valB = `${b.first_name} ${b.last_name}`.toLowerCase();
    }

    // localeCompare est parfait pour trier correctement les accents en français (ex: Métrailler)
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

  // --- ACTIONS ---
  const handleToggleRole = async (userId: number, currentRole: string) => {
    const newRole = currentRole === "Admin" ? "User" : "Admin";
    if (
      window.confirm(
        `Voulez-vous vraiment passer cet utilisateur en ${newRole} ?`,
      )
    ) {
      await updateUserRole(userId, newRole);
      loadUsers();
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      role: "User",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    // On pré-remplit les infos, le mot de passe reste vide car on ne le modifie pas ici
    setFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      password: "",
      role: user.role,
    });
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingUser) {
        // --- MODE ÉDITION ---
        await updateUserDetails(
          editingUser.id,
          formData.first_name,
          formData.last_name,
          formData.email,
          formData.role,
        );
      } else {
        // --- MODE CRÉATION ---
        await createNewUser(
          formData.first_name,
          formData.last_name,
          formData.email,
          formData.password,
          formData.role,
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

  if (isLoading && users.length === 0)
    return (
      <div style={{ padding: "30px" }}>Chargement des utilisateurs...</div>
    );

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#1f2937" }}>
            Gestion des Utilisateurs
          </h1>
          <p
            style={{
              margin: "5px 0 0 0",
              color: "#6b7280",
              fontSize: "0.95rem",
            }}
          >
            Annuaire et droits d'accès
          </p>
        </div>
        <button onClick={openCreateModal} style={createButtonStyle}>
          + Nouvel Utilisateur
        </button>
      </div>

      <div style={filterBarContainerStyle}>
        <input
          type="text"
          placeholder="Rechercher un nom, email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={searchInputStyle}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={selectFilterStyle}
        >
          <option value="All">Tous les rôles</option>
          <option value="Admin">Administrateurs</option>
          <option value="User">Utilisateurs standards</option>
        </select>
      </div>

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
            {filteredUsers.map((user: any) => (
              <tr key={user.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
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
                  {/* Utilisation d'une div interne pour un alignement parfait à droite */}
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
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ marginTop: 0, color: "#1f2937" }}>
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

              {/* Le mot de passe n'est demandé qu'à la création */}
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
                    setFormData({ ...formData, role: e.target.value })
                  }
                >
                  <option value="User">Utilisateur standard</option>
                  <option value="Admin">Administrateur</option>
                </select>
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

const roleBadgeStyle = (role: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "0.8rem",
  fontWeight: "600",
  background: role === "Admin" ? "#fef08a" : "#f3f4f6",
  color: role === "Admin" ? "#854d0e" : "#4b5563",
});
const smallBadgeStyle = (status: string): React.CSSProperties => ({
  padding: "3px 8px",
  borderRadius: "12px",
  fontSize: "0.75rem",
  fontWeight: "600",
  border: "1px solid #e5e7eb",
  background: status === "Accepted" ? "#dcfce7" : "#fee2e2",
  color: status === "Accepted" ? "#16a34a" : "#dc2626",
});

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

// NOUVEAU STYLE POUR RENDRE L'EN-TÊTE CLIQUABLE
const sortableThStyle: React.CSSProperties = {
  ...thStyle,
  cursor: "pointer",
  userSelect: "none",
};
