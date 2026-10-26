// Cálculos del historial en el cliente (periodo, promedio, desviación, tiempo en rango). Funciones puras.
import type { RegistroHistorial } from './glucosa.ts';
import { GLUCOSA_HIPO_MAX, RANGO_META_MAX, RANGO_META_MIN, enRangoMeta } from './umbrales.ts';

export type Periodo = 'Diario' | 'Semanal' | 'Mensual';

/** Ventana de cada periodo, en días contando hoy: Diario 1, Semanal 7, Mensual 30. */
export const DIAS_PERIODO: Record<Periodo, number> = { Diario: 1, Semanal: 7, Mensual: 30 };

const dos = (n: number) => String(n).padStart(2, '0');
const fechaStr = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

/** Rango [desde, hasta] (YYYY-MM-DD, inclusive) del periodo que termina en `hoy` (hora local). */
export function rangoPeriodo(periodo: Periodo, hoy: Date): { desde: string; hasta: string } {
  const atras = DIAS_PERIODO[periodo] - 1;
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - atras);
  return { desde: fechaStr(desde), hasta: fechaStr(hoy) };
}

/** Registros del periodo, en el mismo orden recibido. Ignora fechas futuras. */
export function filtrarPorPeriodo(registros: RegistroHistorial[], periodo: Periodo, hoy: Date): RegistroHistorial[] {
  const { desde, hasta } = rangoPeriodo(periodo, hoy);
  return registros.filter((r) => r.fecha.slice(0, 10) >= desde && r.fecha.slice(0, 10) <= hasta);
}

function valores(registros: RegistroHistorial[]): number[] {
  return registros.map((r) => r.nivelGlucosa).filter((v): v is number => typeof v === 'number');
}

/** Promedio redondeado (mg/dL); null si no hay lecturas. */
export function promedio(registros: RegistroHistorial[]): number | null {
  const v = valores(registros);
  if (v.length === 0) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

/** Desviación estándar poblacional redondeada; null si no hay lecturas. */
export function desviacion(registros: RegistroHistorial[]): number | null {
  const v = valores(registros);
  if (v.length === 0) return null;
  const media = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.round(Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / v.length));
}

/** Porcentaje de lecturas dentro de [min, max] (por defecto el rango meta de umbrales.ts); null si no hay lecturas. */
export function porcentajeEnRango(
  registros: RegistroHistorial[],
  min = RANGO_META_MIN,
  max = RANGO_META_MAX,
): number | null {
  const v = valores(registros);
  if (v.length === 0) return null;
  return Math.round((v.filter((x) => x >= min && x <= max).length / v.length) * 100);
}

export type ClasificacionVista = 'Normal' | 'Riesgo Hipo' | 'Riesgo Hiper';

/** Clasificación para mostrar: usa la alerta registrada; sin alerta, solo < GLUCOSA_HIPO_MAX se marca como hipoglucemia. */
export function clasificacionDeRegistro(r: RegistroHistorial): ClasificacionVista {
  const alerta = (r.tipo_alerta ?? '').toLowerCase();
  if (alerta.includes('hiper')) return 'Riesgo Hiper';
  if (alerta.includes('hipo')) return 'Riesgo Hipo';
  if (typeof r.nivelGlucosa === 'number' && r.nivelGlucosa < GLUCOSA_HIPO_MAX) return 'Riesgo Hipo';
  return 'Normal';
}

const ETIQUETAS_MOMENTO: Record<string, string> = {
  AYUNAS: 'Ayunas',
  'DESPUES DE COMER': 'Después de comer',
  'ANTES DE DORMIR': 'Antes de dormir',
};

/** Texto del momento para la interfaz (la base lo guarda en mayúsculas y sin tildes). */
export function etiquetaMomento(momento: string | null | undefined): string {
  if (!momento) return 'Sin momento';
  const clave = momento.trim().toUpperCase();
  return ETIQUETAS_MOMENTO[clave] ?? momento.charAt(0).toUpperCase() + momento.slice(1).toLowerCase();
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS_LETRA = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/** "24 Oct" a partir de YYYY-MM-DD. */
export function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.slice(0, 10).split('-').map(Number);
  return `${d} ${MESES[(m ?? 1) - 1] ?? ''}`.trim();
}

