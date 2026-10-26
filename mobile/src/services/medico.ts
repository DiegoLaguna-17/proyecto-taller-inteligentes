// Servicios del médico (design.md § Fase Móvil 3). id_rol = id_medico; id_usuario solo para el perfil.
import { API_BASE_URL, USE_MOCK } from './config.ts';
import { solicitar, ErrorApi, MENSAJES } from './http.ts';
import { comoParteMultipart, type ArchivoLocal } from './archivos.ts';
import { fechaIso } from './validaciones.ts';
import type { Tratamiento } from './paciente.ts';

/** Textos de relleno que devuelve el backend cuando falta un dato. La app los trata como vacíos. */
const RELLENO = new Set(['no registrado', 'n/a', 'sin especialidad', 'sistema', 'sin nombre']);
const limpio = (v: unknown): string | null => {
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return !t || RELLENO.has(t.toLowerCase()) ? null : t;
};

export { limpio as textoLimpio };

// ------------------------------------------------------------------ perfil del médico
export interface PerfilMedico {
  idMedico: number | null;
  nombre: string;
  /** dd/mm/aaaa */
  fechaNac: string | null;
  telefono: string | null;
  correo: string | null;
  /** URL del PDF de la matrícula, si está cargada. */
  matriculaUrl: string | null;
  /** URL de la imagen del carnet, si está cargada. */
  carnetUrl: string | null;
  especialidad: string | null;
  departamento: string | null;
}

export function normalizarPerfilMedico(d: unknown): PerfilMedico {
  const o = (d ?? {}) as Record<string, unknown>;
  const id = Number(o.id);
  return {
    idMedico: o.id !== null && o.id !== undefined && Number.isFinite(id) ? id : null,
    nombre: limpio(o.nombre) ?? '',
    fechaNac: limpio(o.fechaNac),
    telefono: limpio(o.telefono),
    correo: limpio(o.correo),
    matriculaUrl: limpio(o.matricula),
    carnetUrl: limpio(o.carnet),
    especialidad: limpio(o.especialidad),
    departamento: limpio(o.departamento),
  };
}

// Datos de ejemplo del modo simulado (EXPO_PUBLIC_USE_MOCK=true). Sin red.
const PERFIL_MEDICO_MOCK: PerfilMedico = {
  idMedico: 1, nombre: 'Dra. Carmen Silva', fechaNac: '10/05/1985', telefono: '71234567', correo: 'doctor@email.com',
  matriculaUrl: 'https://ejemplo.invalid/matricula.pdf', carnetUrl: null, especialidad: 'Endocrinología', departamento: 'La Paz',
};

/** GET /api/medicos/perfil/{id_usuario} */
export async function obtenerPerfilMedico(idUsuario: number): Promise<PerfilMedico> {
  if (USE_MOCK) return PERFIL_MEDICO_MOCK;
  const d = await solicitar<unknown>({
    base: API_BASE_URL,
    ruta: `/api/medicos/perfil/${encodeURIComponent(String(idUsuario))}`,
    mensajes: { 404: 'No se encontró tu perfil de médico.' },
  });
  if (!d || typeof d !== 'object') throw new ErrorApi('respuesta', MENSAJES.respuesta);
  return normalizarPerfilMedico(d);
}

// ------------------------------------------------------------------ pacientes del médico
export interface PacienteMedico {
  /** id_paciente */
  id: number;
  nombre: string;
  correo: string | null;
  /** dd/mm/aaaa */
  fechaNac: string | null;
  genero: string | null;
  /** kg, como texto */
  peso: string | null;
  /** METROS, como texto (numeric(4,2) en la base) */
  altura: string | null;
  actividadFisica: string | null;
  telefono: string | null;
  nombreEmergencia: string | null;
  numeroEmergencia: string | null;
  fotoPerfil: string | null;
  afecciones: string[];
  tratamientos: Tratamiento[];
}

