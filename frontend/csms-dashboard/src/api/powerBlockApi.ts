// ============================================================================
// IMPORTS
// ============================================================================

import { fetchHasura } from "./hasuraClient";

// ============================================================================
// POWER BLOCK MANAGEMENT & OPERATIONS
// ============================================================================

/**
 * Fetches all physical power blocks alongside all charging stations to map their assignments.
 */
export async function fetchPowerBlocksWithStations() {
  const query = `
    query GetPowerBlocksWithStations {
      PowerBlocks(order_by: { name: asc }) {
        id
        name
        max_v
        max_a
        n_phase
        max_kw
      }
      ChargingStations(order_by: { ocppConnectionName: asc }) {
        id
        ocppConnectionName
        chargePointModel
        power_block_id
        Transactions(where: {isActive: {_eq: true}}) {
          id
        }
      }
    }
  `;
  return await fetchHasura(query);
}

/**
 * Creates a new physical power block for smart charging limitation.
 */
export async function createPowerBlock(
  name: string,
  maxV: number,
  maxA: number,
  nPhase: number,
  maxKw: number,
) {
  const mutation = `
    mutation CreatePowerBlock($name: String!, $maxV: numeric!, $maxA: numeric!, $nPhase: Int!, $maxKw: numeric!) {
      insert_PowerBlocks_one(object: { name: $name, max_v: $maxV, max_a: $maxA, n_phase: $nPhase, max_kw: $maxKw }) {
        id
      }
    }
  `;
  return await fetchHasura(mutation, { name, maxV, maxA, nPhase, maxKw });
}

/**
 * Updates the configurations and limits of an existing power block.
 */
export async function updatePowerBlock(
  id: number,
  name: string,
  maxV: number,
  maxA: number,
  nPhase: number,
  maxKw: number,
) {
  const mutation = `
    mutation UpdatePowerBlock($id: Int!, $name: String!, $maxV: numeric!, $maxA: numeric!, $nPhase: Int!, $maxKw: numeric!) {
      update_PowerBlocks_by_pk(pk_columns: { id: $id }, _set: { name: $name, max_v: $maxV, max_a: $maxA, n_phase: $nPhase, max_kw: $maxKw }) {
        id
      }
    }
  `;
  return await fetchHasura(mutation, { id, name, maxV, maxA, nPhase, maxKw });
}

/**
 * Deletes a power block after safe detachment of its currently associated charging stations.
 */
export async function deletePowerBlock(id: number) {
  const mutation = `
    mutation DeletePowerBlock($id: Int!) {
      # Safely unassign all connected charging stations before removing the power block entity
      update_ChargingStations(where: { power_block_id: { _eq: $id } }, _set: { power_block_id: null }) {
        affected_rows
      }
      delete_PowerBlocks_by_pk(id: $id) {
        id
      }
    }
  `;
  return await fetchHasura(mutation, { id });
}

/**
 * Performs a real-time check to see if a specific station has an ongoing charging transaction.
 */
export async function checkStationActiveStatus(stationId: number) {
  const query = `
    query CheckStationStatus($stationId: Int!) {
      ChargingStations_by_pk(id: $stationId) {
        Transactions(where: {isActive: {_eq: true}}) {
          id
        }
      }
    }
  `;
  const result = await fetchHasura(query, { stationId });
  const transactions = result?.ChargingStations_by_pk?.Transactions || [];
  return transactions.length > 0;
}

/**
 * Updates the power block assignment of a charging station.
 */
export async function updateStationPowerBlock(
  stationId: number,
  powerBlockId: number | null,
) {
  const mutation = `
    mutation UpdateStationPowerBlock($stationId: Int!, $powerBlockId: Int) {
      update_ChargingStations_by_pk(pk_columns: { id: $stationId }, _set: { power_block_id: $powerBlockId }) {
        id
        power_block_id
      }
    }
  `;
  return await fetchHasura(mutation, { stationId, powerBlockId });
}