/** Etiqueta del eje X: letra del día de la semana + número ("X23"). */
export function etiquetaDia(fecha: string): string {
  const [a, m, d] = fecha.slice(0, 10).split('-').map(Number);
  return `${DIAS_LETRA[new Date(a, (m ?? 1) - 1, d).getDay()]}${d}`;
}

/** "17 Oct - 24 Oct, 2024" para el selector de periodo. */
export function etiquetaRango(periodo: Periodo, hoy: Date): string {
  const { desde, hasta } = rangoPeriodo(periodo, hoy);
  if (desde === hasta) return `${fechaCorta(hasta)}, ${hoy.getFullYear()}`;
  return `${fechaCorta(desde)} - ${fechaCorta(hasta)}, ${hoy.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Resúmenes de la pantalla de Inicio (funciones puras)
// ---------------------------------------------------------------------------

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** "Jueves, 24 de Octubre" */
export function fechaLarga(hoy: Date): string {
  return `${DIAS_SEMANA[hoy.getDay()]}, ${hoy.getDate()} de ${MESES_LARGOS[hoy.getMonth()]}`;
}

function aFecha(fecha: string, hora: string | null): Date {
  const [a, m, d] = fecha.slice(0, 10).split('-').map(Number);
  const [h, min] = (hora ?? '00:00').split(':').map(Number);
  return new Date(a, (m ?? 1) - 1, d, h || 0, min || 0);
}

/** "Hace 2 horas (08:30)" a partir de la fecha y hora (locales) de la lectura. */
export function haceCuanto(fecha: string, hora: string | null, ahora: Date): string {
  const minutos = Math.floor((ahora.getTime() - aFecha(fecha, hora).getTime()) / 60000);
  const hhmm = hora ? ` (${hora.slice(0, 5)})` : '';
  if (minutos < 1) return `Hace un momento${hhmm}`;
  if (minutos < 60) return `Hace ${minutos} min${hhmm}`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}${hhmm}`;
  const dias = Math.floor(horas / 24);
  return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}${hhmm}`;
}

/** "Hoy, 08:30" | "Ayer, 23:15" | "5 Oct, 14:00" */
export function etiquetaFechaHora(fecha: string, hora: string | null, hoy: Date): string {
  const f = fecha.slice(0, 10);
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  const dia = f === fechaStr(hoy) ? 'Hoy' : f === fechaStr(ayer) ? 'Ayer' : fechaCorta(f);
  return hora ? `${dia}, ${hora.slice(0, 5)}` : dia;
}

export interface ResumenInicio {
  ultima: RegistroHistorial | null;
  /** Las dos lecturas anteriores a la última. */
  anteriores: RegistroHistorial[];
  deHoy: RegistroHistorial[];
  promedioHoy: number | null;
  /** null = sin tomas hoy; true = todas dentro del rango meta; false = alguna fuera. */
  enRangoHoy: boolean | null;
  /** Lecturas con alerta o hipoglucemia en los últimos 3 días (hoy incluido). */
  fueraDeRango3d: number;
}

/** Resumen para Inicio. `registros` llega con los más recientes primero (orden del backend). */
export function resumenInicio(registros: RegistroHistorial[], hoy: Date): ResumenInicio {
  const validos = registros.filter((r) => r.nivelGlucosa !== null && r.fecha.slice(0, 10) <= fechaStr(hoy));
  const deHoy = filtrarPorPeriodo(validos, 'Diario', hoy);
  const desde3 = fechaStr(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 2));
  const valoresHoy = deHoy.map((r) => r.nivelGlucosa as number);
  return {
    ultima: validos[0] ?? null,
    anteriores: validos.slice(1, 3),
    deHoy,
    promedioHoy: promedio(deHoy),
    enRangoHoy: valoresHoy.length === 0 ? null : valoresHoy.every(enRangoMeta),
    fueraDeRango3d: validos.filter((r) => r.fecha.slice(0, 10) >= desde3 && clasificacionDeRegistro(r) !== 'Normal').length,
  };
}
