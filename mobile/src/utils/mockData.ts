import { ClassificationType } from './colors';

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

export interface GlucoseReading {
  id: string;
  value: number;
  moment: 'Ayunas' | 'Antes de comer' | 'Postprandial' | 'Antes de dormir';
  time: string;
  date: string;
  classification: ClassificationType;
}

export const MOCK_PATIENT_READINGS: GlucoseReading[] = [
  {
    id: '1',
    value: 124,
    moment: 'Postprandial',
    time: 'Hoy, 14:30',
    date: '24 Oct, 2024',
    classification: 'Normal',
  },
  {
    id: '2',
    value: 112,
    moment: 'Ayunas',
    time: 'Hoy, 08:30',
    date: '24 Oct, 2024',
    classification: 'Normal',
  },
  {
    id: '3',
    value: 68,
    moment: 'Antes de dormir',
    time: 'Ayer, 23:15',
    date: '23 Oct, 2024',
    classification: 'Riesgo Hipo',
  },
  {
    id: '4',
    value: 195,
    moment: 'Postprandial',
    time: 'Ayer, 15:00',
    date: '23 Oct, 2024',
    classification: 'Riesgo Hiper',
  },
];

export interface PatientSummary {
  id: string;
  code: string;
  name: string;
  initials: string;
  lastReading: number;
  classification: ClassificationType;
  lastReadingTime: string;
  alertText?: string;
  isUrgent?: boolean;
}

export const MOCK_DOCTOR_PATIENTS: PatientSummary[] = [
  {
    id: 'p1',
    code: '#P-0104',
    name: 'Carlos Méndez',
    initials: 'CM',
    lastReading: 124,
    classification: 'Normal',
    lastReadingTime: 'Hoy 14:30',
  },
  {
    id: 'p2',
    code: '#P-0089',
    name: 'Elena Soto',
    initials: 'ES',
    lastReading: 62,
    classification: 'Riesgo Hipo',
    lastReadingTime: 'Hoy 13:10',
    alertText: 'Hoy 13:10 · Alerta Activa',
    isUrgent: true,
  },
  {
    id: 'p3',
    code: '#P-0215',
    name: 'Jorge Ramírez',
    initials: 'JR',
    lastReading: 215,
    classification: 'Riesgo Hiper',
    lastReadingTime: 'Hoy 11:45',
    alertText: 'Hoy 11:45 · Alerta Activa',
    isUrgent: true,
  },
  {
    id: 'p4',
    code: '#P-0142',
    name: 'Lucía Valentín',
    initials: 'LV',
    lastReading: 105,
    classification: 'Normal',
    lastReadingTime: 'Ayer 21:00',
  },
  {
    id: 'p5',
    code: '#P-0077',
    name: 'Roberto Gómez',
    initials: 'RG',
    lastReading: 118,
    classification: 'Normal',
    lastReadingTime: 'Ayer 19:30',
  },
];

export interface DoctorAlert {
  id: string;
  patientName: string;
  time: string;
  classification: ClassificationType;
  value: number;
  description: string;
}

export const MOCK_DOCTOR_ALERTS: DoctorAlert[] = [
  {
    id: 'a1',
    patientName: 'Elena Soto',
    time: 'Hoy, 13:10',
    classification: 'Riesgo Hipo',
    value: 62,
    description: 'Episodio de hipoglucemia preprandial',
  },
  {
    id: 'a2',
    patientName: 'Jorge Ramírez',
    time: 'Hoy, 11:45',
    classification: 'Riesgo Hiper',
    value: 215,
    description: 'Hiperglucemia postprandial marcada',
  },
  {
    id: 'a3',
    patientName: 'Marcos Peña',
    time: 'Ayer, 22:30',
    classification: 'Riesgo Hipo',
    value: 58,
    description: 'Hipoglucemia nocturna recurrente',
  },
  {
    id: 'a4',
    patientName: 'Andrea Castro',
    time: 'Ayer, 16:15',
    classification: 'Riesgo Hiper',
    value: 240,
    description: 'Pico glucémico severo',
  },
];

export interface AdminRequest {
  id: string;
  name: string;
  role: 'Paciente' | 'Médico';
  specialtyOrDiagnosis: string;
  licenseNumber?: string;
  institution?: string;
  email: string;
  date: string;
  timeAgo: string;
  avatarUrl?: string;
  initials: string;
  status: 'Pendiente' | 'Aprobado' | 'Rechazado';
}

