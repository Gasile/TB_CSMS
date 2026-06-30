import React, { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  fetchPowerBlocksWithStations,
  createPowerBlock,
  updatePowerBlock,
  deletePowerBlock,
  updateStationPowerBlock,
} from "../../../api/powerBlockApi";

// --- SOUS-COMPOSANT : BORNE DÉPLAÇABLE ---
function DraggableStation({ station }: { station: any }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `station-${station.id}`,
    data: { station },
  });

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.2 : 1, // Devient très discret à sa place d'origine
    cursor: "grab",
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "140px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
    userSelect: "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        style={{
          fontSize: "1.3rem",
          background: "#f3f4f6",
          padding: "6px",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        🔌
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <strong
          style={{
            fontSize: "0.85rem",
            color: "#111827",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {station.ocppConnectionName}
        </strong>
        <span
          style={{
            fontSize: "0.7rem",
            color: "#6b7280",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {station.chargePointModel || "Modèle inconnu"}
        </span>
      </div>
    </div>
  );
}

// --- SOUS-COMPOSANT : ZONE DE DÉPÔT (DROPPABLE) ---
function DroppableZone({
  id,
  children,
  style,
}: {
  id: string;
  children: React.ReactNode;
  style: React.CSSProperties;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const zoneStyle: React.CSSProperties = {
    ...style,
    backgroundColor: isOver ? "#eff6ff" : style.backgroundColor,
    borderColor: isOver ? "#3b82f6" : style.borderColor,
    transition: "all 0.2s ease",
  };

  return (
    <div ref={setNodeRef} style={zoneStyle}>
      {children}
    </div>
  );
}

// --- COMPOSANT PRINCIPAL ---
export default function PowerBlockManagement() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // États de données
  const [powerBlocks, setPowerBlocks] = useState<any[]>([]);
  const [unassignedStations, setUnassignedStations] = useState<any[]>([]);

  // États d'interactivité (Drag & Drop)
  const [activeStation, setActiveStation] = useState<any>(null);

  // États pour la modale de création
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [blockForm, setBlockForm] = useState({ name: "", maxKw: "" });

  // États pour la modale d'édition/suppression
  const [editingBlock, setEditingBlock] = useState<any>(null); // Reçoit le bloc complet lors du clic sur modifier

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchPowerBlocksWithStations();

      const blocks = data?.PowerBlocks || [];
      const allStations = data?.ChargingStations || [];

      const blocksWithStations = blocks.map((block: any) => ({
        ...block,
        stations: allStations.filter((s: any) => s.power_block_id === block.id),
      }));

      const unassigned = allStations.filter(
        (s: any) => s.power_block_id === null,
      );

      setPowerBlocks(blocksWithStations);
      setUnassignedStations(unassigned);
    } catch (err: any) {
      setError(
        err.message || "Erreur lors du chargement des blocs de puissance.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // --- ACTIONS FORMULAIRE ---
  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPowerBlock(blockForm.name, Number(blockForm.maxKw));
      setIsModalOpen(false);
      setBlockForm({ name: "", maxKw: "" });
      loadData(); // Recharge la vue avec le nouveau bloc disponible
    } catch (err: any) {
      alert(err.message || "Erreur lors de la création du bloc de puissance.");
    }
  };

  const handleUpdateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBlock) return;
    try {
      await updatePowerBlock(
        editingBlock.id,
        editingBlock.name,
        Number(editingBlock.max_kw),
      );
      setEditingBlock(null);
      loadData();
    } catch (err: any) {
      alert(
        err.message || "Erreur lors de la modification du bloc de puissance.",
      );
    }
  };

  const handleDeleteBlock = async (blockId: number, blockName: string) => {
    if (
      window.confirm(
        `Voulez-vous vraiment supprimer le bloc "${blockName}" ? Toutes les bornes rattachées seront automatiquement désassignées.`,
      )
    ) {
      try {
        await deletePowerBlock(blockId);
        loadData();
      } catch (err: any) {
        alert(
          err.message || "Erreur lors de la suppression du bloc de puissance.",
        );
      }
    }
  };

  // --- LOGIQUE DRAG & DROP ---
  const handleDragStart = (event: any) => {
    const { active } = event;
    const activeData = active.data.current;
    if (activeData && activeData.station) {
      setActiveStation(activeData.station);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveStation(null); // Nettoyage immédiat de l'overlay

    if (!over) return;

    const activeData = active.data.current;
    if (!activeData || !activeData.station) return;
    const draggedStation = activeData.station;

    const targetZoneId = over.id as string;

    let newBlockId: number | null = null;
    if (targetZoneId.startsWith("block-")) {
      newBlockId = Number(targetZoneId.replace("block-", ""));
    }

    if (draggedStation.power_block_id === newBlockId) return;

    // Mise à jour optimiste de l'UI
    setPowerBlocks((prev) =>
      prev.map((b) => {
        let stations = b.stations.filter(
          (s: any) => s.id !== draggedStation.id,
        );
        if (b.id === newBlockId) {
          stations = [
            ...stations,
            { ...draggedStation, power_block_id: newBlockId },
          ];
        }
        return { ...b, stations };
      }),
    );

    setUnassignedStations((prev) => {
      if (newBlockId === null) {
        return [
          ...prev.filter((s: any) => s.id !== draggedStation.id),
          { ...draggedStation, power_block_id: null },
        ];
      } else {
        return prev.filter((s: any) => s.id !== draggedStation.id);
      }
    });

    try {
      await updateStationPowerBlock(draggedStation.id, newBlockId);
    } catch (err) {
      console.error("Erreur lors de la mutation :", err);
      loadData();
    }
  };

  if (
    isLoading &&
    powerBlocks.length === 0 &&
    unassignedStations.length === 0
  ) {
    return (
      <div style={{ padding: "20px" }}>
        Chargement de la configuration de puissance...
      </div>
    );
  }
  if (error)
    return <div style={{ padding: "20px", color: "red" }}>{error}</div>;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={containerStyle}>
        {/* En-tête de la page */}
        <div style={headerStyle}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#1f2937" }}>
              Gestion du Smart Charging
            </h1>
            <p
              style={{
                margin: "5px 0 0 0",
                color: "#6b7280",
                fontSize: "0.95rem",
              }}
            >
              Répartissez vos bornes de recharge sur vos différents blocs de
              puissance.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setIsModalOpen(true)}
              style={addBlockButtonStyle}
            >
              📦 + Créer un bloc
            </button>
            <button onClick={loadData} style={refreshButtonStyle}>
              🔄 Rafraîchir
            </button>
          </div>
        </div>

        {/* --- GRILLE DES BLOCS DE PUISSANCE --- */}
        <div style={blocksGridStyle}>
          {powerBlocks.map((block) => (
            <div key={block.id} style={blockCardStyle}>
              {/* Sommet du bloc : Nom et P_Max */}
              {/* Sommet du bloc : Nom, P_Max et Actions */}
              <div style={blockHeaderStyle}>
                <h3 style={blockTitleStyle}>📦 {block.name}</h3>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span style={pMaxBadgeStyle}>{block.max_kw} kW max</span>
                  <button
                    onClick={() =>
                      setEditingBlock({
                        id: block.id,
                        name: block.name,
                        max_kw: block.max_kw,
                      })
                    }
                    style={iconActionButtonStyle}
                    title="Modifier le bloc"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteBlock(block.id, block.name)}
                    style={{ ...iconActionButtonStyle, color: "#dc2626" }}
                    title="Supprimer le bloc"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Zone de dépôt du bloc */}
              <DroppableZone
                id={`block-${block.id}`}
                style={stationDropZoneStyle}
              >
                {block.stations.length === 0 ? (
                  <div style={emptyZoneTextStyle}>Aucune borne sur ce bloc</div>
                ) : (
                  block.stations.map((station: any) => (
                    <DraggableStation key={station.id} station={station} />
                  ))
                )}
              </DroppableZone>
            </div>
          ))}
        </div>

        {/* --- SECTION DES BORNES NON ASSIGNÉES (BAC DU BAS) --- */}
        <div style={unassignedSectionStyle}>
          <h2 style={unassignedTitleStyle}>
            📥 Bornes non assignées ({unassignedStations.length})
          </h2>

          <DroppableZone id="unassigned" style={unassignedDropZoneStyle}>
            {unassignedStations.length === 0 ? (
              <div style={emptyZoneTextStyle}>
                Toutes les bornes sont configurées dans un bloc de puissance.
              </div>
            ) : (
              unassignedStations.map((station: any) => (
                <DraggableStation key={station.id} station={station} />
              ))
            )}
          </DroppableZone>
        </div>
      </div>

      {/* --- CLONE OVERLAY PROPRE --- */}
      <DragOverlay dropAnimation={null}>
        {activeStation ? (
          <div
            style={{
              background: "#fff",
              border: "2px solid #3b82f6", // Bordure bleue nette
              borderRadius: "10px",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              width: "140px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
              userSelect: "none",
            }}
          >
            <div
              style={{
                fontSize: "1.3rem",
                background: "#eff6ff",
                padding: "6px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              🔌
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <strong
                style={{
                  fontSize: "0.85rem",
                  color: "#111827",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontWeight: "bold",
                }}
              >
                {activeStation.ocppConnectionName}
              </strong>
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "#6b7280",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {activeStation.chargePointModel || "Modèle inconnu"}
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {/* --- MODALE DE CRÉATION DE BLOC --- */}
      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ marginTop: 0, color: "#1f2937", fontSize: "1.4rem" }}>
              Créer un Bloc de Puissance
            </h2>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#6b7280",
                marginBottom: "20px",
              }}
            >
              Ajoutez une infrastructure de délestage physique pour limiter la
              charge globale de ses stations.
            </p>
            <form
              onSubmit={handleCreateBlock}
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <div>
                <label style={labelStyle}>Nom du bloc</label>
                <input
                  required
                  style={inputStyle}
                  value={blockForm.name}
                  onChange={(e) =>
                    setBlockForm({ ...blockForm, name: e.target.value })
                  }
                  placeholder="Ex: Secteur A, Bloc principal, Étage 1..."
                />
              </div>
              <div>
                <label style={labelStyle}>Puissance Maximale (kW)</label>
                <input
                  required
                  type="number"
                  step="0.1"
                  style={inputStyle}
                  value={blockForm.maxKw}
                  onChange={(e) =>
                    setBlockForm({ ...blockForm, maxKw: e.target.value })
                  }
                  placeholder="Ex: 22, 44, 150..."
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
                <button type="submit" style={submitButtonStyle}>
                  Créer le bloc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --- MODALE DE MODIFICATION DE BLOC --- */}
      {editingBlock && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ marginTop: 0, color: "#1f2937", fontSize: "1.4rem" }}>
              Modifier le Bloc de Puissance
            </h2>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#6b7280",
                marginBottom: "20px",
              }}
            >
              Ajustez le nom ou la puissance maximale allouée à ce secteur.
            </p>
            <form
              onSubmit={handleUpdateBlock}
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <div>
                <label style={labelStyle}>Nom du bloc</label>
                <input
                  required
                  style={inputStyle}
                  value={editingBlock.name}
                  onChange={(e) =>
                    setEditingBlock({ ...editingBlock, name: e.target.value })
                  }
                  placeholder="Ex: Secteur A..."
                />
              </div>
              <div>
                <label style={labelStyle}>Puissance Maximale (kW)</label>
                <input
                  required
                  type="number"
                  step="0.1"
                  style={inputStyle}
                  value={editingBlock.max_kw}
                  onChange={(e) =>
                    setEditingBlock({ ...editingBlock, max_kw: e.target.value })
                  }
                  placeholder="Ex: 22..."
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
                  onClick={() => setEditingBlock(null)}
                  style={cancelButtonStyle}
                >
                  Annuler
                </button>
                <button type="submit" style={submitButtonStyle}>
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DndContext>
  );
}

