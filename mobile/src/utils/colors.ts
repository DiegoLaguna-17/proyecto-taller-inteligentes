export const COLORS = {
  // Main Canvas & Surfaces
  background: '#F8FAFC',
  backgroundWhite: '#FFFFFF',
  surfaceLight: '#F0F5FC',
  surfaceBlueSubtle: '#F4F7FC',
  surfaceSoftCard: '#EFF6FF',
  surfaceMuted: '#F1F5F9',
  surfaceInput: '#F0F4F9',

  // Primary Action
  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  primaryLight: '#EBF2FA',
  primaryBorder: '#BFDBFE',
  primaryDark: '#1E40AF',

  // Text Colors
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textLight: '#CBD5E1',
  textWhite: '#FFFFFF',
  textBlue: '#2563EB',

  // Borders & Dividers
  border: '#E2E8F0',
  borderLight: '#EDF2F7',
  borderCard: '#EBF0F5',

  // Classification States (ONLY for glucose classification)
  normal: '#10B981',
  normalBg: '#DCFCE7',
  normalText: '#15803D',
  normalBorder: '#BBF7D0',

  riesgoHipo: '#D97706',
  riesgoHipoBg: '#FEF3C7',
  riesgoHipoText: '#92400E',
  riesgoHipoBorder: '#FDE68A',

  riesgoHiper: '#EF4444',
  riesgoHiperBg: '#FEE2E2',
  riesgoHiperText: '#B91C1C',
  riesgoHiperBorder: '#FECACA',

  // Accents & Shadows
  badgeActiveBg: '#DBEAFE',
  badgeActiveText: '#1D4ED8',
  shadowColor: '#000000',
};

export type ClassificationType = 'Normal' | 'Riesgo Hipo' | 'Riesgo Hiper';

