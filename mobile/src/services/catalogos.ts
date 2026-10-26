// Catálogos para el registro de paciente (solo lecturas): niveles de actividad, enfermedades, tratamientos y médicos.
import { API_BASE_URL, USE_MOCK } from './config.ts';
import { solicitar, ErrorApi, MENSAJES } from './http.ts';

export interface Opcion {
  id: number;
  etiqueta: string;
  detalle?: string;
}

async function lista(ruta: string): Promise<Record<string, unknown>[]> {
  const d = await solicitar<unknown>({ base: API_BASE_URL, ruta });
  if (!Array.isArray(d)) throw new ErrorApi('respuesta', MENSAJES.respuesta);
  return d as Record<string, unknown>[];
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const txt = (v: unknown): string => (typeof v === 'string' ? v : '');

/** GET /api/general/niveles -> [{id_nivel_actividad, descripcion}] */
export async function obtenerNiveles(): Promise<Opcion[]> {
  if (USE_MOCK) return [{ id: 1, etiqueta: 'Baja' }, { id: 2, etiqueta: 'Moderada' }, { id: 3, etiqueta: 'Alta' }];
  return (await lista('/api/general/niveles'))
    .filter((r) => num(r.id_nivel_actividad) !== null)
    .map((r) => ({ id: r.id_nivel_actividad as number, etiqueta: txt(r.descripcion) || 'Sin descripción' }));
}

/** GET /api/general/enfermedades -> [{id_enfermedad, nombre_enfermedad}] */
export async function obtenerEnfermedades(): Promise<Opcion[]> {
  if (USE_MOCK) return [{ id: 1, etiqueta: 'Diabetes Tipo 2' }];
  return (await lista('/api/general/enfermedades'))
    .filter((r) => num(r.id_enfermedad) !== null)
    .map((r) => ({ id: r.id_enfermedad as number, etiqueta: txt(r.nombre_enfermedad) || 'Sin nombre' }));
}

/** GET /api/general/tratamientos -> [{id_tratamiento, nombre_tratamiento, descripcion}] */
export async function obtenerTratamientos(): Promise<Opcion[]> {
  if (USE_MOCK) return [{ id: 1, etiqueta: 'Metformina', detalle: 'Antidiabético oral' }];
  return (await lista('/api/general/tratamientos'))
    .filter((r) => num(r.id_tratamiento) !== null)
    .map((r) => ({
      id: r.id_tratamiento as number,
      etiqueta: txt(r.nombre_tratamiento) || 'Sin nombre',
      detalle: txt(r.descripcion) || undefined,
    }));
}

/** GET /api/medicos/ver -> [{id_medico, usuario: {nombre_completo}}] */
export async function obtenerMedicos(): Promise<Opcion[]> {
  if (USE_MOCK) return [{ id: 1, etiqueta: 'Dra. Carmen Silva' }];
  return (await lista('/api/medicos/ver'))
    .filter((r) => num(r.id_medico) !== null)
    .map((r) => ({
      id: r.id_medico as number,
      etiqueta: txt((r.usuario as Record<string, unknown> | null)?.nombre_completo) || 'Médico sin nombre',
    }));
}

/** GET /api/general/especialidades -> [{id_especialidad, nombre}] */
export async function obtenerEspecialidades(): Promise<Opcion[]> {
  if (USE_MOCK) return [{ id: 1, etiqueta: 'Endocrinología' }];
  return (await lista('/api/general/especialidades'))
    .filter((r) => num(r.id_especialidad) !== null)
    .map((r) => ({ id: r.id_especialidad as number, etiqueta: txt(r.nombre) || 'Sin nombre' }));
}