export function normalizarPacientes(d: unknown): PacienteMedico[] {
  if (!Array.isArray(d)) throw new ErrorApi('respuesta', MENSAJES.respuesta);
  return d
    .filter((p) => p && typeof p.id === 'number')
    .map((p) => ({
      id: p.id as number,
      nombre: limpio(p.nombre) ?? 'Paciente',
      correo: limpio(p.correo),
      fechaNac: limpio(p.fechaNac),
      genero: limpio(p.genero),
      peso: limpio(p.peso),
      altura: limpio(p.altura),
      actividadFisica: limpio(p.actividadFisica),
      telefono: limpio(p.telefono),
      nombreEmergencia: limpio(p.nombre_emergencia),
      numeroEmergencia: limpio(p.numero_emergencia),
      fotoPerfil: limpio(p.foto_perfil),
      afecciones: Array.isArray(p.afecciones)
        ? p.afecciones.map((a: { afeccion?: unknown }) => limpio(a?.afeccion)).filter((a: string | null): a is string => a !== null)
        : [],
      tratamientos: Array.isArray(p.tratamientos)
        ? p.tratamientos.map((t: Record<string, unknown>) => ({
            titulo: limpio(t?.titulo) ?? 'Tratamiento',
            descripcion: limpio(t?.desc) ?? '',
            dosis: limpio(t?.dosis),
          }))
        : [],
    }));
}

const PACIENTES_MOCK: PacienteMedico[] = [
  { id: 1, nombre: 'Carlos Méndez', correo: 'carlos@email.com', fechaNac: '15/03/1980', genero: 'Masculino', peso: '80', altura: '1.76', actividadFisica: 'MODERADO',
    telefono: '71234567', nombreEmergencia: 'María', numeroEmergencia: '71234568', fotoPerfil: null, afecciones: ['Diabetes Tipo 2'],
    tratamientos: [{ titulo: 'Metformina', descripcion: 'Antidiabético oral', dosis: '850' }] },
  { id: 2, nombre: 'Elena Soto', correo: 'elena@email.com', fechaNac: '02/11/1976', genero: 'Femenino', peso: '65', altura: '1.62', actividadFisica: 'SEDENTARIO',
    telefono: '72345678', nombreEmergencia: 'Luis', numeroEmergencia: '72345679', fotoPerfil: null, afecciones: ['Diabetes Tipo 1'],
    tratamientos: [{ titulo: 'Insulina', descripcion: 'Insulina basal', dosis: '14' }] },
];

/** GET /api/medicos/misPacientes/{id_medico} */
export async function obtenerPacientesMedico(idMedico: number): Promise<PacienteMedico[]> {
  if (USE_MOCK) return PACIENTES_MOCK;
  const d = await solicitar<unknown>({
    base: API_BASE_URL,
    ruta: `/api/medicos/misPacientes/${encodeURIComponent(String(idMedico))}`,
  });
  return normalizarPacientes(d);
}

// ------------------------------------------------------------------ alertas del médico
export interface AlertaMedico {
  /** id_alerta */
  id: number;
  /** Texto del tipo de alerta tal como lo guarda la base. */
  nivel: string;
  idPaciente: number | null;
  paciente: string;
  /** aaaa-mm-dd */
  fecha: string;
  /** hh:mm */
  hora: string | null;
  glucosa: number | null;
  momento: string;
  observaciones: string;
  /** Respuesta del médico (solo resueltas). */
  mensaje: string;
}

export function normalizarAlertas(d: unknown): AlertaMedico[] {
  if (!Array.isArray(d)) throw new ErrorApi('respuesta', MENSAJES.respuesta);
  return d
    .filter((a) => a && typeof a.id === 'number' && typeof a.fecha === 'string')
    .map((a) => ({
      id: a.id as number,
      nivel: typeof a.nivel === 'string' ? a.nivel : '',
      idPaciente: typeof a.idpaciente === 'number' ? a.idpaciente : null,
      paciente: typeof a.paciente === 'string' && a.paciente.trim() ? a.paciente : 'Paciente',
      fecha: String(a.fecha).slice(0, 10),
      hora: typeof a.hora === 'string' ? a.hora.slice(0, 5) : null,
      glucosa: typeof a.glucosa === 'number' ? a.glucosa : null,
      momento: typeof a.momento === 'string' ? a.momento : '',
      observaciones: typeof a.observaciones === 'string' ? a.observaciones : '',
      mensaje: typeof a.mensaje === 'string' ? a.mensaje : '',
    }));
}

