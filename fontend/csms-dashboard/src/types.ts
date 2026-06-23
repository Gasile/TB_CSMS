// src/types.ts
export interface UserSession {
  id?: number; // Ajouté pour la gestion de liste
  firstName: string;
  lastName: string;
  email?: string;
  role: string;
}

// Interface pour l'affichage de la liste
export interface UserFromDB {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}
