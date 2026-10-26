// Servicios del administrador (design.md § Fase Móvil 4). id_rol = id_admin; id_usuario solo para perfilAdmin.
import { API_BASE_URL, USE_MOCK } from './config.ts';
import { solicitar, ErrorApi, MENSAJES } from './http.ts';
import { textoLimpio } from './medico.ts';
import type { Tratamiento } from './paciente.ts';
import { enmascararIp, normalizarFechaNac, sanitizarEndpoint } from './administradorVista.ts';

export type RolUsuario = 'Paciente' | 'Médico' | 'Administrador';

/** Modelo único de la app para solicitantes y usuarios activos de cualquier rol. */
export interface UsuarioAdmin {
  /** `${rol}-${id}`: los ids de medico, paciente y administrador se solapan. */
  clave: string;
  id: number;
  rol: RolUsuario;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  /** dd/mm/aaaa (normalizada) */
  fechaNac: string | null;
  /** usuario.estado: true = activo, false = solicitante pendiente */
  activo: boolean;
  /** Afección (paciente), departamento (médico) o cargo (administrador). */
  resumen: string;
  admitidoPor: string | null;
  // médico
  departamento: string | null;
  matriculaUrl: string | null;
  carnetUrl: string | null;
  // paciente
  genero: string | null;
  medico: string | null;
  afecciones: string[];
  tratamientos: Tratamiento[];
  nombreEmergencia: string | null;
  numeroEmergencia: string | null;
  embarazo: boolean;
  semanas: number | null;
  fotoPerfil: string | null;
  // administrador
  cargo: string | null;
  fechaIngreso: string | null;
}

function base(rol: RolUsuario, id: number, nombre: string, activo: boolean): UsuarioAdmin {
  return {
    clave: `${rol}-${id}`, id, rol, nombre, correo: null, telefono: null, fechaNac: null, activo, resumen: '', admitidoPor: null,
    departamento: null, matriculaUrl: null, carnetUrl: null,
    genero: null, medico: null, afecciones: [], tratamientos: [], nombreEmergencia: null, numeroEmergencia: null, embarazo: false, semanas: null, fotoPerfil: null,
    cargo: null, fechaIngreso: null,
  };
}

