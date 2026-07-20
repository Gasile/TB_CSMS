// ============================================================================
// IMPORTS
// ============================================================================

import { fetchHasura } from "./hasuraClient";

// ============================================================================
// PROFILE & BADGE MANAGEMENT SERVICES
// ============================================================================

/**
 * Updates the basic profile fields and notification preferences of the currently authenticated user.
 */
export async function updateMyProfile(
  id: number,
  first: string,
  last: string,
  email: string,
  userNotifications: boolean,
  adminNotifications: boolean,
) {
  const mutation = `
    mutation UpdateMyProfile(
      $id: Int!, 
      $first: String!, 
      $last: String!, 
      $email: String!, 
      $userNotifications: Boolean!, 
      $adminNotifications: Boolean!
    ) {
      update_Users_by_pk(
        pk_columns: {id: $id}, 
        _set: {
          first_name: $first, 
          last_name: $last, 
          email: $email,
          user_notifications: $userNotifications,
          admin_notifications: $adminNotifications
        }
      ) { id }
    }
  `;
  return await fetchHasura(mutation, {
    id,
    first,
    last,
    email,
    userNotifications,
    adminNotifications,
  });
}

/**
 * Fetches all active RFID badges associated with a specific user.
 */
export async function fetchUserBadges(userId: number) {
  const query = `
    query GetUserBadges($userId: Int!) {
      UserBadges(where: {user_id: {_eq: $userId}}) {
        id
        Authorization {
          id
          idToken
          badge_name
          status
        }
      }
    }
  `;
  const data = await fetchHasura(query, { userId });
  return data.UserBadges;
}

/**
 * Associates an RFID token with a user, registering it if new or reactivating it if orphaned.
 */
export async function linkNewBadge(
  userId: number,
  idToken: string,
  badgeName: string,
) {
  const currentTimestamp = new Date().toISOString();
  let authId: number;

  // Verify if the token already exists in the system database
  const checkQuery = `
    query CheckExistingBadge($idToken: citext!) {
      Authorizations(where: {idToken: {_eq: $idToken}}) { 
        id 
        UserBadges { id } 
      }
    }
  `;
  const checkData = await fetchHasura(checkQuery, { idToken });

  if (checkData.Authorizations && checkData.Authorizations.length > 0) {
    const existingBadge = checkData.Authorizations[0];
    authId = existingBadge.id;

    // Prevent linkage if the existing badge is actively associated with another account
    if (existingBadge.UserBadges && existingBadge.UserBadges.length > 0) {
      throw new Error(
        "Action impossible : Ce badge est déjà assigné à un autre utilisateur !",
      );
    }

    // Reactivate and rename the orphaned authorization record
    const reactivateMutation = `
      mutation ReactivateBadge($authId: Int!, $badgeName: String!) {
        update_Authorizations_by_pk(pk_columns: {id: $authId}, _set: {status: "Accepted", badge_name: $badgeName}) { id }
      }
    `;
    await fetchHasura(reactivateMutation, { authId, badgeName });
  } else {
    // Register a brand new authorization record for the scanned physical badge
    const createAuthMutation = `
      mutation CreateAuthorization($idToken: citext!, $badgeName: String!, $date: timestamptz!) {
        insert_Authorizations_one(object: {
          idToken: $idToken,
          badge_name: $badgeName,
          idTokenType: "ISO14443",
          status: "Accepted",
          createdAt: $date,
          updatedAt: $date
        }) { id }
      }
    `;
    const authData = await fetchHasura(createAuthMutation, {
      idToken,
      badgeName,
      date: currentTimestamp,
    });
    authId = authData.insert_Authorizations_one.id;
  }

  // Bind the validated authorization reference to the user's account profile
  const linkMutation = `
    mutation LinkBadgeToUser($userId: Int!, $authId: Int!) {
      insert_UserBadges_one(object: {
        user_id: $userId,
        authorization_id: $authId
      }) { id }
    }
  `;
  await fetchHasura(linkMutation, { userId, authId });
}

/**
 * Updates the friendly display label of a specific user badge.
 */
export async function updateMyBadgeName(authId: number, newName: string) {
  const mutation = `
    mutation UpdateBadgeName($authId: Int!, $newName: String!) {
      update_Authorizations_by_pk(pk_columns: {id: $authId}, _set: {badge_name: $newName}) { id }
    }
  `;
  return await fetchHasura(mutation, { authId, newName });
}

/**
 * Retrieves the complete list of historical and active charging sessions for a user.
 */
export async function fetchUserSessions(userId: number) {
  const query = `
    query GetMyTransactions($userId: Int!) {
      Transactions(where: {user_id: {_eq: $userId}}, order_by: {id: desc}) {
        id
        transactionId
        isActive
        chargingState
        totalKwh
        stoppedReason
        ocppConnectionName
        ChargingStation { chargePointModel }
        startTime
        is_legal
        overtime_start_timestamp
      }
    }
  `;
  const data = await fetchHasura(query, { userId });
  return data.Transactions;
}
