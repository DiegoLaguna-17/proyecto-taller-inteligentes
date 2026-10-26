// Reporte clínico en PDF (TASK-056, design.md § Fase Móvil 5): resumen y HTML como funciones PURAS, sin red ni módulos
// nativos. El HTML se convierte en PDF en el dispositivo (shared/compartirPdf.ts). Solo datos que el reporte necesita:
// nombre, edad y condición del paciente; nunca teléfono, correo, documento ni observaciones libres.
import type { RegistroHistorial } from './glucosa.ts';
import { etiquetaMomento, filtrarPorPeriodo, rangoPeriodo } from './historial.ts';
import { GLUCOSA_HIPO_MAX, RANGO_META_MAX, RANGO_META_MIN, enRangoMeta, porcentajeEnRangoMeta, textoRangoMeta } from './umbrales.ts';

export const LEYENDA_INFORMATIVA =
  'Este reporte es informativo y no reemplaza el criterio clínico del profesional de la salud.';

export interface PacienteReporte {
  nombre: string;
  /** Años cumplidos; null si no se conoce. */
  edad: number | null;
  /** Condición principal (p. ej. "Diabetes Tipo 2"); null si no consta. */
  condicion: string | null;
}

export interface ResumenGlucosa {
  total: number;
  promedio: number;
  minimo: number;
  maximo: number;
  /** % de lecturas dentro del rango meta central (umbrales.ts). */
  pctEnRango: number;
  hipo: number;
  hiper: number;
}

