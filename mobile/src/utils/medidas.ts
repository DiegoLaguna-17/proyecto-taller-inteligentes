// Medidas y escalado comunes de la app (design.md § Fase Móvil 5, TASK-058). Todo puro: sin react-native, con pruebas.
// El hook que lee el ancho de la ventana vive en useMedidas.ts.

/** Ancho de referencia de un teléfono pequeño (dp). Con este ancho el factor de escala es 1. */
export const ANCHO_BASE = 360;
export const FACTOR_MIN = 0.9;
export const FACTOR_MAX = 1.15;

/** Ancho máximo del contenido (dp): en tablets y pantallas anchas el contenido se centra y no se estira. */
export const ANCHO_MAXIMO_CONTENIDO = 600;

/** Escala de espaciado (dp). */
export const ESPACIO = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;

/** Radios de borde (dp). */
export const RADIO = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/** Alturas de controles (dp); 44 es el mínimo táctil recomendado. */
export const ALTURA = { botonSm: 40, boton: 48, botonLg: 56, input: 52, tactilMin: 44 } as const;

/** Tamaños de fuente (sp). Cuerpo 14-16, títulos 20-24; las cifras destacadas llegan a 40 como máximo. */
export const FUENTE = {
  nota: 11,
  caption: 12,
  cuerpo: 14,
  cuerpoGrande: 16,
  subtitulo: 18,
  titulo: 22,
  tituloGrande: 24,
  cifra: 32,
  cifraGrande: 40,
} as const;

/** Los textos del sistema no crecen más de este múltiplo cuando el usuario sube el tamaño de letra del teléfono. */
export const MAX_ESCALA_FUENTE_SISTEMA = 1.3;

const acotar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Factor de escala según el ancho de la ventana, acotado a [FACTOR_MIN, FACTOR_MAX]. Entradas inválidas dan 1. */
export function factorEscala(ancho: number): number {
  if (!Number.isFinite(ancho) || ancho <= 0) return 1;
  return acotar(ancho / ANCHO_BASE, FACTOR_MIN, FACTOR_MAX);
}

/** Escala un valor (dp o sp) según el ancho; `tope` limita el factor máximo (por defecto FACTOR_MAX). */
export function escalar(valor: number, ancho: number, tope = FACTOR_MAX): number {
  const f = Math.min(factorEscala(ancho), tope);
  return Math.round(valor * f * 10) / 10;
}

/** Ancho que ocupa el contenido: el de la ventana, sin pasar de ANCHO_MAXIMO_CONTENIDO. */
export function anchoContenido(ancho: number): number {
  if (!Number.isFinite(ancho) || ancho <= 0) return ANCHO_MAXIMO_CONTENIDO;
  return Math.min(ancho, ANCHO_MAXIMO_CONTENIDO);
}

/**
 * Posición vertical de un valor en un gráfico: `min` va a `yAbajo` y `max` a `yArriba` (y crece hacia abajo).
 * Los valores fuera del dominio se acotan al borde del gráfico.
 */
export function posicionY(valor: number, dominio: { min: number; max: number }, yArriba: number, yAbajo: number): number {
  const t = (acotar(valor, dominio.min, dominio.max) - dominio.min) / (dominio.max - dominio.min);
  return yAbajo - t * (yAbajo - yArriba);
}

/** Ancho máximo de una burbuja del chat: 85 % del contenido, sin pasar de 480 dp. */
export function anchoBurbuja(ancho: number): number {
  return Math.min(Math.round(anchoContenido(ancho) * 0.85), 480);
}

/** Dominio vertical de los gráficos de glucosa (mg/dL): deja visibles los límites 70 y 180 con margen a ambos lados. */
export const DOMINIO_GRAFICO_GLUCOSA = { min: 40, max: 240 } as const;
