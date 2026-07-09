import { fetchHasura } from "./hasuraClient";

/**
 * Récupère tous les blocs de puissance avec leurs bornes associées
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
 * Crée un nouveau bloc de puissance
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
 * Supprime un bloc de puissance
 */
export async function deletePowerBlock(id: number) {
  const mutation = `
    mutation DeletePowerBlock($id: Int!) {
      # Optionnel selon tes contraintes Hasura : on remet d'abord à null les bornes rattachées
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
 * Vérifie en temps réel si une borne possède une transaction active
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
 * Met à jour le bloc de puissance de la borne
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
