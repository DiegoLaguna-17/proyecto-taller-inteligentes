// Riesgo de hipoglucemia (ML) que el backend añade a la respuesta de POST /api/medicos/registrar/glucosa
// (design.md § Riesgo de hipoglucemia en la pantalla del médico, TASK-017g, ADR-0011). Todo puro y defensivo:
// nada de lo que llegue en `riesgo_ml` puede lanzar una excepción ni romper el registro de la lectura.
// El riesgo es experimental e informativo: no se guarda, no se registra en logs y no interviene en las alertas.

export type MotivoRiesgo = 'no_aplica_tipo' | 'datos_insuficientes' | 'momento_no_cubierto' | 'no_disponible' | 'desconocido';

export interface RiesgoMl {
  /** Probabilidad de 0 a 1, o null cuando no se calculó (entonces `motivo` explica por qué). */
  riesgo: number | null;
  motivo: MotivoRiesgo | null;
  /** Versión del modelo, solo si trae caracteres seguros. */
  version: string | null;
  /** Códigos saneados (siempre minúsculas y guion bajo). */
  supuestos: string[];
  faltantes: string[];
}

export const MAX_ELEMENTOS = 8;
const MAX_LONGITUD_CODIGO = 40;
const MAX_LONGITUD_VERSION = 20;
const CODIGO_SEGURO = /^[a-z0-9_]+$/;
const VERSION_SEGURA = /^[A-Za-z0-9._+-]+$/;

const MOTIVOS: readonly string[] = ['no_aplica_tipo', 'datos_insuficientes', 'momento_no_cubierto', 'no_disponible'];

export const LEYENDA_RIESGO = 'Modelo experimental, no validado clínicamente. Es solo orientativo y no sustituye el criterio del médico.';
export const TITULO_RIESGO = 'Estimación de riesgo de hipoglucemia (experimental)';

const TEXTO_MOTIVO: Record<MotivoRiesgo, string> = {
  no_aplica_tipo: 'No aplica: la estimación se calcula solo para pacientes con diabetes tipo 2',
  datos_insuficientes: 'Faltan datos del paciente para estimar el riesgo',
  momento_no_cubierto: 'La estimación solo cubre mediciones en ayunas o después de comer',
  no_disponible: 'La estimación no está disponible en este momento',
  desconocido: 'No se pudo calcular la estimación',
};

const TEXTO_SUPUESTO: Record<string, string> = {
  duracion_estimada: 'Duración de la diabetes estimada, no registrada',
  comorbilidades_no_capturadas: 'Sin comorbilidades capturadas',
  hba1c_no_disponible: 'Sin HbA1c',
};
const SUPUESTO_GENERICO = 'Otro supuesto del modelo';

const TEXTO_FALTANTE: Record<string, string> = {
  genero: 'género',
  edad: 'edad',
  imc: 'IMC (peso o altura)',
  medicacion: 'tratamiento',
  glucosa: 'valor de glucosa',
  paciente: 'datos del paciente',
};
const FALTANTE_GENERICO = 'otro dato';

/** Códigos de texto seguros, sin repetidos y acotados; descarta todo lo que no sea una cadena válida. */
function sanearCodigos(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const salida: string[] = [];
  for (const x of v) {
    if (salida.length >= MAX_ELEMENTOS) break;
    if (typeof x !== 'string') continue;
    const c = x.trim().toLowerCase();
    if (c.length === 0 || c.length > MAX_LONGITUD_CODIGO || !CODIGO_SEGURO.test(c) || salida.includes(c)) continue;
    salida.push(c);
  }
  return salida;
}

function sanearVersion(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 && t.length <= MAX_LONGITUD_VERSION && VERSION_SEGURA.test(t) ? t : null;
}

const SIN_CALCULO = (motivo: MotivoRiesgo, faltantes: string[] = []): RiesgoMl => ({
  riesgo: null,
  motivo,
  version: null,
  supuestos: [],
  faltantes,
});

/**
 * Interpreta el valor crudo de `riesgo_ml`. Devuelve null (sin UI de riesgo) si falta o no es un objeto. Nunca lanza.
 * Un riesgo que no es un número finito en [0, 1] se trata como `no_disponible`.
 */
export function leerRiesgoMl(crudo: unknown): RiesgoMl | null {
  try {
    if (crudo === null || typeof crudo !== 'object' || Array.isArray(crudo)) return null;
    const o = crudo as Record<string, unknown>;
    const r = o.riesgo_hipoglucemia;

    if (r !== null && r !== undefined) {
      if (typeof r !== 'number' || !Number.isFinite(r) || r < 0 || r > 1) return SIN_CALCULO('no_disponible');
      return { riesgo: r, motivo: null, version: sanearVersion(o.version_modelo), supuestos: sanearCodigos(o.supuestos), faltantes: [] };
    }

    const m = o.motivo;
    if (typeof m === 'string' && MOTIVOS.includes(m)) {
      // Los faltantes solo tienen sentido cuando faltan datos
      return SIN_CALCULO(m as MotivoRiesgo, m === 'datos_insuficientes' ? sanearCodigos(o.faltantes) : []);
    }
    // Sin riesgo y sin motivo conocido: si el motivo falta del todo no hay nada que decir salvo que no está disponible
    return SIN_CALCULO(m === null || m === undefined ? 'no_disponible' : 'desconocido');
  } catch {
    return null;
  }
}

/** 0.1712 → «17,1 %» (1 decimal, coma decimal). El redondeo evita errores binarios (0.1725 → 17,3). */
export function formatearPorcentaje(riesgo: number): string {
  const decimas = Math.round(Number((riesgo * 1000).toPrecision(12)));
  const texto = (decimas / 10).toFixed(1).replace('.', ',');
  return `${texto} %`;
}

export function textoMotivo(motivo: MotivoRiesgo): string {
  return TEXTO_MOTIVO[motivo] ?? TEXTO_MOTIVO.desconocido;
}

export function textoSupuesto(codigo: string): string {
  return Object.hasOwn(TEXTO_SUPUESTO, codigo) ? TEXTO_SUPUESTO[codigo] : SUPUESTO_GENERICO;
}

export function textoFaltante(codigo: string): string {
  return Object.hasOwn(TEXTO_FALTANTE, codigo) ? TEXTO_FALTANTE[codigo] : FALTANTE_GENERICO;
}

/** «género, edad y IMC (peso o altura)». Vacío si no hay faltantes. */
export function listaFaltantes(faltantes: string[]): string {
  const t = faltantes.map(textoFaltante).filter((x, i, a) => a.indexOf(x) === i);
  if (t.length === 0) return '';
  if (t.length === 1) return t[0];
  return `${t.slice(0, -1).join(', ')} y ${t[t.length - 1]}`;
}

/** Texto del motivo, con los faltantes legibles en `datos_insuficientes` («Faltan datos…: género y edad»). */
export function mensajeMotivo(r: RiesgoMl): string {
  const motivo = r.motivo ?? 'desconocido';
  const base = textoMotivo(motivo);
  const lista = motivo === 'datos_insuficientes' ? listaFaltantes(r.faltantes) : '';
  return lista ? `${base}: ${lista}` : base;
}

/** Texto de accesibilidad del bloque completo (sin repetir la leyenda, que se lee aparte). */
export function resumenAccesible(r: RiesgoMl): string {
  return r.riesgo !== null ? `${TITULO_RIESGO}: ${formatearPorcentaje(r.riesgo)}` : `${TITULO_RIESGO}: ${mensajeMotivo(r)}`;
}
