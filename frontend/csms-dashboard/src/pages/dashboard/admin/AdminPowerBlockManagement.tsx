// ============================================================================
// IMPORTS
// ============================================================================

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
  checkStationActiveStatus,
} from "../../../api/powerBlockApi";
import { useNavigate } from "react-router-dom";

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Represents a draggable charging station card that can be assigned to power blocks.
 */
function DraggableStation({ station }: { station: any }) {
  // Check if there is an active transaction on the station to prevent moving it
  const isStationActive =
    station.Transactions && station.Transactions.length > 0;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `station-${station.id}`,
    data: { station },
    disabled: isStationActive,
  });

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.2 : isStationActive ? 0.6 : 1,
    cursor: isStationActive ? "not-allowed" : "grab",
    backgroundColor: isStationActive
      ? "rgba(239, 68, 68, 0.08)"
      : "var(--bg-card)",
    border: isStationActive
      ? "1px solid var(--status-offline)"
      : "1px solid var(--border-color)",
    borderRadius: "10px",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "140px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
    userSelect: "none",
    position: "relative",
    transition: "var(--theme-transition)",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isStationActive ? {} : attributes)}
      {...(isStationActive ? {} : listeners)}
    >
      <div
        style={{
          fontSize: "1.3rem",
          background: isStationActive
            ? "rgba(239, 68, 68, 0.15)"
            : "var(--bg-app)",
          padding: "6px",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "var(--theme-transition)",
        }}
      >
        {isStationActive ? "⚡" : "🔌"}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          flex: 1,
        }}
      >
        <strong
          style={{
            fontSize: "0.85rem",
            color: isStationActive
              ? "var(--status-offline)"
              : "var(--text-main)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            transition: "var(--theme-transition)",
          }}
        >
          {station.ocppConnectionName}
        </strong>
        <span
          style={{
            fontSize: "0.7rem",
            color: isStationActive
              ? "var(--status-offline)"
              : "var(--text-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            transition: "var(--theme-transition)",
          }}
        >
          {station.chargePointModel || "Modèle inconnu"}
        </span>
      </div>

      {isStationActive && (
        <div
          style={{
            position: "absolute",
            top: "-6px",
            right: "-6px",
            background: "var(--status-offline)",
            color: "white",
            fontSize: "0.6rem",
            padding: "2px 6px",
            borderRadius: "10px",
            fontWeight: "bold",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          En charge
        </div>
      )}
    </div>
  );
}