function alertasMock(activas: boolean): AlertaMedico[] {
  const hoy = fechaIso(new Date());
  return activas
    ? [{ id: 1, nivel: 'Hipoglucemia', idPaciente: 2, paciente: 'Elena Soto', fecha: hoy, hora: '13:10', glucosa: 62, momento: 'ANTES DE DORMIR', observaciones: 'Mareo', mensaje: '' }]
    : [{ id: 2, nivel: 'Hiperglucemia', idPaciente: 1, paciente: 'Carlos Méndez', fecha: hoy, hora: '09:00', glucosa: 215, momento: 'DESPUES DE COMER', observaciones: '', mensaje: 'Controlar la dieta y medir de nuevo en 2 horas.' }];
}

/** GET /api/medicos/alertasActivas/{id_medico} */
export async function obtenerAlertasActivas(idMedico: number): Promise<AlertaMedico[]> {
  if (USE_MOCK) return alertasMock(true);
  return normalizarAlertas(await solicitar<unknown>({ base: API_BASE_URL, ruta: `/api/medicos/alertasActivas/${encodeURIComponent(String(idMedico))}` }));
}

/** GET /api/medicos/alertasResueltas/{id_medico} */
export async function obtenerAlertasResueltas(idMedico: number): Promise<AlertaMedico[]> {
  if (USE_MOCK) return alertasMock(false);
  return normalizarAlertas(await solicitar<unknown>({ base: API_BASE_URL, ruta: `/api/medicos/alertasResueltas/${encodeURIComponent(String(idMedico))}` }));
}

export const RESPUESTA_MIN = 3;
export const RESPUESTA_MAX = 500;

/** Mensaje de error de la respuesta del médico (null si es válida). Los límites los fija la app; el backend solo exige no vacío. */
export function validarRespuesta(texto: string): string | null {
  const t = texto.trim();
  if (t.length < RESPUESTA_MIN) return `Escribe tu respuesta (mínimo ${RESPUESTA_MIN} caracteres).`;
  if (t.length > RESPUESTA_MAX) return `La respuesta no puede superar ${RESPUESTA_MAX} caracteres.`;
  return null;
}

/** POST /api/medicos/responder/alerta. Al terminar, la alerta pasa a "resuelta". */
export async function responderAlerta(p: { idMedico: number; idAlerta: number; mensaje: string; hoy?: Date }): Promise<void> {
  if (USE_MOCK) return;
  await solicitar<unknown>({
    base: API_BASE_URL,
    ruta: '/api/medicos/responder/alerta',
    metodo: 'POST',
    cuerpo: {
      id_medico: p.idMedico,
      fecha_registro: fechaIso(p.hoy ?? new Date()),
      mensaje: p.mensaje.trim(),
      alertas_id_alerta: p.idAlerta,
    },
    mensajes: { 400: 'Faltan datos para responder la alerta.' },
  });
}

// ------------------------------------------------------------------ edición del médico
export interface ActualizacionMedico {
  telefono?: string;
  correo?: string;
  departamento?: string;
  carnet?: ArchivoLocal;
}

/** FormData de PUT /api/medicos/actualizar: solo los campos presentes (el backend borra los que llegan vacíos). */
export function construirFormDataMedico(c: ActualizacionMedico): FormData {
  const datos = new FormData();
  if (c.telefono !== undefined) datos.append('telefono', c.telefono);
  if (c.correo !== undefined) datos.append('correo', c.correo);
  if (c.departamento !== undefined) datos.append('departamento', c.departamento);
  if (c.carnet) datos.append('carnet', comoParteMultipart(c.carnet));
  return datos;
}

/** PUT /api/medicos/actualizar/{id_medico} (multipart). */
export async function actualizarMedico(idMedico: number, cambios: ActualizacionMedico): Promise<void> {
  if (USE_MOCK) return;
  await solicitar<unknown>({
    base: API_BASE_URL,
    ruta: `/api/medicos/actualizar/${encodeURIComponent(String(idMedico))}`,
    metodo: 'PUT',
    cuerpo: construirFormDataMedico(cambios),
    timeoutMs: 60000, // puede incluir la subida del carnet
    mensajes: { 404: 'No se encontró tu cuenta de médico.' },
  });
}
