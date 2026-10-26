// Configuración de la capa de servicios (design.md § App móvil: integración).
// Expo solo inlinea las variables EXPO_PUBLIC_* escritas literalmente (process.env.EXPO_PUBLIC_X).
// En un celular `localhost` es el propio celular: usar la IP local de la PC (ver mobile/README.md).

import { normalizarModo, type ModoAnimacion } from './revelado.ts';

/**
 * Normaliza una URL base: sin espacios, sin barras finales y SIN el sufijo /api (la app ya agrega /api/...).
 * Copiar la URL del front web (que termina en /api) hacía pedir /api/api/login (404).
 */
export function normalizarBase(valor: string | undefined): string {
  return (valor ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '')
    .replace(/\/+$/, '');
}

/** Backend de negocio (login, glucosa, historial, paciente). Vacío = no configurado. */
export const API_BASE_URL = normalizarBase(process.env.EXPO_PUBLIC_API_URL);

/** Servicio NLP (chatbot): URL propia, distinta de la del backend. Vacío = no configurado. */
export const NLP_API_BASE_URL = normalizarBase(process.env.EXPO_PUBLIC_NLP_URL);

/**
 * Animación de las respuestas del chatbot: 'escritura' (por palabras, con «escribiendo…») o 'inmediato' (todo de
 * golpe). Se sobrescribe con EXPO_PUBLIC_CHAT_ANIMACION; cualquier valor distinto de «inmediato» es 'escritura'.
 * Con «reducir movimiento» activado en el sistema siempre es inmediato (ver ChatBot).
 */
export const CHAT_ANIMACION: ModoAnimacion = normalizarModo(process.env.EXPO_PUBLIC_CHAT_ANIMACION);

/** Modo simulado: credenciales fijas y datos locales, sin llamar a la red. Solo "true" lo activa. */
export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';
