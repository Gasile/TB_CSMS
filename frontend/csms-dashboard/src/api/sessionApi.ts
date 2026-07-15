// ============================================================================
// IMPORTS
// ============================================================================

import { fetchHasura } from "./hasuraClient";

// ============================================================================
// USER TELEMETRY & DASHBOARD DATA SERVICES
// ============================================================================

/**
 * Retrieves a general summary of a user's consumption metrics and recent session details.
 */
export async function fetchUserOverview(userId: number, cutoffDate: string) {
  const query = `
    query GetUserOverview($userId: Int!, $cutoffDate: date!) {
      user_charging_summary(where: {user_id: {_eq: $userId}}) {
        total_energy_kwh
        last_7_days_energy_kwh
      }
      user_daily_charging(where: {user_id: {_eq: $userId}, charge_date: {_gte: $cutoffDate}}) {
        charge_date
        daily_kwh
      }
      Transactions(where: {user_id: {_eq: $userId}}, order_by: {startTime: desc}, limit: 1) {
        id
        transactionId
        ocppConnectionName
        ChargingStation { chargePointModel }
        connectorId
        isActive
        chargingState
        startTime
        endTime
        totalKwh
      }
    }
  `;
  return await fetchHasura(query, { userId, cutoffDate });
}

/**
 * Fetches real-time energy meter values for plotting active or historical charging curves.
 */
export async function fetchLiveTelemetry(dbId: number) {
  const query = `
    query GetLiveTelemetry($dbId: Int!) {
      MeterValues(where: {transactionDatabaseId: {_eq: $dbId}}, order_by: {timestamp: asc}) {
        timestamp
        sampledValue
      }
    }
  `;
  return await fetchHasura(query, { dbId });
}

/**
 * Retrieves complete session parameters, technical event timelines, and meter values.
 */
export async function fetchSessionDetailData(dbId: number) {
  const query = `
    query GetSessionDetail($dbId: Int!) {
      Transactions(where: {id: {_eq: $dbId}}) {
        id
        transactionId
        ocppConnectionName
        connectorId
        ChargingStation { chargePointModel }
        Connector { connectorId }
        isActive
        chargingState
        startTime
        endTime
        stoppedReason
        totalKwh
        is_legal
        overtime_start_timestamp
        User {
          first_name
          last_name
        }
        Authorization {
          idToken
          badge_name
        }
        # Technical event records mapped to compile the admin audit logs
        TransactionEvents(order_by: {timestamp: asc}) {
          eventType
          timestamp
          triggerReason
          transactionInfo
        }
      }
      MeterValues(where: {transactionDatabaseId: {_eq: $dbId}}, order_by: {timestamp: asc}) {
        timestamp
        sampledValue
      }
    }
  `;
  return await fetchHasura(query, { dbId });
}

/**
 * Gathers aggregate statistics, active sessions, fallback targets, and heatmap metrics for the user dashboard.
 */
export async function fetchUserDashboardData(
  userId: number,
  cutoffDate: string,
) {
  const query = `
    query GetUserDashboard($userId: Int!, $cutoffDate: timestamptz!) {
      # 1. Lifetime user statistics (session count and overall accumulated energy)
      Transactions_aggregate(where: {user_id: {_eq: $userId}}) {
        aggregate {
          count
          sum {
            totalKwh
          }
        }
      }
      # 2. All currently active charging transactions owned by the user
      ActiveTransactions: Transactions(where: {user_id: {_eq: $userId}, isActive: {_eq: true}}, order_by: {startTime: desc}) {
        id
        transactionId
        ocppConnectionName
        ChargingStation { chargePointModel }
        isActive
        chargingState
        startTime
        endTime
        totalKwh
        is_legal
        overtime_start_timestamp
      }
      # 3. The most recent transaction to serve as a UI fallback state if no active charges exist
      LastTransaction: Transactions(where: {user_id: {_eq: $userId}}, order_by: {startTime: desc}, limit: 1) {
        id
        transactionId
        ocppConnectionName
        ChargingStation { chargePointModel }
        isActive
        chargingState
        startTime
        endTime
        totalKwh
        is_legal
        overtime_start_timestamp
      }
      # 4. Filtered historical logs used to populate the consumption heatmap
      RecentTransactions: Transactions(where: {user_id: {_eq: $userId}, startTime: {_gte: $cutoffDate}}) {
        startTime
        totalKwh
      }
      # 5. Live infrastructure status indicators to display charging station occupancy
      ChargingStations {
        isOnline
        Transactions(where: {isActive: {_eq: true}}) {
          id
        }
      }
    }
  `;
  return await fetchHasura(query, { userId, cutoffDate });
}