function lista(d: unknown): Record<string, unknown>[] {
  if (!Array.isArray(d)) throw new ErrorApi('respuesta', MENSAJES.respuesta);
  return d.filter((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'number') as Record<string, unknown>[];
}

export function normalizarMedicosAdmin(d: unknown, activo: boolean): UsuarioAdmin[] {
  return lista(d).map((m) => {
    const u = base('Médico', m.id as number, textoLimpio(m.nombre) ?? 'Médico', activo);
    u.correo = textoLimpio(m.correo);
    u.telefono = textoLimpio(m.telefono);
    u.fechaNac = normalizarFechaNac(m.fechaNac);
    u.departamento = textoLimpio(m.departamento);
    u.matriculaUrl = textoLimpio(m.matricula);
    u.carnetUrl = textoLimpio(m.carnet);
    u.admitidoPor = textoLimpio(m.admitidoPor);
    u.resumen = u.departamento ?? 'Médico';
    return u;
  });
}

export function normalizarPacientesAdmin(d: unknown, activo: boolean): UsuarioAdmin[] {
  return lista(d).map((p) => {
    const u = base('Paciente', p.id as number, textoLimpio(p.nombre) ?? 'Paciente', activo);
    u.correo = textoLimpio(p.correo) ?? textoLimpio(p.ci);
    u.telefono = textoLimpio(p.telefono);
    u.fechaNac = normalizarFechaNac(p.fechaNac);
    u.genero = textoLimpio(p.genero);
    u.medico = textoLimpio(p.medico);
    u.nombreEmergencia = textoLimpio(p.nombre_emergencia);
    u.numeroEmergencia = textoLimpio(p.numero_emergencia);
    u.fotoPerfil = textoLimpio(p.foto_perfil);
    u.admitidoPor = textoLimpio(p.admitidoPor);
    u.embarazo = p.embarazo === true;
    u.semanas = typeof p.semanas_embarazo === 'number' ? p.semanas_embarazo : null;
    u.afecciones = Array.isArray(p.afecciones)
      ? p.afecciones.map((a: { afeccion?: unknown }) => textoLimpio(a?.afeccion)).filter((a: string | null): a is string => a !== null)
      : [];
    u.tratamientos = Array.isArray(p.tratamientos)
      ? p.tratamientos.map((t: Record<string, unknown>) => ({
          titulo: textoLimpio(t?.titulo) ?? 'Tratamiento',
          descripcion: textoLimpio(t?.desc) ?? '',
          dosis: textoLimpio(t?.dosis),
        }))
      : [];
    u.resumen = u.afecciones[0] ?? 'Paciente';
    return u;
  });
}

export function normalizarAdministradores(d: unknown): UsuarioAdmin[] {
  return lista(d).map((a) => {
    const u = base('Administrador', a.id as number, textoLimpio(a.nombre) ?? 'Administrador', true);
    u.correo = textoLimpio(a.correo);
    u.telefono = textoLimpio(a.telefono);
    u.fechaNac = normalizarFechaNac(a.fechaNac);
    u.cargo = textoLimpio(a.cargo);
    u.fechaIngreso = normalizarFechaNac(a.fechaIn);
    u.admitidoPor = textoLimpio(a.admitidoPor);
    u.resumen = u.cargo ?? 'Administrador';
    return u;
  });
}

// ------------------------------------------------------------------ perfil del administrador
export interface PerfilAdmin {
  idAdmin: number | null;
  nombre: string;
  correo: string | null;
  fechaNac: string | null;
  telefono: string | null;
  cargo: string | null;
  fechaIngreso: string | null;
  admitidoPor: string | null;
}

export function normalizarPerfilAdmin(d: unknown): PerfilAdmin {
  const o = (d ?? {}) as Record<string, unknown>;
  const id = Number(o.id);
  return {
    idAdmin: o.id !== null && o.id !== undefined && Number.isFinite(id) ? id : null,
    nombre: textoLimpio(o.nombre) ?? '',
    correo: textoLimpio(o.correo),
    fechaNac: normalizarFechaNac(o.fechaNac),
    telefono: textoLimpio(o.telefono),
    cargo: textoLimpio(o.cargo),
    fechaIngreso: normalizarFechaNac(o.fechaIn),
    admitidoPor: textoLimpio(o.admitidoPor),
  };
}

// ------------------------------------------------------------------ datos de ejemplo del modo simulado (sin red)
const hoyIso = () => new Date().toISOString();
const MOCK_MEDICOS = [{ id: 1, nombre: 'Dr. Alejandro Morales', fechaNac: '1980-04-02', telefono: '71234567', correo: 'alejandro@ejemplo.test', matricula: 'N/A', departamento: 'La Paz', carnet: 'N/A', admitidoPor: 'Sistema' }];
const MOCK_PACIENTES = [{ id: 1, nombre: 'Lucía Domínguez', ci: 'lucia@ejemplo.test', fechaNac: '15/03/1990', genero: 'Femenino', telefono: '72345678', correo: 'lucia@ejemplo.test', medico: 'Dra. Carmen Silva', afecciones: [{ afeccion: 'Diabetes Tipo 1' }], tratamientos: [{ titulo: 'Insulina', desc: '', dosis: '14' }], admitidoPor: 'Sistema' }];
const MOCK_ADMINS = [{ id: 2, nombre: 'Mariana Rivas', correo: 'admin@email.com', fechaNac: '01/01/1985', telefono: '70000000', cargo: 'Seguridad', fechaIn: '10/10/2024', admitidoPor: 'Sistema' }];

// ------------------------------------------------------------------ listas
/** GET /api/administradores/medicos/solicitantes */
export async function obtenerMedicosSolicitantes(): Promise<UsuarioAdmin[]> {
  if (USE_MOCK) return normalizarMedicosAdmin(MOCK_MEDICOS, false);
  return normalizarMedicosAdmin(await solicitar<unknown>({ base: API_BASE_URL, ruta: '/api/administradores/medicos/solicitantes' }), false);
}

/** GET /api/administradores/medicos/activos */
export async function obtenerMedicosActivos(): Promise<UsuarioAdmin[]> {
  if (USE_MOCK) return normalizarMedicosAdmin(MOCK_MEDICOS, true);
  return normalizarMedicosAdmin(await solicitar<unknown>({ base: API_BASE_URL, ruta: '/api/administradores/medicos/activos' }), true);
}

/** GET /api/administradores/pacientes/solicitantes */
export async function obtenerPacientesSolicitantes(): Promise<UsuarioAdmin[]> {
  if (USE_MOCK) return normalizarPacientesAdmin(MOCK_PACIENTES, false);
  return normalizarPacientesAdmin(await solicitar<unknown>({ base: API_BASE_URL, ruta: '/api/administradores/pacientes/solicitantes' }), false);
}

/** GET /api/administradores/pacientes/activos */
export async function obtenerPacientesActivos(): Promise<UsuarioAdmin[]> {
  if (USE_MOCK) return normalizarPacientesAdmin(MOCK_PACIENTES, true);
  return normalizarPacientesAdmin(await solicitar<unknown>({ base: API_BASE_URL, ruta: '/api/administradores/pacientes/activos' }), true);
}

/** GET /api/administradores/obtenerAdmins/{id_admin}: los demás administradores (sin el 1 ni el propio). */
export async function obtenerAdministradores(idAdmin: number): Promise<UsuarioAdmin[]> {
  if (USE_MOCK) return normalizarAdministradores(MOCK_ADMINS);
  return normalizarAdministradores(
    await solicitar<unknown>({ base: API_BASE_URL, ruta: `/api/administradores/obtenerAdmins/${encodeURIComponent(String(idAdmin))}` }),
  );
}

/** GET /api/administradores/perfilAdmin/{id_usuario} */
export async function obtenerPerfilAdmin(idUsuario: number): Promise<PerfilAdmin> {
  if (USE_MOCK) return normalizarPerfilAdmin({ id: 1, nombre: 'Mariana Rivas', correo: 'admin@email.com', fechaNac: '01/01/1985', telefono: '70000000', cargo: 'Seguridad y Control de Acceso', fechaIn: '10/10/2024', admitidoPor: 'Sistema' });
  const d = await solicitar<unknown>({
    base: API_BASE_URL,
    ruta: `/api/administradores/perfilAdmin/${encodeURIComponent(String(idUsuario))}`,
    mensajes: { 404: 'No se encontró tu perfil de administrador.' },
  });
  if (!d || typeof d !== 'object') throw new ErrorApi('respuesta', MENSAJES.respuesta);
  return normalizarPerfilAdmin(d);
}

// ------------------------------------------------------------------ activar
/**
 * PUT /api/administradores/{medico|paciente}/activar/{id} con {idAdmin}. Solo activa la cuenta (usuario.estado = true):
 * el backend no tiene rechazo, desactivación ni edición.
 */
export async function activarUsuario(rol: 'Paciente' | 'Médico', id: number, idAdmin: number): Promise<void> {
  if (!Number.isInteger(idAdmin) || idAdmin <= 0) {
    throw new ErrorApi('http', 'No se pudo identificar al administrador. Cierra sesión e inicia de nuevo.', 400);
  }
  if (USE_MOCK) return;
  await solicitar<unknown>({
    base: API_BASE_URL,
    ruta: `/api/administradores/${rol === 'Médico' ? 'medico' : 'paciente'}/activar/${encodeURIComponent(String(id))}`,
    metodo: 'PUT',
    cuerpo: { idAdmin },
    mensajes: {
      400: 'No se pudo identificar al administrador. Cierra sesión e inicia de nuevo.',
      404: 'No se encontró la cuenta a activar.',
    },
  });
}

// ------------------------------------------------------------------ auditoría
export interface EventoAuditoria {
  id: number;
  /** Fecha ISO tal como la devuelve la base (puede faltar o ser inválida). */
  fecha: string | null;
  rol: string;
  operacion: string;
  /** Ruta con los números sustituidos por {id}. */
  endpoint: string;
  exito: boolean;
  codigo: number | null;
  /** IP de origen enmascarada (a.b.c.xxx). */
  ip: string;
  idUsuario: number | null;
}

/** Convierte las filas de auditoría descartando nombres y enmascarando la IP y las rutas. */
export function normalizarAuditoria(d: unknown): EventoAuditoria[] {
  if (!Array.isArray(d)) throw new ErrorApi('respuesta', MENSAJES.respuesta);
  return d
    .filter((e) => e && typeof e.id === 'number')
    .map((e) => ({
      id: e.id as number,
      fecha: typeof e.fecha === 'string' ? e.fecha : null,
      rol: typeof e.rol === 'string' ? e.rol : '',
      operacion: typeof e.operacion === 'string' ? e.operacion : '',
      endpoint: sanitizarEndpoint(typeof e.endpoint === 'string' ? e.endpoint : ''),
      exito: e.exito === true,
      codigo: typeof e.codigo_http === 'number' ? e.codigo_http : null,
      ip: enmascararIp(e.ip_origen),
      idUsuario: typeof e.id_usuario === 'number' ? e.id_usuario : null,
    }));
}

/** GET /api/general/auditoria (toda la tabla; la paginación se hace en el cliente). */
export async function obtenerAuditoria(): Promise<EventoAuditoria[]> {
  if (USE_MOCK) {
    return normalizarAuditoria([
      { id: 3, fecha: hoyIso(), rol: 'login', endpoint: '/api/login', operacion: 'POST', exito: true, codigo_http: 200, ip_origen: '192.168.1.20', id_usuario: 1 },
      { id: 2, fecha: hoyIso(), rol: 'paciente', endpoint: '/api/pacientes/registrarGlucosa', operacion: 'POST', exito: true, codigo_http: 200, ip_origen: '192.168.1.21', id_usuario: 2 },
      { id: 1, fecha: hoyIso(), rol: 'medico', endpoint: '/api/medicos/alertasActivas/7', operacion: 'GET', exito: false, codigo_http: 500, ip_origen: '192.168.1.22', id_usuario: 3 },
    ]);
  }
  return normalizarAuditoria(await solicitar<unknown>({ base: API_BASE_URL, ruta: '/api/general/auditoria', timeoutMs: 30000 }));
}
