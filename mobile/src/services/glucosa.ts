import { API_BASE_URL, USE_MOCK } from './config.ts';
import { solicitar, ErrorApi, MENSAJES } from './http.ts';
import { esperarMock } from './latenciaMock.ts';
import { leerRiesgoMl, type RiesgoMl } from './riesgoMl.ts';

export interface Momento {
  id_momento: number;
  momento: string;
}

export interface DatosPaciente {
  id_paciente: number;
  id_medico: number | null;
  edad: number | null;
  embarazo: boolean;
  enfermedades: string[];
}

export interface RegistroHistorial {
  id: number;
  /** YYYY-MM-DD */
  fecha: string;
  hora: string | null;
  nivelGlucosa: number | null;
  momentoDia: string | null;
  observaciones: string | null;
  tipo_alerta: string | null;
}

export interface NuevaToma {
  id_paciente: number;
  id_momento: number;
  nivel_glucosa: number;
  /** YYYY-MM-DD (fecha local del dispositivo) */
  fecha: string;
  /** HH:MM:SS (hora local del dispositivo) */
  hora: string;
  observaciones?: string;
}

/** Cuerpo de POST /api/medicos/registrar/glucosa: la lectura la registra el MÉDICO por el paciente. */
export interface NuevaTomaMedico extends NuevaToma {
  /** id_medico de la sesión (quien registra). */
  id_medico: number;
}

export interface NuevaAlerta {
  /** 1 = hipoglucemia, 2 = hiperglucemia */
  id_tipo_alerta: 1 | 2;
  id_registro: number;
  id_medico: number;
  fecha_alerta: string;
}

// ---- Datos locales del modo simulado (EXPO_PUBLIC_USE_MOCK=true). Sin red. SIMULADO ----
const MOMENTOS_MOCK: Momento[] = [
  { id_momento: 1, momento: 'AYUNAS' },
  { id_momento: 2, momento: 'DESPUES DE COMER' },
  { id_momento: 3, momento: 'ANTES DE DORMIR' },
];

function registrosMock(): RegistroHistorial[] {
  const ahora = new Date();
  const dia = (atras: number) => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - atras);
    const dos = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  };
  const r = (id: number, atras: number, hora: string, v: number, m: string, a: string | null): RegistroHistorial => ({
    id, fecha: dia(atras), hora, nivelGlucosa: v, momentoDia: m, observaciones: null, tipo_alerta: a,
  });
  return [
    r(8, 0, '14:30', 124, 'DESPUES DE COMER', null),
    r(7, 0, '08:30', 112, 'AYUNAS', null),
    r(6, 1, '23:15', 68, 'ANTES DE DORMIR', 'hipoglucemia'),
    r(5, 1, '15:00', 195, 'DESPUES DE COMER', 'hiperglucemia'),
    r(4, 2, '08:10', 105, 'AYUNAS', null),
    r(3, 4, '22:40', 118, 'ANTES DE DORMIR', null),
    r(2, 6, '14:05', 132, 'DESPUES DE COMER', null),
    r(1, 12, '08:20', 98, 'AYUNAS', null),
  ];
}

/** GET /api/general/momentos */
export async function obtenerMomentos(): Promise<Momento[]> {
  if (USE_MOCK) return MOMENTOS_MOCK;
  const datos = await solicitar<Momento[]>({ base: API_BASE_URL, ruta: '/api/general/momentos' });
  if (!Array.isArray(datos)) throw new ErrorApi('respuesta', MENSAJES.respuesta);
  return datos.filter((m) => typeof m?.id_momento === 'number' && typeof m?.momento === 'string');
}

/** GET /api/registro/datosGlucosa/{id_rol} */
export async function obtenerDatosPaciente(idPaciente: number): Promise<DatosPaciente> {
  if (USE_MOCK) {
    return { id_paciente: idPaciente, id_medico: 1, edad: 45, embarazo: false, enfermedades: ['Diabetes Tipo 2'] };
  }
  const d = await solicitar<Partial<DatosPaciente>>({
    base: API_BASE_URL,
    ruta: `/api/registro/datosGlucosa/${encodeURIComponent(String(idPaciente))}`,
    mensajes: { 404: 'No se encontraron tus datos de paciente.' },
  });
  if (!d || typeof d !== 'object') throw new ErrorApi('respuesta', MENSAJES.respuesta);
  return {
    id_paciente: idPaciente,
    id_medico: typeof d.id_medico === 'number' ? d.id_medico : null,
    edad: typeof d.edad === 'number' ? d.edad : null,
    embarazo: d.embarazo === true,
    enfermedades: Array.isArray(d.enfermedades) ? d.enfermedades.filter((e) => typeof e === 'string') : [],
  };
}

