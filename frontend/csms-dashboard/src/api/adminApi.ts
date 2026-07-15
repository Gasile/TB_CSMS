// ============================================================================
// IMPORTS
// ============================================================================

import { fetchHasura } from "./hasuraClient";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Hashes a plain text password using the SHA-256 algorithm.
 */
async function hashPasswordSHA256(source: string): Promise<string> {
  const utf8 = new TextEncoder().encode(source);
  const hashBuffer = await crypto.subtle.digest("SHA-256", utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// USER MANAGEMENT (ADMIN)
// ============================================================================

/**
 * Fetches all registered users ordered alphabetically by their last name.
 */
export async function fetchAllUsers() {
  const query = `
    query GetAllUsers {
      Users(order_by: {last_name: asc}) {
        id
        first_name
        last_name
        email
        role
        UserBadges {
          Authorization {
            idToken
            badge_name
            status
          }
        }
      }
    }
  `;
  const data = await fetchHasura(query);
  return data.Users;
}

/**
 * Retrieves a specific user's basic profile details by their primary key.
 */
export async function fetchUserById(id: number) {
  const query = `
    query GetUserById($id: Int!) {
      Users_by_pk(id: $id) {
        id
        first_name
        last_name
        email
        role
      }
    }
  `;
  const data = await fetchHasura(query, { id });
  return data.Users_by_pk;
}

/**
 * Creates a new user record with a SHA-256 hashed password.
 */
export async function createNewUser(
  first: string,
  last: string,
  email: string,
  pass: string,
  role: string,
) {
  const hash = await hashPasswordSHA256(pass);
  const mutation = `
    mutation CreateUser($obj: Users_insert_input!) {
      insert_Users_one(object: $obj) { id }
    }
  `;
  const variables = {
    obj: {
      first_name: first,
      last_name: last,
      email: email,
      password_hash: hash,
      role: role,
    },
  };
  return await fetchHasura(mutation, variables);
}

/**
 * Updates the personal details and role of an existing user.
 */
export async function updateUserDetails(
  id: number,
  first: string,
  last: string,
  email: string,
  role: string,
) {
  const mutation = `
    mutation UpdateUserDetails($id: Int!, $first: String!, $last: String!, $email: String!, $role: String!) {
      update_Users_by_pk(
        pk_columns: {id: $id}, 
        _set: {first_name: $first, last_name: $last, email: $email, role: $role}
      ) { id }
    }
  `;
  return await fetchHasura(mutation, { id, first, last, email, role });
}

/**
 * Updates only the functional role of a specified user.
 */
export async function updateUserRole(userId: number, newRole: string) {
  const mutation = `
    mutation UpdateUserRole($userId: Int!, $role: String!) {
      update_Users_by_pk(pk_columns: {id: $userId}, _set: {role: $role}) { id }
    }
  `;
  return await fetchHasura(mutation, { userId, role: newRole });
}

/**
 * Deletes a user from the system and blocks their orphaned RFID badges.
 */
export async function deleteUser(userId: number) {
  const getBadgesQuery = `
    query GetUserBadgesForDelete($userId: Int!) {
      UserBadges(where: {user_id: {_eq: $userId}}) {
        authorization_id
      }
    }
  `;
  const badgesData = await fetchHasura(getBadgesQuery, { userId });
  const authIds = badgesData.UserBadges.map((ub: any) => ub.authorization_id);

  // If the user has badges, block them before removing user associations
  if (authIds.length > 0) {
    const blockMutation = `
      mutation BlockOrphanBadges($authIds: [Int!]!) {
        update_Authorizations(where: {id: {_in: $authIds}}, _set: {status: "Blocked"}) {
          affected_rows
        }
      }
    `;
    await fetchHasura(blockMutation, { authIds });
  }

  const deleteMutation = `
    mutation DeleteUserAndLinks($userId: Int!) {
      delete_UserBadges(where: {user_id: {_eq: $userId}}) { affected_rows }
      delete_Users_by_pk(id: $userId) { id }
    }
  `;
  return await fetchHasura(deleteMutation, { userId });
}

// ============================================================================
// BADGE MANAGEMENT (ADMIN)
// ============================================================================

/**
 * Fetches all authorizations, user-badge mappings, and users for the admin assignment panel.
 */
export async function fetchAdminBadgesData() {
  const query = `
    query GetAdminBadgesData {
      Authorizations(order_by: {id: desc}) {
        id
        idToken
        badge_name
        status
      }
      UserBadges {
        id
        user_id
        authorization_id
        User {
          id
          first_name
          last_name
        }
      }
      Users(order_by: {last_name: asc}) {
        id
        first_name
        last_name
      }
    }
  `;
  return await fetchHasura(query);
}

/**
 * Registers a new RFID badge authorization in the database.
 */
export async function adminCreateBadge(
  idToken: string,
  badgeName: string,
  status: string,
) {
  const currentTimestamp = new Date().toISOString();
  const mutation = `
    mutation AdminCreateAuthorization($idToken: citext!, $badgeName: String!, $status: String!, $date: timestamptz!) {
      insert_Authorizations_one(object: {
        idToken: $idToken,
        badge_name: $badgeName,
        idTokenType: "ISO14443",
        status: $status,
        createdAt: $date,
        updatedAt: $date
      }) { id }
    }
  `;
  return await fetchHasura(mutation, {
    idToken,
    badgeName,
    status,
    date: currentTimestamp,
  });
}

/**
 * Toggles a badge's status between 'Accepted' and 'Blocked'.
 */
export async function updateBadgeStatus(authId: number, currentStatus: string) {
  const newStatus = currentStatus === "Accepted" ? "Blocked" : "Accepted";
  const mutation = `
    mutation UpdateBadgeStatus($authId: Int!, $status: String!) {
      update_Authorizations_by_pk(pk_columns: {id: $authId}, _set: {status: $status}) { id }
    }
  `;
  return await fetchHasura(mutation, { authId, status: newStatus });
}

/**
 * Assigns an unmapped RFID badge to a specific user.
 */
export async function assignBadge(authId: number, newUserId: number) {
  const mutation = `
    mutation AssignNewBadge($authId: Int!, $newUserId: Int!) {
      insert_UserBadges_one(object: {authorization_id: $authId, user_id: $newUserId}) { id }
    }
  `;
  return await fetchHasura(mutation, { authId, newUserId });
}

/**
 * Reassigns an already mapped badge to a different user.
 */
export async function reassignBadge(ubId: number, newUserId: number) {
  const mutation = `
    mutation ReassignBadge($ubId: Int!, $newUserId: Int!) {
      update_UserBadges_by_pk(pk_columns: {id: $ubId}, _set: {user_id: $newUserId}) { id }
    }
  `;
  return await fetchHasura(mutation, { ubId, newUserId });
}

/**
 * Dissolves a user-badge relationship and sets the badge status to blocked.
 */
export async function unassignAndBlockBadge(ubId: number, authId: number) {
  const mutation = `
    mutation UnassignAndBlock($ubId: Int!, $authId: Int!) {
      delete_UserBadges_by_pk(id: $ubId) { id }
      update_Authorizations_by_pk(pk_columns: {id: $authId}, _set: {status: "Blocked"}) { id }
    }
  `;
  return await fetchHasura(mutation, { ubId, authId });
}

/**
 * Updates the identifier token or human-readable label of a specific badge.
 */
export async function updateBadgeDetails(
  authId: number,
  newToken: string,
  newName: string,
) {
  const mutation = `
    mutation UpdateBadgeDetails($authId: Int!, $newToken: citext!, $newName: String!) {
      update_Authorizations_by_pk(pk_columns: {id: $authId}, _set: {idToken: $newToken, badge_name: $newName}) { id }
    }
  `;
  return await fetchHasura(mutation, { authId, newToken, newName });
}

/**
 * Retrieves the profile of a badge alongside its complete historical charging sessions.
 */
export async function fetchBadgeDetailAndSessions(authId: number) {
  const query = `
    query GetBadgeDetails($authId: Int!) {
      Authorizations_by_pk(id: $authId) {
        id
        idToken
        badge_name
        status
        UserBadges {
          User {
            id
            first_name
            last_name
          }
        }
      }
      Transactions(where: {Authorization: {id: {_eq: $authId}}}, order_by: {id: desc}) {
        id
        transactionId
        ocppConnectionName
        ChargingStation { chargePointModel }
        isActive
        chargingState
        totalKwh
        startTime
        endTime
        is_legal
        overtime_start_timestamp
        User {
          first_name
          last_name
        }
      }
    }
  `;
  return await fetchHasura(query, { authId });
}

/**
 * Permanently deletes a badge, preventing deletion if charging transaction logs exist.
 */
export async function deleteBadge(authId: number) {
  const mutation = `
    mutation DeleteBadge($authId: Int!) {
      delete_UserBadges(where: {authorization_id: {_eq: $authId}}) { affected_rows }
      delete_Authorizations_by_pk(id: $authId) { id }
    }
  `;
  try {
    return await fetchHasura(mutation, { authId });
  } catch (err: any) {
    // Gracefully handle foreign key constraint conflicts when transaction logs depend on this badge
    if (
      err.message.includes("Foreign key violation") ||
      err.message.includes("constraint")
    ) {
      throw new Error(
        "Impossible de supprimer ce badge car il possède un historique de sessions de charge. Pour conserver l'historique, veuillez simplement le 'Bloquer'.",
      );
    }
    throw err;
  }
}

// ============================================================================
// TELEMETRY & GLOBAL DASHBOARD (ADMIN)
// ============================================================================

/**
 * Fetches overview metrics including active charging sessions and daily telemetry stats.
 */
export async function fetchAdminOverviewData(startOfDayIso: string) {
  const query = `
    query GetAdminOverview($startOfDay: timestamptz!) {
      ChargingStations {
        id
        ocppConnectionName
        isOnline
      }
      ActiveTransactions: Transactions(where: {isActive: {_eq: true}}, order_by: {startTime: desc}) {
        id
        transactionId
        ocppConnectionName
        ChargingStation { chargePointModel }
        startTime
        totalKwh
        chargingState
        is_legal
        overtime_start_timestamp
        User {
          first_name
          last_name
        }
        MeterValues(order_by: {timestamp: desc}, limit: 10) {
        timestamp  
        sampledValue
        }
      }
      TodayTransactions: Transactions(where: {startTime: {_gte: $startOfDay}}) {
        id
        totalKwh
      }
    }
  `;
  return await fetchHasura(query, { startOfDay: startOfDayIso });
}

/**
 * Retrieves energy meter values and transaction periods for telemetry plotting.
 */
export async function fetchAdminTelemetry(startDateIso: string) {
  const query = `
    query GetAdminTelemetry($startDate: timestamptz!) {
      Transactions(where: { _or: [ {endTime: {_gte: $startDate}}, {isActive: {_eq: true}} ] }) {
        id
        startTime
        endTime
      }
      MeterValues(where: {timestamp: {_gte: $startDate}}, order_by: {timestamp: asc}) {
        timestamp
        sampledValue
        transactionDatabaseId
      }
    }
  `;
  return await fetchHasura(query, { startDate: startDateIso });
}

/**
 * Retrieves all charging stations along with their current network status and active state.
 */
export async function fetchAllStationsWithStatus() {
  const query = `
    query GetAllStationsWithStatus {
      ChargingStations(order_by: {ocppConnectionName: asc}) {
        id
        ocppConnectionName
        isOnline
        chargePointModel
        protocol
        weight
        Transactions(where: {isActive: {_eq: true}}) {
          id
          chargingState
        }
      }
    }
  `;
  return await fetchHasura(query);
}

/**
 * Updates a station's weight metric, used for smart charging priority queue calculations.
 */
export async function updateStationWeight(stationId: number, weight: number) {
  const mutation = `
    mutation UpdateStationWeight($stationId: Int!, $weight: Int!) {
      update_ChargingStations_by_pk(pk_columns: {id: $stationId}, _set: {weight: $weight}) {
        id
        weight
      }
    }
  `;
  return await fetchHasura(mutation, { stationId, weight });
}

// ============================================================================
// UNKNOWN BADGES MANAGEMENT
// ============================================================================

/**
 * Fetches a list of unregistered RFID cards that attempted to swipe on any station.
 */
export async function fetchUnknownBadges() {
  const query = `
    query GetUnknownBadges {
      UnknownBadges(order_by: {last_seen: desc}) {
        id_token
        station_id
        last_seen
        attempt_count
      }
    }
  `;
  const data = await fetchHasura(query);
  return data.UnknownBadges;
}

/**
 * Removes a badge identifier from the log of unknown/unregistered cards.
 */
export async function deleteUnknownBadge(idToken: string) {
  const mutation = `
    mutation DeleteUnknownBadge($idToken: String!) {
      delete_UnknownBadges_by_pk(id_token: $idToken) {
        id_token
      }
    }
  `;
  return await fetchHasura(mutation, { idToken });
}
