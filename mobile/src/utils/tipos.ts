// Tipos compartidos de sesión y perfil de pantalla (sin datos). Los perfiles de ejemplo del modo simulado viven aparte.

export type UserRole = 'paciente' | 'medico' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  initials: string;
  avatarUrl?: string;
  badge?: string;
  subtitle?: string;
}
