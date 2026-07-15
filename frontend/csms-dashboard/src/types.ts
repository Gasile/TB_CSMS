// ============================================================================
// DATA MODELS & INTERFACES
// ============================================================================

/**
 * Represents the active session payload for an authenticated user.
 */
export interface UserSession {
  id?: number; // Included to facilitate session and user list management
  firstName: string;
  lastName: string;
  email?: string;
  role: string;
}

/**
 * Represents the raw database user structure fetched from the database backend.
 */
export interface UserFromDB {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}
