// Vistas del médico (funciones puras): estado de pacientes por alertas, filtros, edad y métricas del reporte.
import type { AlertaMedico, PacienteMedico } from './medico.ts';
import type { RegistroHistorial } from './glucosa.ts';
import { filtrarPorPeriodo } from './historial.ts';
import { GLUCOSA_HIPO_MAX, RANGO_META_MAX, RANGO_META_MIN } from './umbrales.ts';

export type ClasificacionAlerta = 'Riesgo Hipo' | 'Riesgo Hiper';

/** Hipo o hiper según el texto del tipo de alerta; si no se reconoce, por el valor (< 70 = hipo). */
export function clasificacionDeAlerta(a: Pick<AlertaMedico, 'nivel' | 'glucosa'>): ClasificacionAlerta {
  const n = a.nivel.toLowerCase();
  if (n.includes('hiper')) return 'Riesgo Hiper';
  if (n.includes('hipo')) return 'Riesgo Hipo';
  return a.glucosa !== null && a.glucosa < GLUCOSA_HIPO_MAX ? 'Riesgo Hipo' : 'Riesgo Hiper';
}

/** Edad en años a partir de "dd/mm/aaaa" (formato de misPacientes); null si no se puede calcular. */
export function edadDesdeFechaNac(fechaNac: string | null, hoy: Date): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((fechaNac ?? '').trim());
  if (!m) return null;
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let edad = hoy.getFullYear() - a;
  if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < d)) edad -= 1;
  return edad >= 0 && edad < 150 ? edad : null;
}

export function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

const clave = (a: Pick<AlertaMedico, 'fecha' | 'hora'>) => `${a.fecha} ${a.hora ?? '00:00'}`;

/** Alertas ordenadas de la más reciente a la más antigua. */
export function ordenarAlertas<T extends Pick<AlertaMedico, 'fecha' | 'hora'>>(alertas: T[]): T[] {
  return [...alertas].sort((x, y) => (clave(x) < clave(y) ? 1 : clave(x) > clave(y) ? -1 : 0));
}

export interface PacienteConEstado {
  paciente: PacienteMedico;
  /** Alerta activa más reciente (null = sin alertas activas). */
  alerta: AlertaMedico | null;
  alertasActivas: number;
}

/** Cruza pacientes con las alertas activas (decisión del usuario: el estado sale de las alertas, no de lecturas). */
export function estadoPacientes(pacientes: PacienteMedico[], activas: AlertaMedico[]): PacienteConEstado[] {
  const ordenadas = ordenarAlertas(activas);
  return pacientes.map((paciente) => {
    const propias = ordenadas.filter((a) => a.idPaciente === paciente.id);
    return { paciente, alerta: propias[0] ?? null, alertasActivas: propias.length };
  });
}

export type FiltroPacientes = 'todos' | 'riesgo' | 'estables';

export function filtrarPacientes(items: PacienteConEstado[], texto: string, filtro: FiltroPacientes): PacienteConEstado[] {
  const q = texto.trim().toLowerCase();
  return items.filter((i) => {
    if (q && !i.paciente.nombre.toLowerCase().includes(q) && !String(i.paciente.id).includes(q)) return false;
    if (filtro === 'riesgo') return i.alertasActivas > 0;
    if (filtro === 'estables') return i.alertasActivas === 0;
    return true;
  });
}

export function resumenPacientes(items: PacienteConEstado[]): { total: number; enRiesgo: number; estables: number } {
  const enRiesgo = items.filter((i) => i.alertasActivas > 0).length;
  return { total: items.length, enRiesgo, estables: items.length - enRiesgo };
}

export function filtrarAlertas(alertas: AlertaMedico[], filtro: 'todas' | 'hipo' | 'hiper'): AlertaMedico[] {
  if (filtro === 'todas') return alertas;
  const objetivo: ClasificacionAlerta = filtro === 'hipo' ? 'Riesgo Hipo' : 'Riesgo Hiper';
  return alertas.filter((a) => clasificacionDeAlerta(a) === objetivo);
}

// ---------------------------------------------------------------------------
// Reporte clínico: usa el rango meta central de umbrales.ts (70-180 mg/dL, el mismo que ve el paciente)
// ---------------------------------------------------------------------------

export const REPORTE_MIN = RANGO_META_MIN;
export const REPORTE_MAX = RANGO_META_MAX;

export interface MetricasReporte {
  total: number;
  promedio: number | null;
  /** % de lecturas dentro del rango meta (ambos límites incluidos). */
  tir: number | null;
  hipo: number;
  hiper: number;
  pctBajo: number;
  pctRango: number;
  pctAlto: number;
}

/** Métricas de las lecturas de los últimos `dias` días (7 o 30) que terminan en `hoy`. */
export function metricasReporte(registros: RegistroHistorial[], hoy: Date, dias: 7 | 30): MetricasReporte {
  const periodo = dias === 7 ? 'Semanal' : 'Mensual';
  const v = filtrarPorPeriodo(registros, periodo, hoy)
    .map((r) => r.nivelGlucosa)
    .filter((x): x is number => typeof x === 'number');
  const total = v.length;
  if (total === 0) return { total: 0, promedio: null, tir: null, hipo: 0, hiper: 0, pctBajo: 0, pctRango: 0, pctAlto: 0 };
  const hipo = v.filter((x) => x < REPORTE_MIN).length;
  const hiper = v.filter((x) => x > REPORTE_MAX).length;
  const enRango = total - hipo - hiper;
  const pct = (n: number) => Math.round((n / total) * 100);
  return {
    total,
    promedio: Math.round(v.reduce((a, b) => a + b, 0) / total),
    tir: pct(enRango),
    hipo,
    hiper,
    pctBajo: pct(hipo),
    pctRango: pct(enRango),
    pctAlto: pct(hiper),
  };
}
