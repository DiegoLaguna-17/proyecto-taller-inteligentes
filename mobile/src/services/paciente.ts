// Perfil del paciente: lectura, semanas de embarazo y actualización (design.md § Fase Móvil 2).
import { API_BASE_URL, USE_MOCK } from './config.ts';
import { solicitar, ErrorApi, MENSAJES } from './http.ts';

export interface Tratamiento {
  titulo: string;
  descripcion: string;
  dosis: string | null;
}

export interface PerfilPaciente {
  nombre: string;
  /** id_usuario (el PUT actualizarPaciente usa este id, no el id_paciente). */
  idUsuario: number | null;
  /** dd/mm/aaaa, tal como lo devuelve el backend. */
  fechaNac: string | null;
  genero: string | null;
  /** En METROS, tal como la guarda y la devuelve el backend (p. ej. "1.70"). */
  altura: string | null;
  peso: string | null;
  telefono: string | null;
  correo: string | null;
  nombreEmergencia: string | null;
  numeroEmergencia: string | null;
  fotoPerfil: string | null;
  nombreMedico: string | null;
  nivelActividad: string | null;
  afecciones: string[];
  tratamientos: Tratamiento[];
  embarazo: boolean;
}

const texto = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : null;

/** Convierte la respuesta de GET /api/pacientes/perfil/{id} al modelo de la app. */
export function normalizarPerfil(d: unknown): PerfilPaciente {
  const o = (d ?? {}) as Record<string, unknown>;
  const idUsuario = Number(o.id);
  const actividad = (o.actividadFisica ?? {}) as Record<string, unknown>;
  return {
    nombre: texto(o.nombre) ?? '',
    idUsuario: Number.isFinite(idUsuario) && o.id !== null && o.id !== undefined ? idUsuario : null,
    fechaNac: texto(o.fechaNac),
    genero: texto(o.genero),
    altura: texto(o.altura),
    peso: texto(o.peso),
    telefono: texto(o.telefono),
    correo: texto(o.correo),
    nombreEmergencia: texto(o.nombre_emergencia),
    numeroEmergencia: texto(o.numero_emergencia),
    fotoPerfil: texto(o.foto_perfil),
    nombreMedico: texto(o.nombre_medico),
    nivelActividad: texto(actividad.nivel) ?? texto(actividad.descripcion),
    afecciones: Array.isArray(o.afecciones) ? o.afecciones.filter((a): a is string => typeof a === 'string') : [],
    tratamientos: Array.isArray(o.tratamientos)
      ? o.tratamientos.map((t) => {
          const x = (t ?? {}) as Record<string, unknown>;
          return { titulo: texto(x.titulo) ?? '', descripcion: texto(x.descripcion) ?? '', dosis: texto(x.dosis) };
        })
      : [],
    embarazo: o.embarazo === true,
  };
}

// Perfil de ejemplo del modo simulado (EXPO_PUBLIC_USE_MOCK=true). Sin red.
const PERFIL_MOCK: PerfilPaciente = {
  nombre: 'Carlos Méndez',
  idUsuario: 1,
  fechaNac: '15/03/1980',
  genero: 'Masculino',
  altura: '1.76', // metros, como la devuelve el backend
  peso: '80',
  telefono: '71234567',
  correo: 'carlos@email.com',
  nombreEmergencia: 'María Méndez',
  numeroEmergencia: '71234568',
  fotoPerfil: null,
  nombreMedico: 'Dra. Carmen Silva',
  nivelActividad: 'Moderada',
  afecciones: ['Diabetes Tipo 2'],
  tratamientos: [{ titulo: 'Metformina', descripcion: 'Antidiabético oral', dosis: '850 mg' }],
  embarazo: false,
};

/** GET /api/pacientes/perfil/{id_paciente} */
export async function obtenerPerfil(idPaciente: number): Promise<PerfilPaciente> {
  if (USE_MOCK) return PERFIL_MOCK;
  const d = await solicitar<unknown>({
    base: API_BASE_URL,
    ruta: `/api/pacientes/perfil/${encodeURIComponent(String(idPaciente))}`,
    mensajes: { 404: 'No se encontró tu perfil de paciente.' },
  });
  if (!d || typeof d !== 'object') throw new ErrorApi('respuesta', MENSAJES.respuesta);
  return normalizarPerfil(d);
}

/** GET /api/pacientes/obtenerDatosEmbarazo/{id_paciente} -> semanas actuales (cálculo del servidor) o null. */
export async function obtenerSemanasEmbarazo(idPaciente: number): Promise<number | null> {
  if (USE_MOCK) return null;
  const d = await solicitar<{ semanas_actuales?: unknown }>({
    base: API_BASE_URL,
    ruta: `/api/pacientes/obtenerDatosEmbarazo/${encodeURIComponent(String(idPaciente))}`,
  });
  return typeof d?.semanas_actuales === 'number' ? d.semanas_actuales : null;
}

/** Cuerpo de PUT /api/pacientes/actualizarPaciente/{id_usuario}: el backend exige los siete primeros campos. */
export interface ActualizacionPaciente {
  nombre: string;
  /** En METROS con dos decimales (numeric(4,2) en la base): "1.70". */
  altura: string;
  peso: string;
  telefono: string;
  correo: string;
  nombre_emergencia: string;
  numero_emergencia: string;
  // Solo si cambió el estado de embarazo (cada envío con semanas > 0 crea un seguimiento nuevo)
  embarazo?: boolean;
  semanas_embarazo?: number;
  fecha_terminacion?: string;
}

/** PUT /api/pacientes/actualizarPaciente/{id_usuario} */
export async function actualizarPaciente(idUsuario: number, cuerpo: ActualizacionPaciente): Promise<void> {
  if (USE_MOCK) return;
  await solicitar<unknown>({
    base: API_BASE_URL,
    ruta: `/api/pacientes/actualizarPaciente/${encodeURIComponent(String(idUsuario))}`,
    metodo: 'PUT',
    cuerpo,
    mensajes: {
      400: 'Faltan datos obligatorios. Revisa el formulario.',
      404: 'No se encontró tu cuenta de paciente.',
    },
  });
}
