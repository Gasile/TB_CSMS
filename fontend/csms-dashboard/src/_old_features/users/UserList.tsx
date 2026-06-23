import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddUserForm from "./AddUserForm";
import { fetchAllUsers } from "../../api/userApi";

interface UserFromDB {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

const emojiStyle: React.CSSProperties = {
  background: "var(--gradient-primary)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  display: "inline-block",
  lineHeight: "1.2",
};

export default function UserList() {
  const [users, setUsers] = useState<UserFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAddBtnHovered, setIsAddBtnHovered] = useState(false);

  const navigate = useNavigate();

  const loadUsers = async () => {
    try {
      const data = await fetchAllUsers();
      if (data) setUsers(data);
    } catch (err) {
      console.error("Erreur :", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  if (loading)
    return (
      <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
        Chargement des utilisateurs...
      </p>
    );

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <div style={{ textAlign: "left" }}>
          <h2
            style={{
              margin: "0 0 5px 0",
              color: "var(--text-primary)",
              fontSize: "1.8em",
            }}
          >
            <span style={{ marginRight: "10px", ...emojiStyle }}>👥</span>{" "}
            Gestion des Utilisateurs
          </h2>
          <p
            style={{
              margin: 0,
              color: "var(--text-secondary)",
              fontSize: "0.95em",
            }}
          >
            Supervision des comptes et des droits d'accès au réseau.
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            onMouseEnter={() => setIsAddBtnHovered(true)}
            onMouseLeave={() => setIsAddBtnHovered(false)}
            style={getAddButtonStyle(isAddBtnHovered)}
          >
            <span style={{ marginRight: "6px", ...emojiStyle }}>➕</span> Nouvel
            Utilisateur
          </button>
        )}
      </div>

      {showAddForm && (
        <AddUserForm
          onUserAdded={() => {
            loadUsers();
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: `2px solid var(--color-border)`,
                color: "var(--text-secondary)",
              }}
            >
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Utilisateur</th>
              <th style={thStyle}>Contact (Email)</th>
              <th style={thStyle}>Niveau d'accès</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onClick={() => navigate(`/dashboard/admin-users/${u.id}`)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserRow({ user, onClick }: { user: UserFromDB; onClick: () => void }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderBottom: `1px solid var(--color-border)`,
        backgroundColor: isHovered ? "var(--bg-input)" : "transparent",
        cursor: "pointer",
        transition: "var(--transition-standard)",
      }}
    >
      <td style={{ ...tdStyle, color: "var(--text-mute)", fontWeight: "bold" }}>
        #{user.id}
      </td>
      <td
        style={{ ...tdStyle, color: "var(--text-primary)", fontWeight: "600" }}
      >
        {user.last_name} {user.first_name}
      </td>
      <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>
        {user.email}
      </td>
      <td style={tdStyle}>
        <span style={getRoleBadgeStyle(user.role)}>
          {user.role === "Admin" ? "Administrateur" : "Utilisateur"}
        </span>
      </td>
      <td
        style={{
          ...tdStyle,
          textAlign: "center",
          color: isHovered ? "var(--color-user)" : "var(--text-secondary)",
          fontWeight: "bold",
          transition: "var(--transition-standard)",
        }}
      >
        Consulter ➔
      </td>
    </tr>
  );
}

const cardStyle: React.CSSProperties = {
  border: "3px solid transparent",
  background: `linear-gradient(var(--bg-card), var(--bg-card)) padding-box, var(--gradient-primary) border-box`,
  padding: "40px",
  borderRadius: "50px",
  boxShadow: "var(--shadow-card)",
  width: "fit-content",
  minWidth: "1000px",
  margin: "0 auto",
};
const getAddButtonStyle = (isHovered: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  padding: "12px 22px",
  backgroundColor: isHovered ? "var(--bg-user-active)" : "transparent",
  color: isHovered ? "var(--color-user)" : "var(--text-secondary)",
  border: `1px solid ${isHovered ? "var(--color-user)" : "var(--color-border)"}`,
  borderRadius: "14px",
  fontSize: "0.95em",
  fontWeight: "600",
  cursor: "pointer",
  transition: "var(--transition-standard)",
  whiteSpace: "nowrap",
});
const thStyle: React.CSSProperties = {
  padding: "15px 10px",
  textTransform: "uppercase",
  fontSize: "0.85em",
  letterSpacing: "1px",
  fontWeight: "600",
};
const tdStyle: React.CSSProperties = {
  padding: "15px 10px",
  verticalAlign: "middle",
};

const getRoleBadgeStyle = (role: string): React.CSSProperties => {
  const isAdmin = role === "Admin";
  return {
    display: "inline-block",
    padding: "6px 14px",
    borderRadius: "20px",
    backgroundColor: isAdmin ? "var(--bg-admin-active)" : "var(--bg-input)",
    color: isAdmin ? "var(--color-admin)" : "var(--text-secondary)",
    border: `1px solid ${isAdmin ? "var(--color-admin)" : "var(--color-border)"}`,
    fontSize: "0.8em",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };
};
