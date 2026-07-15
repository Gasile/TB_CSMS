// ============================================================================
// IMPORTS
// ============================================================================

import { fetchHasura } from "./hasuraClient";

// ============================================================================
// CHARGING STATION SERVICES
// ============================================================================

/**
 * Fetches all registered charging stations in the network, ordered by their primary key.
 */
export async function fetchAllStations() {
  const query = `
    query GetChargingStations {
      ChargingStations(order_by: {id: asc}) {
        id
        ocppConnectionName
        isOnline
        chargePointVendor
        chargePointModel
      }
    }
  `;
  const data = await fetchHasura(query);
  return data.ChargingStations;
}

/**
 * Retrieves all transaction history and active sessions for a specific station.
 */
export async function fetchStationTransactions(connectionName: string) {
  const query = `
    query GetStationTransactions($connectionName: String!) {
      Transactions(where: {ocppConnectionName: {_eq: $connectionName}}, order_by: {id: desc}) {
        ChargingStation { chargePointModel }
        id
        transactionId
        isActive
        chargingState
        totalKwh
        stoppedReason
        User {
          first_name
          last_name
          email
        }
        startTime
        is_legal
        overtime_start_timestamp
      }
    }
  `;
  const data = await fetchHasura(query, { connectionName });
  return data.Transactions;
}

/**
 * Fetches the registration and connection details of a single charging station by its ID.
 */
export async function fetchStationById(id: number) {
  const query = `
    query GetStationById($id: Int!) {
      ChargingStations_by_pk(id: $id) {
        id
        ocppConnectionName
        isOnline
        chargePointVendor
        chargePointModel
      }
    }
  `;
  const data = await fetchHasura(query, { id });
  return data.ChargingStations_by_pk;
}