/** Lecturas con valor del periodo, en orden cronológico (de la más antigua a la más reciente). */
export function lecturasDelPeriodo(registros: RegistroHistorial[], hoy: Date, dias: 7 | 30): RegistroHistorial[] {
  const periodo = dias === 7 ? 'Semanal' : 'Mensual';
  return filtrarPorPeriodo(registros, periodo, hoy)
    .filter((r) => typeof r.nivelGlucosa === 'number')
    .sort((a, b) => {
      const ka = `${a.fecha.slice(0, 10)} ${a.hora ?? '00:00'}`;
      const kb = `${b.fecha.slice(0, 10)} ${b.hora ?? '00:00'}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
}

/** Resumen del periodo; null si no hay lecturas (en ese caso NO se genera el PDF). */
export function resumenGlucosa(registros: RegistroHistorial[], hoy: Date, dias: 7 | 30): ResumenGlucosa | null {
  const v = lecturasDelPeriodo(registros, hoy, dias).map((r) => r.nivelGlucosa as number);
  if (v.length === 0) return null;
  return {
    total: v.length,
    promedio: Math.round(v.reduce((a, b) => a + b, 0) / v.length),
    minimo: Math.min(...v),
    maximo: Math.max(...v),
    pctEnRango: porcentajeEnRangoMeta(v) as number,
    hipo: v.filter((x) => x < GLUCOSA_HIPO_MAX).length,
    hiper: v.filter((x) => x > RANGO_META_MAX).length,
  };
}

/** Escapa el texto que se inserta en el HTML (nombres, momentos y alertas vienen del servidor). */
export function escaparHtml(texto: unknown): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const dos = (n: number) => String(n).padStart(2, '0');

/** "aaaa-mm-dd" -> "dd/mm/aaaa" (otro formato se devuelve igual). */
export function fechaDdMmAaaa(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha;
}

function fechaHoraGeneracion(d: Date): string {
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

type EstadoLectura = 'Bajo' | 'En rango' | 'Alto';

function estadoDe(valor: number): EstadoLectura {
  if (valor < RANGO_META_MIN) return 'Bajo';
  return enRangoMeta(valor) ? 'En rango' : 'Alto';
}

const ESTILOS = `
  @page { margin: 18mm 14mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1E272C; font-size: 11px; }
  h1 { font-size: 20px; color: #0A3D62; margin: 0 0 4px; }
  h2 { font-size: 14px; color: #0A3D62; margin: 18px 0 6px; }
  .sub { color: #475569; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #CBD5E1; padding: 4px 6px; text-align: left; }
  th { background: #EEF2F6; }
  .kv td:first-child { width: 38%; font-weight: bold; background: #F8FAFC; }
  .alto { color: #B91C1C; font-weight: bold; }
  .bajo { color: #B45309; font-weight: bold; }
  .nota { margin-top: 18px; padding: 8px; border: 1px solid #CBD5E1; background: #F8FAFC; color: #334155; }
  .pie { margin-top: 10px; color: #64748B; font-size: 10px; }
`;

export interface EntradaReporte {
  paciente: PacienteReporte;
  registros: RegistroHistorial[];
  dias: 7 | 30;
  /** Momento de generación (se imprime en el reporte). */
  hoy: Date;
}

/** HTML completo del reporte; null si el periodo no tiene lecturas (no se genera un PDF vacío). */
export function construirHtmlReporte(e: EntradaReporte): string | null {
  const resumen = resumenGlucosa(e.registros, e.hoy, e.dias);
  if (!resumen) return null;
  const lecturas = lecturasDelPeriodo(e.registros, e.hoy, e.dias);
  const { desde, hasta } = rangoPeriodo(e.dias === 7 ? 'Semanal' : 'Mensual', e.hoy);

  const filas = lecturas
    .map((r) => {
      const valor = r.nivelGlucosa as number;
      const estado = estadoDe(valor);
      const clase = estado === 'Alto' ? 'alto' : estado === 'Bajo' ? 'bajo' : '';
      return `<tr><td>${escaparHtml(fechaDdMmAaaa(r.fecha.slice(0, 10)))}</td><td>${escaparHtml((r.hora ?? '').slice(0, 5) || '-')}</td><td>${escaparHtml(etiquetaMomento(r.momentoDia))}</td><td>${valor}</td><td class="${clase}">${estado}</td></tr>`;
    })
    .join('');

  const conAlerta = lecturas.filter((r) => (r.tipo_alerta ?? '').trim() !== '');
  const seccionAlertas =
    conAlerta.length === 0
      ? '<p>Sin alertas registradas en el periodo.</p>'
      : `<table><thead><tr><th>Fecha</th><th>Hora</th><th>Momento</th><th>Glucosa (mg/dL)</th><th>Alerta</th></tr></thead><tbody>${conAlerta
          .map(
            (r) =>
              `<tr><td>${escaparHtml(fechaDdMmAaaa(r.fecha.slice(0, 10)))}</td><td>${escaparHtml((r.hora ?? '').slice(0, 5) || '-')}</td><td>${escaparHtml(etiquetaMomento(r.momentoDia))}</td><td>${r.nivelGlucosa}</td><td>${escaparHtml(r.tipo_alerta)}</td></tr>`,
          )
          .join('')}</tbody></table>`;

  const datosPaciente = [
    ['Paciente', escaparHtml(e.paciente.nombre || 'Sin nombre')],
    ['Edad', e.paciente.edad === null ? 'No registrada' : `${e.paciente.edad} años`],
    ['Condición', escaparHtml(e.paciente.condicion || 'No registrada')],
  ]
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join('');

  const datosResumen = [
    ['Periodo', `Últimos ${e.dias} días (${fechaDdMmAaaa(desde)} al ${fechaDdMmAaaa(hasta)})`],
    ['Lecturas', String(resumen.total)],
    ['Promedio', `${resumen.promedio} mg/dL`],
    ['Mínimo', `${resumen.minimo} mg/dL`],
    ['Máximo', `${resumen.maximo} mg/dL`],
    [`En rango (${textoRangoMeta()} mg/dL)`, `${resumen.pctEnRango} %`],
    [`Hipoglucemias (< ${GLUCOSA_HIPO_MAX} mg/dL)`, String(resumen.hipo)],
    [`Hiperglucemias (> ${RANGO_META_MAX} mg/dL)`, String(resumen.hiper)],
  ]
    .map(([k, v]) => `<tr><td>${escaparHtml(k)}</td><td>${escaparHtml(v)}</td></tr>`)
    .join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Reporte de glucosa</title><style>${ESTILOS}</style></head><body>
<h1>GlucoTracker — Reporte de glucosa</h1>
<p class="sub">Generado el ${escaparHtml(fechaHoraGeneracion(e.hoy))}</p>
<h2>Datos del paciente</h2><table class="kv">${datosPaciente}</table>
<h2>Resumen</h2><table class="kv">${datosResumen}</table>
<h2>Lecturas</h2><table><thead><tr><th>Fecha</th><th>Hora</th><th>Momento</th><th>Glucosa (mg/dL)</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table>
<h2>Alertas</h2>${seccionAlertas}
<p class="nota">${escaparHtml(LEYENDA_INFORMATIVA)}</p>
<p class="pie">Documento confidencial con datos de salud. Compártelo solo con quien corresponda.</p>
</body></html>`;
}
