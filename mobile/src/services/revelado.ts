// Efecto de escritura del chatbot (design.md § Fase Chatbot-Front, TASK-061). Funciones PURAS, sin react-native.
// El servicio responde completo; esto solo decide cómo se REVELA el texto en pantalla.

export type ModoAnimacion = 'escritura' | 'inmediato';

/** Ritmo por defecto: milisegundos entre pasos. */
export const MS_POR_PASO = 45;
/** Tope de duración total del revelado, aunque el texto sea largo. */
export const DURACION_MAXIMA_MS = 4000;
/** Una «palabra» más larga que esto (URL, cadena sin espacios) se parte en trozos de este tamaño (puntos de código). */
const TROZO_PALABRA_LARGA = 24;

/** Normaliza el valor de EXPO_PUBLIC_CHAT_ANIMACION: solo «inmediato» lo desactiva; cualquier otro, «escritura». */
export function normalizarModo(valor: string | undefined | null): ModoAnimacion {
  return (valor ?? '').trim().toLowerCase() === 'inmediato' ? 'inmediato' : 'escritura';
}

/** Modo efectivo: «reducir movimiento» del sistema fuerza el modo inmediato. */
export function modoEfectivo(configurado: ModoAnimacion, reducirMovimiento: boolean): ModoAnimacion {
  return reducirMovimiento ? 'inmediato' : configurado;
}

const ZWJ = 0x200d;
const esModificador = (cp: number) =>
  cp === ZWJ ||
  cp === 0xfe0f || // selector de variación (emoji)
  cp === 0xfe0e ||
  (cp >= 0x0300 && cp <= 0x036f) || // marcas de acento combinadas
  (cp >= 0x1f3fb && cp <= 0x1f3ff) || // tonos de piel
  (cp >= 0xe0020 && cp <= 0xe007f); // etiquetas (banderas regionales compuestas)

/** Parte una palabra larga por puntos de código sin separar emojis compuestos ni letras de sus acentos. */
function partirPalabra(palabra: string): string[] {
  const cps = Array.from(palabra);
  if (cps.length <= TROZO_PALABRA_LARGA) return [palabra];
  const trozos: string[] = [];
  let i = 0;
  while (i < cps.length) {
    let fin = Math.min(i + TROZO_PALABRA_LARGA, cps.length);
    // no cortar delante de un modificador ni justo después de un unidor (ZWJ)
    while (fin < cps.length && (esModificador(cps[fin].codePointAt(0) as number) || cps[fin - 1].codePointAt(0) === ZWJ)) fin += 1;
    trozos.push(cps.slice(i, fin).join(''));
    i = fin;
  }
  return trozos;
}

/** Fragmentos del texto en orden: palabras y bloques de espacios o saltos de línea; unirlos devuelve el texto exacto. */
export function trocear(texto: string): string[] {
  if (!texto) return [];
  const partes = texto.split(/(\s+)/).filter((p) => p !== '');
  return partes.flatMap((p) => (/^\s+$/.test(p) ? [p] : partirPalabra(p)));
}

export interface PlanRevelado {
  /** partes[k] = texto visible tras el paso k+1; la última es el texto íntegro. Vacío si no hay nada que revelar. */
  partes: string[];
  intervaloMs: number;
  /** Duración total: partes.length * intervaloMs (nunca más que DURACION_MAXIMA_MS). */
  duracionMs: number;
}

export interface OpcionesPlan {
  modo?: ModoAnimacion;
  msPorPaso?: number;
  maxMs?: number;
}

/**
 * Plan de revelado. Con modo inmediato o texto vacío no hay pasos intermedios (una sola parte con el texto completo,
 * o ninguna si está vacío). Con escritura, si hay demasiados fragmentos para el tope de duración se agrupan.
 */
export function planRevelado(texto: string, opciones: OpcionesPlan = {}): PlanRevelado {
  const { modo = 'escritura', msPorPaso = MS_POR_PASO, maxMs = DURACION_MAXIMA_MS } = opciones;
  if (!texto) return { partes: [], intervaloMs: 0, duracionMs: 0 };
  if (modo === 'inmediato') return { partes: [texto], intervaloMs: 0, duracionMs: 0 };

  const trozos = trocear(texto);
  const intervalo = Math.max(1, msPorPaso);
  const maxPasos = Math.max(1, Math.floor(Math.max(0, maxMs) / intervalo));
  const grupo = Math.max(1, Math.ceil(trozos.length / maxPasos));
  const partes: string[] = [];
  let acumulado = '';
  for (let i = 0; i < trozos.length; i += grupo) {
    acumulado += trozos.slice(i, i + grupo).join('');
    partes.push(acumulado);
  }
  return { partes, intervaloMs: intervalo, duracionMs: partes.length * intervalo };
}

/** Texto visible en el paso `paso` (0 = nada todavía); más allá del último paso, el texto íntegro. */
export function textoEnPaso(plan: PlanRevelado, paso: number): string {
  if (plan.partes.length === 0 || paso <= 0) return '';
  return plan.partes[Math.min(paso, plan.partes.length) - 1];
}

const RE_AVISO = /consulta\s+(siempre\s+)?a\s+tu\s+m[eé]dico/i;

/**
 * Separa el aviso médico que añade el servicio como ÚLTIMO párrafo («Consulta siempre a tu médico tratante…»).
 * Si la respuesta no lo trae, aviso es null: la app no inventa uno.
 */
export function separarAviso(respuesta: string): { cuerpo: string; aviso: string | null } {
  const texto = respuesta.replace(/\s+$/, '');
  const i = texto.lastIndexOf('\n\n');
  if (i < 0) return { cuerpo: texto, aviso: null };
  const ultimo = texto.slice(i + 2).trim();
  if (ultimo.length > 0 && ultimo.length <= 240 && RE_AVISO.test(ultimo)) {
    return { cuerpo: texto.slice(0, i).replace(/\s+$/, ''), aviso: ultimo };
  }
  return { cuerpo: texto, aviso: null };
}
