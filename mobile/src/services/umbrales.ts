// Umbrales clínicos de la app en UN solo lugar (design.md § Fase Móvil 5, TASK-055). Funciones y constantes puras.
// Cambiar un valor aquí lo cambia en el historial, el inicio, el perfil, los gráficos, el reporte del médico y el PDF.
// Estos valores resumen y colorean lo que ve el usuario; NO deciden las alertas: eso lo hace el port de
// glucosa.service.ts en clasificacionGlucosa.ts (rangos por edad y tipo, pendientes de revisión clínica).

/** Hipoglucemia: lectura estrictamente menor que este valor (mg/dL). Origen: ADA, nivel 1 (< 70 mg/dL). */
export const GLUCOSA_HIPO_MAX = 70;

/** Límite inferior del rango meta (mg/dL). Coincide con el umbral de hipoglucemia. */
export const RANGO_META_MIN = GLUCOSA_HIPO_MAX;

/**
 * Límite superior del rango meta (mg/dL). Decisión del usuario (2026-10-30): 70-180, el consenso internacional de
 * tiempo en rango (TIR). Antes, el paciente usaba 70-140 y el reporte del médico 70-180.
 */
export const RANGO_META_MAX = 180;

/** Límites de lo que se acepta al registrar una toma (mg/dL). Origen: validación de la pantalla de registro. */
export const GLUCOSA_CAPTURA_MIN = 20;
export const GLUCOSA_CAPTURA_MAX = 600;

/**
 * Objetivo de tiempo en rango del reporte (% de lecturas dentro del rango meta). Origen: consenso internacional de TIR
 * (> 70 % del tiempo entre 70 y 180 mg/dL) para adultos con diabetes; es una referencia general, no individual.
 */
export const TIR_OBJETIVO_PORCENTAJE = 70;

/** Tomas diarias esperadas: ayunas, después de comer y antes de dormir (catálogo GET /api/general/momentos). */
export const LECTURAS_DIARIAS_ESPERADAS = 3;

/** true si la lectura está dentro del rango meta (ambos límites incluidos). */
export function enRangoMeta(valor: number): boolean {
  return valor >= RANGO_META_MIN && valor <= RANGO_META_MAX;
}

/** Texto del rango meta para la interfaz, p. ej. "70-180". */
export function textoRangoMeta(separador = '-'): string {
  return `${RANGO_META_MIN}${separador}${RANGO_META_MAX}`;
}

/** Porcentaje de las lecturas en rango meta (entero); null si no hay lecturas. */
export function porcentajeEnRangoMeta(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return Math.round((valores.filter(enRangoMeta).length / valores.length) * 100);
}
