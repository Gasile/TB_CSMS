import { fetchHasura } from "./hasuraClient";

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
        # NOUVEAU : On récupère l'historique technique pour le journal Admin
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

export async function fetchUserDashboardData(
  userId: number,
  cutoffDate: string,
) {
  const query = `
    query GetUserDashboard($userId: Int!, $cutoffDate: timestamptz!) {
      # 1. Statistiques globales de l'utilisateur
      Transactions_aggregate(where: {user_id: {_eq: $userId}}) {
        aggregate {
          count
          sum {
            totalKwh
          }
        }
      }
      # 2. TOUTES les sessions de charge en cours (actives)
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
      # 3. La session la plus récente globale (sert de fallback si rien n'est en cours)
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
      # 4. Les sessions récentes pour générer la Heatmap
      RecentTransactions: Transactions(where: {user_id: {_eq: $userId}, startTime: {_gte: $cutoffDate}}) {
        startTime
        totalKwh
      }
      # 5. L'état en direct de la flotte
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