/**
 * Represents a container zone where draggable stations can be dropped.
 */
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
    backgroundColor: isOver
      ? "rgba(14, 165, 233, 0.08)"
      : style.backgroundColor,
    borderColor: isOver ? "var(--status-available)" : style.borderColor,
    transition: "all 0.2s ease, var(--theme-transition)",
  };

  return (
    <div ref={setNodeRef} style={zoneStyle}>
      {children}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculates the maximum power in kilowatts based on voltage, amperage, and phases.
 */
const calculateKw = (v: number, a: number, phases: number): string => {
  if (!v || !a) return "0.0";
  const multiplier = phases === 3 ? Math.sqrt(3) : 1;
  const powerWatts = v * a * multiplier;
  return (powerWatts / 1000).toFixed(1);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Main management component for smart charging power blocks and station assignments.
 */
export default function PowerBlockManagement() {
  const navigate = useNavigate();

  // UI & Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Data States
  const [powerBlocks, setPowerBlocks] = useState<any[]>([]);
  const [unassignedStations, setUnassignedStations] = useState<any[]>([]);
  const [activeStation, setActiveStation] = useState<any>(null);

  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [blockForm, setBlockForm] = useState({
    name: "",
    maxV: "400",
    maxA: "32",
    nPhase: "3",
  });
  const [editingBlock, setEditingBlock] = useState<any>(null);

  // Drag and drop sensor configuration with activation constraints
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Fetches and prepares power blocks and station data from the API.
   */
  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchPowerBlocksWithStations();
      const blocks = data?.PowerBlocks || [];
      const allStations = data?.ChargingStations || [];

      // Map stations to their corresponding power blocks
      const blocksWithStations = blocks.map((block: any) => ({
        ...block,
        stations: allStations.filter((s: any) => s.power_block_id === block.id),
      }));

      // Identify remaining unassigned stations
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

  /**
   * Handles the creation of a new power block.
   */
  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const v = Number(blockForm.maxV);
      const a = Number(blockForm.maxA);
      const phase = Number(blockForm.nPhase);

      // Compute standard active power limit based on phases
      const multiplier = phase === 3 ? Math.sqrt(3) : 1;
      const computedKw = Number(((v * a * multiplier) / 1000).toFixed(2));

      await createPowerBlock(blockForm.name, v, a, phase, computedKw);
      setIsModalOpen(false);
      setBlockForm({ name: "", maxV: "400", maxA: "32", nPhase: "3" });
      loadData();
    } catch (err: any) {
      alert(err.message || "Erreur lors de la création du bloc de puissance.");
    }
  };

  /**
   * Handles updating an existing power block's configuration.
   */
  const handleUpdateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBlock) return;
    try {
      const v = Number(editingBlock.max_v);
      const a = Number(editingBlock.max_a);
      const phase = Number(editingBlock.n_phase);

      // Recompute power limits
      const multiplier = phase === 3 ? Math.sqrt(3) : 1;
      const computedKw = Number(((v * a * multiplier) / 1000).toFixed(2));

      await updatePowerBlock(
        editingBlock.id,
        editingBlock.name,
        v,
        a,
        phase,
        computedKw,
      );
      setEditingBlock(null);
      loadData();
    } catch (err: any) {
      alert(
        err.message || "Erreur lors de la modification du bloc de puissance.",
      );
    }
  };

  /**
   * Handles the deletion of a power block after user confirmation.
   */
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

  /**
   * Handles the initiation of a drag event for a station.
   */
  const handleDragStart = (event: any) => {
    const { active } = event;
    const activeData = active.data.current;
    if (activeData && activeData.station) {
      setActiveStation(activeData.station);
    }
  };

  /**
   * Processes the dropping of a station into a new power block or unassigned zone.
   */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveStation(null);

    // Cancel if not dropped over a valid zone
    if (!over) return;

    const activeData = active.data.current;
    if (!activeData || !activeData.station) return;
    const draggedStation = activeData.station;
    const targetZoneId = over.id as string;

    // Parse target block ID (null means unassigned zone)
    let newBlockId: number | null = null;
    if (targetZoneId.startsWith("block-")) {
      newBlockId = Number(targetZoneId.replace("block-", ""));
    }

    // Cancel if dropped onto its existing container
    if (draggedStation.power_block_id === newBlockId) return;

    // Safety check: Prevent changing assignment if a charging transaction started concurrently
    try {
      const isCurrentlyActive = await checkStationActiveStatus(
        draggedStation.id,
      );
      if (isCurrentlyActive) {
        alert(
          "Action refusée : Une session de charge a démarré sur cette borne depuis votre dernière actualisation.",
        );
        loadData();
        return;
      }
    } catch (err) {
      console.error("Erreur lors de la vérification du statut :", err);
      return;
    }

    // Optimistic UI updates for assigned blocks
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

    // Optimistic UI updates for unassigned list
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

    // Sync state update with backend
    try {
      await updateStationPowerBlock(draggedStation.id, newBlockId);
    } catch (err) {
      console.error("Erreur lors de la mutation :", err);
      loadData();
    }
  };

  // Render initial loading state
  if (
    isLoading &&
    powerBlocks.length === 0 &&
    unassignedStations.length === 0
  ) {
    return (
      <div style={{ padding: "20px", color: "var(--text-main)" }}>
        Configuration de puissance...
      </div>
    );
  }

  // Render error state
  if (error)
    return (
      <div style={{ padding: "20px", color: "var(--status-offline)" }}>
        {error}
      </div>
    );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={containerStyle}>
        {/* Header Section */}
        <div style={headerStyle}>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <button onClick={() => navigate(-1)} style={backButtonStyle}>
              ← Retour
            </button>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.8rem",
                  color: "var(--text-main)",
                  transition: "var(--theme-transition)",
                }}
              >
                Gestion du Smart Charging
              </h1>
              <p
                style={{
                  margin: "5px 0 0 0",
                  color: "var(--text-muted)",
                  fontSize: "0.95rem",
                  transition: "var(--theme-transition)",
                }}
              >
                Répartissez vos bornes de recharge sur vos différents blocs de
                puissance.
              </p>
            </div>
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

        {/* Power Blocks Grid Section */}
        <div style={blocksGridStyle}>
          {powerBlocks.map((block) => (
            <div key={block.id} style={blockCardStyle}>
              <div style={blockHeaderStyle}>
                <h3 style={blockTitleStyle}>📦 {block.name}</h3>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span style={pMaxBadgeStyle}>
                    {calculateKw(block.max_v, block.max_a, block.n_phase)} kW
                    max ({block.max_a}A)
                  </span>
                  <button
                    onClick={() =>
                      setEditingBlock({
                        id: block.id,
                        name: block.name,
                        max_v: block.max_v,
                        max_a: block.max_a,
                        n_phase: block.n_phase,
                      })
                    }
                    style={iconActionButtonStyle}
                    title="Modifier le bloc"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteBlock(block.id, block.name)}
                    style={{
                      ...iconActionButtonStyle,
                      color: "var(--status-offline)",
                    }}
                    title="Supprimer le bloc"
                  >
                    🗑️
                  </button>
                </div>
              </div>

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

        {/* Unassigned Stations Pool Section */}
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

      {/* Drag Portal Overlay Preview */}
      <DragOverlay dropAnimation={null}>
        {activeStation ? (
          <div
            style={{
              background: "var(--bg-card)",
              border: "2px solid var(--status-available)",
              borderRadius: "10px",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              width: "140px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
              userSelect: "none",
            }}
          >
            <div
              style={{
                fontSize: "1.3rem",
                background: "var(--bg-app)",
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
                  color: "var(--text-main)",
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
                  color: "var(--text-muted)",
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

      {/* Creation Modal */}
      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2
              style={{
                marginTop: 0,
                color: "var(--text-main)",
                fontSize: "1.4rem",
              }}
            >
              Créer un Bloc de Puissance
            </h2>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
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
                  placeholder="Ex: Secteur A, Étage 1..."
                />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Tension (V)</label>
                  <input
                    required
                    type="number"
                    style={inputStyle}
                    value={blockForm.maxV}
                    onChange={(e) =>
                      setBlockForm({ ...blockForm, maxV: e.target.value })
                    }
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Courant (A)</label>
                  <input
                    required
                    type="number"
                    style={inputStyle}
                    value={blockForm.maxA}
                    onChange={(e) =>
                      setBlockForm({ ...blockForm, maxA: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Type d'alimentation</label>
                <select
                  style={inputStyle}
                  value={blockForm.nPhase}
                  onChange={(e) =>
                    setBlockForm({ ...blockForm, nPhase: e.target.value })
                  }
                >
                  <option value="1">Monophasé (1 Phase)</option>
                  <option value="3">Triphasé (3 Phases)</option>
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

      {/* Editing Modal */}
      {editingBlock && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2
              style={{
                marginTop: 0,
                color: "var(--text-main)",
                fontSize: "1.4rem",
              }}
            >
              Modifier le Bloc de Puissance
            </h2>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
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
                />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Tension (V)</label>
                  <input
                    required
                    type="number"
                    style={inputStyle}
                    value={editingBlock.max_v}
                    onChange={(e) =>
                      setEditingBlock({
                        ...editingBlock,
                        max_v: e.target.value,
                      })
                    }
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Courant (A)</label>
                  <input
                    required
                    type="number"
                    style={inputStyle}
                    value={editingBlock.max_a}
                    onChange={(e) =>
                      setEditingBlock({
                        ...editingBlock,
                        max_a: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Type d'alimentation</label>
                <select
                  style={inputStyle}
                  value={editingBlock.n_phase}
                  onChange={(e) =>
                    setEditingBlock({
                      ...editingBlock,
                      n_phase: Number(e.target.value),
                    })
                  }
                >
                  <option value={1}>Monophasé (1 Phase)</option>
                  <option value={3}>Triphasé (3 Phases)</option>
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

// ============================================================================
// STYLES & LAYOUTS (INLINE CSS VARIABLES ADAPTATION)
// ============================================================================

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
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};
const addBlockButtonStyle: React.CSSProperties = {
  background: "var(--primary)",
  border: "none",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  transition: "var(--theme-transition)",
};
const blocksGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
  gap: "25px",
};
const blockCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: "16px",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  minHeight: "220px",
  border: "1px solid var(--border-color)",
  transition: "var(--theme-transition)",
};
const blockHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "15px",
  borderBottom: "1px solid var(--border-color)",
  paddingBottom: "10px",
};
const blockTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.15rem",
  color: "var(--text-main)",
  fontWeight: "700",
  transition: "var(--theme-transition)",
};
const pMaxBadgeStyle: React.CSSProperties = {
  background: "rgba(14, 165, 233, 0.15)",
  color: "var(--status-available)",
  padding: "4px 10px",
  borderRadius: "12px",
  fontSize: "0.8rem",
  fontWeight: "700",
  transition: "var(--theme-transition)",
};
const stationDropZoneStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  alignContent: "flex-start",
  padding: "10px",
  background: "var(--bg-app)",
  borderRadius: "8px",
  border: "1px dashed var(--border-color)",
  minHeight: "100px",
};
const emptyZoneTextStyle: React.CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.85rem",
  fontStyle: "italic",
  width: "100%",
  textAlign: "center",
  padding: "20px 0",
  transition: "var(--theme-transition)",
};
const unassignedSectionStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: "16px",
  padding: "25px",
  border: "1px solid var(--border-color)",
  transition: "var(--theme-transition)",
};
const unassignedTitleStyle: React.CSSProperties = {
  margin: "0 0 15px 0",
  fontSize: "1.2rem",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};
const unassignedDropZoneStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  padding: "15px",
  background: "var(--bg-app)",
  borderRadius: "12px",
  border: "1px dashed var(--border-color)",
  minHeight: "80px",
};
const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "6px",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "var(--text-muted)",
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
};
const submitButtonStyle: React.CSSProperties = {
  background: "var(--primary)",
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
};
const backButtonStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: "600",
  color: "var(--text-main)",
  transition: "var(--theme-transition)",
};
const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};
const modalContentStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  padding: "30px",
  borderRadius: "16px",
  width: "450px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
  border: "1px solid var(--border-color)",
};
