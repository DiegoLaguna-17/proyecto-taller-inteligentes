// Validaciones de formularios (puras). Las reglas del backend son mínimas; estas evitan envíos incompletos
// (importante en registrarPaciente: el backend sube la foto ANTES de validar el resto).

export const esCorreo = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** 7 u 8 dígitos (misma regla que el front web al registrar). Pendiente de confirmar con el equipo. */
export const esTelefono = (v: string): boolean => /^\d{7,8}$/.test(v.trim());

/** Número positivo con hasta dos decimales (coma o punto) y como máximo `max`. */
export function esNumeroPositivo(v: string, max: number): boolean {
  const t = v.trim();
  if (!/^\d+([.,]\d{1,2})?$/.test(t)) return false;
  const n = Number(t.replace(',', '.'));
  return n > 0 && n <= max;
}

/** "AAAA-MM-DD" válida (rechaza 2026-02-31). */
export function esFechaIso(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return false;
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(a, mes - 1, dia);
  return f.getFullYear() === a && f.getMonth() === mes - 1 && f.getDate() === dia;
}

export function fechaIso(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export const aNumero = (v: string): number => Number(v.trim().replace(',', '.'));

/** Semanas de embarazo: entero de 1 a 42. */
export const esSemanas = (v: string): boolean => /^\d{1,2}$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 42;

// ---------------------------------------------------------------------------
// Altura: la base la guarda en METROS (numeric(4,2), máximo 99.99; p. ej. 1.70). El usuario la escribe y la ve en
// CENTÍMETROS (más natural) y la app convierte al enviar y al mostrar.
// ---------------------------------------------------------------------------

export const ALTURA_MIN_CM = 50;
export const ALTURA_MAX_CM = 250;

/** Centímetros válidos: número con hasta dos decimales entre 50 y 250. */
export function esAlturaCm(v: string): boolean {
  const t = v.trim();
  if (!/^\d+([.,]\d{1,2})?$/.test(t)) return false;
  const n = Number(t.replace(',', '.'));
  return n >= ALTURA_MIN_CM && n <= ALTURA_MAX_CM;
}

/** Centímetros -> metros con dos decimales, redondeando al centímetro: "170" -> "1.70", "170.5" -> "1.71". */
export function alturaCmAMetros(cm: string): string {
  return (Math.round(Number(cm.trim().replace(',', '.'))) / 100).toFixed(2);
}

/** Metros (como los devuelve el backend, p. ej. "1.7" o 1.70) -> centímetros enteros: "1.7" -> "170". Vacío si no es un número. */
export function alturaMetrosACm(m: string | null | undefined): string {
  if (m === null || m === undefined || !m.trim()) return '';
  const n = Number(m.trim().replace(',', '.'));
  return Number.isFinite(n) ? String(Math.round(n * 100)) : '';
}

/** Metros normalizados a dos decimales para comparar con lo que se enviaría ("1.7" -> "1.70"); vacío si no es número. */
export function metrosNormalizados(m: string | null | undefined): string {
  if (m === null || m === undefined || !m.trim()) return '';
  const n = Number(m.trim().replace(',', '.'));
  return Number.isFinite(n) ? n.toFixed(2) : '';
}
