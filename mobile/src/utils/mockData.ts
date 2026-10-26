// Perfiles de ejemplo del modo simulado (EXPO_PUBLIC_USE_MOCK=true). Con el modo apagado este módulo NO se carga:
// App.tsx lo requiere solo dentro de la rama USE_MOCK. Los demás datos de ejemplo viven junto a su servicio.
import type { UserProfile, UserRole } from './tipos';

export const CURRENT_USERS: Record<UserRole, UserProfile> = {
  paciente: {
    id: 'P-0104',
    name: 'Carlos Méndez',
    email: 'carlos@email.com',
    role: 'paciente',
    phone: '+56 9 8452 1190',
    initials: 'CM',
    badge: 'Paciente',
  },
  medico: {
    id: 'M-0042',
    name: 'Dra. Carmen Silva',
    email: 'doctor@email.com',
    role: 'medico',
    phone: '+34 600 293 881',
    initials: 'CS',
    badge: 'Médico',
    subtitle: 'Endocrinología · Clínica Santa María',
  },
  admin: {
    id: 'A-0001',
    name: 'Mariana Rivas',
    email: 'admin@email.com',
    role: 'admin',
    phone: '+56 9 7721 4400',
    initials: 'MR',
    badge: 'Administrador',
    subtitle: 'Seguridad y Control de Acceso',
  },
};