/** POST /api/pacientes/registrarGlucosa -> id del registro creado. */
export async function registrarGlucosa(toma: NuevaToma): Promise<{ id_registro: number | null }> {
  if (USE_MOCK) {
    await esperarMock();
    return { id_registro: 1 };
  }
  const d = await solicitar<{ registro_glucosa?: { id_registro?: unknown }; id_registro?: unknown }>({
    base: API_BASE_URL,
    ruta: '/api/pacientes/registrarGlucosa',
    metodo: 'POST',
    cuerpo: toma,
    mensajes: { 400: 'Faltan datos de la toma. Revisa el valor y el momento.' },
  });
  const id = d?.registro_glucosa?.id_registro ?? d?.id_registro;
  return { id_registro: typeof id === 'number' ? id : null };
}

/**
 * Modo simulado: `riesgo_ml` crudo según la ÚLTIMA CIFRA del nivel de glucosa (determinista; ver mobile/README.md).
 * 0 → undefined (ML apagado en el backend: la clave no existe). Pasa por el mismo `leerRiesgoMl` que la respuesta real.
 */
export function riesgoMlSimulado(nivelGlucosa: number): unknown {
  const sin = (motivo: string, faltantes: string[] = []) => ({ riesgo_hipoglucemia: null, version_modelo: null, motivo, supuestos: [], faltantes });
  const con = (riesgo: number) => ({
    riesgo_hipoglucemia: riesgo,
    version_modelo: '1.1.0',
    motivo: null,
    supuestos: ['duracion_estimada', 'comorbilidades_no_capturadas', 'hba1c_no_disponible'],
    faltantes: [],
  });
  switch (Math.abs(Math.trunc(nivelGlucosa)) % 10) {
    case 1: return con(0.1712);
    case 2: return sin('datos_insuficientes', ['imc']);
    case 3: return sin('datos_insuficientes', ['imc', 'medicacion']);
    case 4: return sin('datos_insuficientes');
    case 5: return sin('no_aplica_tipo');
    case 6: return sin('momento_no_cubierto');
    case 7: return sin('no_disponible');
    case 8: return con(0);
    case 9: return con(1);
    default: return undefined;
  }
}

/**
 * POST /api/medicos/registrar/glucosa -> id del registro creado (misma tabla que la lectura del paciente, con id_medico)
 * y, solo si el backend tiene el ML activo, el riesgo informativo (`riesgo_ml`). Leer el riesgo nunca puede hacer fallar el registro.
 */
export async function registrarGlucosaMedico(toma: NuevaTomaMedico): Promise<{ id_registro: number | null; riesgoMl: RiesgoMl | null }> {
  if (USE_MOCK) {
    await esperarMock();
    return { id_registro: 1, riesgoMl: leerRiesgoMl(riesgoMlSimulado(toma.nivel_glucosa)) }; // modo simulado: sin red
  }
  const d = await solicitar<{ registro_glucosa?: { id_registro?: unknown }; id_registro?: unknown; riesgo_ml?: unknown }>({
    base: API_BASE_URL,
    ruta: '/api/medicos/registrar/glucosa',
    metodo: 'POST',
    cuerpo: toma,
    mensajes: { 400: 'Faltan datos de la toma. Revisa el valor y el momento.' },
  });
  const id = d?.registro_glucosa?.id_registro ?? d?.id_registro;
  let riesgoMl: RiesgoMl | null = null;
  try {
    riesgoMl = leerRiesgoMl(d?.riesgo_ml);
  } catch {
    riesgoMl = null;
  }
  return { id_registro: typeof id === 'number' ? id : null, riesgoMl };
}

/** POST /api/registro/registrarAlerta (el backend envía el correo al médico). */
export async function registrarAlerta(alerta: NuevaAlerta): Promise<void> {
  if (USE_MOCK) return;
  await solicitar<unknown>({
    base: API_BASE_URL,
    ruta: '/api/registro/registrarAlerta',
    metodo: 'POST',
    cuerpo: alerta,
  });
}

/** GET /api/pacientes/registros/{id_rol} -> más recientes primero. */
export async function obtenerRegistros(idPaciente: number): Promise<RegistroHistorial[]> {
  if (USE_MOCK) return registrosMock();
  const datos = await solicitar<unknown>({
    base: API_BASE_URL,
    ruta: `/api/pacientes/registros/${encodeURIComponent(String(idPaciente))}`,
  });
  if (!Array.isArray(datos)) throw new ErrorApi('respuesta', MENSAJES.respuesta);
  return datos
    .filter((r) => r && typeof r.fecha === 'string')
    .map((r) => ({
      id: Number(r.id),
      fecha: String(r.fecha).slice(0, 10),
      hora: typeof r.hora === 'string' ? r.hora : null,
      nivelGlucosa: typeof r.nivelGlucosa === 'number' ? r.nivelGlucosa : null,
      momentoDia: typeof r.momentoDia === 'string' ? r.momentoDia : null,
      observaciones: typeof r.observaciones === 'string' ? r.observaciones : null,
      tipo_alerta: typeof r.tipo_alerta === 'string' ? r.tipo_alerta : null,
    }));
}