// --- STYLES CSS ---
const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "30px",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};
const refreshButtonStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d1d5db",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "#374151",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
};
const addBlockButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  border: "none",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
};
const blocksGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
  gap: "25px",
};
const blockCardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "16px",
  padding: "20px",
  boxShadow: "0 4px 6px rgba(0,0,0,0.02), 0 1px 3px rgba(0,0,0,0.05)",
  display: "flex",
  flexDirection: "column",
  minHeight: "220px",
  border: "1px solid #e5e7eb",
};
const blockHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "15px",
  borderBottom: "1px solid #f3f4f6",
  paddingBottom: "10px",
};
const blockTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.15rem",
  color: "#111827",
  fontWeight: "700",
};
const pMaxBadgeStyle: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  padding: "4px 10px",
  borderRadius: "12px",
  fontSize: "0.8rem",
  fontWeight: "700",
};
const stationDropZoneStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  alignContent: "flex-start",
  padding: "10px",
  background: "#f9fafb",
  borderRadius: "8px",
  border: "1px dashed #e5e7eb",
  minHeight: "100px",
};
const emptyZoneTextStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "0.85rem",
  fontStyle: "italic",
  width: "100%",
  textAlign: "center",
  padding: "20px 0",
};
const unassignedSectionStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "16px",
  padding: "25px",
  boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
  border: "1px solid #e5e7eb",
};
const unassignedTitleStyle: React.CSSProperties = {
  margin: "0 0 15px 0",
  fontSize: "1.2rem",
  color: "#374151",
};
const unassignedDropZoneStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  padding: "15px",
  background: "#f9fafb",
  borderRadius: "12px",
  border: "1px dashed #d1d5db",
  minHeight: "80px",
};
const overlayStationCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #3b82f6",
  borderRadius: "10px",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "140px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
  userSelect: "none",
};

// MODALE STYLES
const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.4)",
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
  marginBottom: "6px",
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
const submitButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
};

const iconActionButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "0.9rem",
  padding: "4px",
  borderRadius: "4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.2s",
};