export const MOCK_ADMIN_REQUESTS: AdminRequest[] = [
  {
    id: 'req1',
    name: 'Dr. Alejandro Morales',
    role: 'Médico',
    specialtyOrDiagnosis: 'Médico Endocrinólogo',
    licenseNumber: 'MN 142.890',
    institution: 'Hospital Central Metropolitano · Diabetología',
    email: 'alejandro.morales@hospitalcentral.org',
    date: '24 de Octubre, 2024 · 10:15 AM',
    timeAgo: 'Recibido hace 1 hora',
    initials: 'AM',
    status: 'Pendiente',
  },
  {
    id: 'req2',
    name: 'Dra. Valeria Ramos',
    role: 'Médico',
    specialtyOrDiagnosis: 'Médica General',
    licenseNumber: 'MP 38.104',
    institution: 'Centro Médico Norte',
    email: 'valeria.ramos@salud.org',
    date: '24 de Octubre, 2024 · 08:30 AM',
    timeAgo: 'Recibido hace 3 horas',
    initials: 'VR',
    status: 'Pendiente',
  },
  {
    id: 'req3',
    name: 'Lucía Domínguez',
    role: 'Paciente',
    specialtyOrDiagnosis: 'Paciente DM1 · Telemonitoreo continuo',
    email: 'lucia.dominguez@email.com',
    date: '23 de Octubre, 2024 · 16:20 PM',
    timeAgo: 'Recibido ayer',
    initials: 'LD',
    status: 'Pendiente',
  },
  {
    id: 'req4',
    name: 'Federico Gómez',
    role: 'Paciente',
    specialtyOrDiagnosis: 'Paciente DM2 · Registro basal y posprandial',
    email: 'federico.g@email.com',
    date: '23 de Octubre, 2024 · 14:10 PM',
    timeAgo: 'Recibido ayer',
    initials: 'FG',
    status: 'Pendiente',
  },
  {
    id: 'req5',
    name: 'Mariana Sosa',
    role: 'Paciente',
    specialtyOrDiagnosis: 'Paciente Gestacional · Seguimiento diario',
    email: 'mariana.sosa@email.com',
    date: '22 de Octubre, 2024 · 11:00 AM',
    timeAgo: 'Recibido hace 2 días',
    initials: 'MS',
    status: 'Pendiente',
  },
];

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'Paciente' | 'Médico' | 'Admin';
  status: 'Activo' | 'Inactivo';
  initials: string;
}

export const MOCK_ADMIN_USERS: AdminUser[] = [
  {
    id: 'u1',
    name: 'Carlos Méndez',
    email: 'carlos.mendez@email.com',
    role: 'Paciente',
    status: 'Activo',
    initials: 'CM',
  },
  {
    id: 'u2',
    name: 'Dra. Carmen Silva',
    email: 'c.silva@clinicacentral.com',
    role: 'Médico',
    status: 'Activo',
    initials: 'CS',
  },
  {
    id: 'u3',
    name: 'Elena Soto',
    email: 'elena.soto@email.com',
    role: 'Paciente',
    status: 'Activo',
    initials: 'ES',
  },
  {
    id: 'u4',
    name: 'Dr. Martín Paz',
    email: 'm.paz@hospital.org',
    role: 'Médico',
    status: 'Inactivo',
    initials: 'MP',
  },
  {
    id: 'u5',
    name: 'Mariana Rivas',
    email: 'admin.mrivas@glucotracker.org',
    role: 'Admin',
    status: 'Activo',
    initials: 'MR',
  },
];

export interface AuditEvent {
  id: string;
  time: string;
  badge: 'Paciente' | 'Sistema Automático' | 'Médico' | 'Administrador';
  title: string;
  description: string;
  detail: string;
  statusBadge: string;
  type: 'access' | 'change' | 'alert' | 'clinical';
}

export const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'aud1',
    time: '14:35',
    badge: 'Paciente',
    title: 'Carlos Méndez',
    description: 'Registro de toma de glucosa: 124 mg/dL',
    detail: 'ID Sesión: #TK-84912',
    statusBadge: 'Normal',
    type: 'clinical',
  },
  {
    id: 'aud2',
    time: '13:12',
    badge: 'Sistema Automático',
    title: 'Motor de Telemetría Clínica',
    description: 'Generación de alerta de riesgo hipo para Elena Soto',
    detail: 'Disparador: Algoritmo predictivo CGM',
    statusBadge: 'Prioridad Alta',
    type: 'alert',
  },
  {
    id: 'aud3',
    time: '11:45',
    badge: 'Médico',
    title: 'Dra. Carmen Silva',
    description: 'Consulta de ficha clínica y descarga de reporte de Elena Soto',
    detail: 'Acción: Exportación PDF Clínico',
    statusBadge: 'Autorizado',
    type: 'access',
  },
  {
    id: 'aud4',
    time: '10:30',
    badge: 'Administrador',
    title: 'Mariana Rivas',
    description: 'Aprobación de solicitud de registro para Dr. Alejandro Morales',
    detail: 'Credencial: Matrícula #94821-M',
    statusBadge: 'Completado',
    type: 'change',
  },
  {
    id: 'aud5',
    time: '09:15',
    badge: 'Médico',
    title: 'Dr. Martín Paz',
    description: 'Modificación de estado de cuenta a \'Inactivo\'',
    detail: 'Objetivo: Paciente suspendido temporal',
    statusBadge: 'Regulado',
    type: 'change',
  },
  {
    id: 'aud6',
    time: '08:30',
    badge: 'Paciente',
    title: 'Carlos Méndez',
    description: 'Inicio de sesión exitoso mediante autenticación biométrica',
    detail: 'IP: 192.168.1.45 (iOS App)',
    statusBadge: '2FA Válido',
    type: 'access',
  },
];

