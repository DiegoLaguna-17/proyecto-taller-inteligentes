// Vistas del administrador (funciones puras): fechas, enmascarado, filtros, paginación y KPIs de la auditoría.
import type { UsuarioAdmin, EventoAuditoria } from './administrador.ts';
import { etiquetaFechaHora } from './historial.ts';

const dos = (n: number) => String(n).padStart(2, '0');

/** Normaliza a dd/mm/aaaa. Los médicos llegan como aaaa-mm-dd (con o sin hora) y los pacientes y administradores como dd/mm/aaaa. */
export function normalizarFechaNac(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return /^\d{2}\/\d{2}\/\d{4}$/.test(t) ? t : null;
}

/** Solo se abren URL http(s): nunca esquemas locales (file:, intent:, javascript:...). */
export const esUrlAbrible = (url: string | null | undefined): url is string => !!url && /^https?:\/\/\S+$/i.test(url.trim());

// ---------------------------------------------------------------------------
// Solicitudes y usuarios
// ---------------------------------------------------------------------------

export type FiltroSolicitudes = 'todos' | 'pacientes' | 'medicos';

/** Lista unificada de solicitantes, ordenada por nombre. */
export function unificarSolicitudes(pacientes: UsuarioAdmin[], medicos: UsuarioAdmin[]): UsuarioAdmin[] {
  return [...medicos, ...pacientes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function filtrarSolicitudes(items: UsuarioAdmin[], filtro: FiltroSolicitudes): UsuarioAdmin[] {
  if (filtro === 'pacientes') return items.filter((i) => i.rol === 'Paciente');
  if (filtro === 'medicos') return items.filter((i) => i.rol === 'Médico');
  return items;
}

export function conteoSolicitudes(items: UsuarioAdmin[]): { todos: number; pacientes: number; medicos: number } {
  return {
    todos: items.length,
    pacientes: items.filter((i) => i.rol === 'Paciente').length,
    medicos: items.filter((i) => i.rol === 'Médico').length,
  };
}

export type FiltroEstadoUsuarios = 'todos' | 'activos' | 'inactivos';

export function filtrarUsuarios(items: UsuarioAdmin[], texto: string, estado: FiltroEstadoUsuarios): UsuarioAdmin[] {
  const q = texto.trim().toLowerCase();
  return items.filter((u) => {
    if (estado === 'activos' && !u.activo) return false;
    if (estado === 'inactivos' && u.activo) return false;
    if (!q) return true;
    return u.nombre.toLowerCase().includes(q) || (u.correo ?? '').toLowerCase().includes(q) || u.rol.toLowerCase().includes(q);
  });
}

export function conteoUsuarios(items: UsuarioAdmin[]): { todos: number; activos: number; inactivos: number } {
  const activos = items.filter((u) => u.activo).length;
  return { todos: items.length, activos, inactivos: items.length - activos };
}

// ---------------------------------------------------------------------------
// Auditoría
// ---------------------------------------------------------------------------

/** Sustituye los segmentos numéricos de la ruta por {id} y descarta la query: /api/pacientes/perfil/12 -> /api/pacientes/perfil/{id}. */
export function sanitizarEndpoint(ruta: string): string {
  return ruta.split('?')[0].replace(/\/\d+(?=\/|$)/g, '/{id}');
}

/** 192.168.1.45 y ::ffff:192.168.1.45 -> 192.168.1.xxx; IPv6 -> primeros dos grupos y :xxxx; cualquier otra cosa -> xxx. */
export function enmascararIp(ip: unknown): string {
  if (typeof ip !== 'string') return 'xxx';
  const t = ip.trim();
  // IPv4 simple o mapeada en IPv6 (::ffff:a.b.c.d): se conservan solo los tres primeros octetos
  const v4 = /(?:^|:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(t);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.xxx`;
  if (t.includes(':')) return `${t.split(':').filter(Boolean).slice(0, 2).join(':')}:xxxx`;
  return 'xxx';
}

export type TipoEvento = 'acceso' | 'modificacion' | 'consulta';

/** Acceso = inicio de sesión o verificación del OTP; modificación = cualquier otra operación que no sea GET. */
export function clasificarEvento(e: Pick<EventoAuditoria, 'rol' | 'operacion' | 'endpoint'>): TipoEvento {
  if (e.rol === 'login' || /\/(login|verify-otp)$/.test(e.endpoint)) return 'acceso';
  return e.operacion.toUpperCase() !== 'GET' ? 'modificacion' : 'consulta';
}

/** Fecha local del evento (null si la fecha no es válida). */
export function fechaDeEvento(e: Pick<EventoAuditoria, 'fecha'>): Date | null {
  if (!e.fecha) return null;
  const d = new Date(e.fecha);
  return Number.isNaN(d.getTime()) ? null : d;
}

const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Más recientes primero; los eventos sin fecha válida van al final. */
export function ordenarEventos(eventos: EventoAuditoria[]): EventoAuditoria[] {
  const t = (e: EventoAuditoria) => fechaDeEvento(e)?.getTime() ?? Number.NEGATIVE_INFINITY;
  return [...eventos].sort((a, b) => (t(a) === t(b) ? 0 : t(b) > t(a) ? 1 : -1));
}

export type FiltroEventos = 'todos' | 'accesos' | 'modificaciones';

export function filtrarEventos(eventos: EventoAuditoria[], filtro: FiltroEventos, soloHoy: boolean, hoy: Date): EventoAuditoria[] {
  return eventos.filter((e) => {
    if (soloHoy) {
      const d = fechaDeEvento(e);
      if (!d || !mismoDia(d, hoy)) return false;
    }
    const tipo = clasificarEvento(e);
    if (filtro === 'accesos') return tipo === 'acceso';
    if (filtro === 'modificaciones') return tipo === 'modificacion';
    return true;
  });
}

/** Carga parcial en el cliente: las primeras `paginas * tamano` entradas. */
export function paginar<T>(items: T[], paginas: number, tamano = 20): { visibles: T[]; hayMas: boolean } {
  const n = Math.max(1, paginas) * tamano;
  return { visibles: items.slice(0, n), hayMas: items.length > n };
}

export function kpisAuditoria(eventos: EventoAuditoria[], hoy: Date): { hoy: number; erroresHoy: number; total: number } {
  const deHoy = eventos.filter((e) => {
    const d = fechaDeEvento(e);
    return d !== null && mismoDia(d, hoy);
  });
  return { hoy: deHoy.length, erroresHoy: deHoy.filter((e) => !e.exito).length, total: eventos.length };
}

/** "Hoy, 14:05" / "Ayer, 23:15" / "5 Oct, 09:00"; "Sin fecha" si no es válida. */
export function etiquetaFechaEvento(e: Pick<EventoAuditoria, 'fecha'>, hoy: Date): string {
  const d = fechaDeEvento(e);
  if (!d) return 'Sin fecha';
  const f = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  return etiquetaFechaHora(f, `${dos(d.getHours())}:${dos(d.getMinutes())}`, hoy);
}
