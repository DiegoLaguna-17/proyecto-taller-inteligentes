// Solicitud de registro de PACIENTE: validación, multipart y envío (POST /api/pacientes/registrarPaciente).
// El backend exige foto_perfil y sube el archivo ANTES de validar el resto: aquí se valida todo antes de enviar.
import { API_BASE_URL, USE_MOCK } from './config.ts';
import { ErrorApi, solicitar } from './http.ts';

// __DEV__ lo define React Native; fuera de la app (pruebas con node) no existe.
declare const __DEV__: boolean | undefined;
import {
  ALTURA_MAX_CM,
  ALTURA_MIN_CM,
  aNumero,
  alturaCmAMetros,
  esAlturaCm,
  esCorreo,
  esFechaIso,
  esNumeroPositivo,
  esSemanas,
  esTelefono,
  fechaIso,
} from './validaciones.ts';

export interface FotoPerfil {
  uri: string;
  /** Nombre con extensión (perfil.jpg | perfil.png). */
  nombre: string;
  /** MIME completo: image/jpeg | image/png. */
  tipo: string;
  /** Tamaño en bytes que informa el selector de fotos (solo para el registro de desarrollo). */
  bytes?: number;
}

export interface SolicitudPaciente {
  nombreCompleto: string;
  correo: string;
  contrasena: string;
  /** AAAA-MM-DD */
  fechaNac: string;
  telefono: string;
  genero: '' | 'Masculino' | 'Femenino';
  embarazada: boolean;
  semanas: string;
  peso: string;
  /** En CENTÍMETROS (lo que escribe el usuario); se envía en metros. */
  altura: string;
  idMedico: number | null;
  idActividad: number | null;
  enfermedadId: number | null;
  tratamientoId: number | null;
  dosis: string;
  nombreEmergencia: string;
  numeroEmergencia: string;
  foto: FotoPerfil | null;
}

export const SOLICITUD_VACIA: SolicitudPaciente = {
  nombreCompleto: '', correo: '', contrasena: '', fechaNac: '', telefono: '', genero: '', embarazada: false, semanas: '',
  peso: '', altura: '', idMedico: null, idActividad: null, enfermedadId: null, tratamientoId: null, dosis: '',
  nombreEmergencia: '', numeroEmergencia: '', foto: null,
};

/** Longitud mínima de la contraseña (la regla que ya mostraba el formulario; el backend no valida). */
export const MIN_CONTRASENA = 8;

/** Errores por campo (vacío = válido). Cubre todos los campos obligatorios del backend. */
export function validarSolicitudPaciente(s: SolicitudPaciente, hoy: Date = new Date()): Record<string, string> {
  const e: Record<string, string> = {};
  if (s.nombreCompleto.trim().length < 3) e.nombreCompleto = 'Escribe tu nombre completo.';
  if (!esCorreo(s.correo)) e.correo = 'Escribe un correo válido.';
  if (s.contrasena.length < MIN_CONTRASENA) e.contrasena = `Mínimo ${MIN_CONTRASENA} caracteres.`;
  if (!esFechaIso(s.fechaNac)) e.fechaNac = 'Usa el formato AAAA-MM-DD.';
  else if (s.fechaNac.trim() > fechaIso(hoy)) e.fechaNac = 'La fecha no puede ser futura.';
  else if (Number(s.fechaNac.slice(0, 4)) < hoy.getFullYear() - 120) e.fechaNac = 'Revisa el año de nacimiento.';
  if (!esTelefono(s.telefono)) e.telefono = 'Escribe un teléfono de 7 u 8 dígitos.';
  if (!s.genero) e.genero = 'Selecciona tu género.';
  if (s.genero === 'Femenino' && s.embarazada && !esSemanas(s.semanas)) e.semanas = 'Indica las semanas (1 a 42).';
  if (!esNumeroPositivo(s.peso, 500)) e.peso = 'Escribe tu peso en kg (ej. 72.5).';
  if (!esAlturaCm(s.altura)) e.altura = `Escribe tu altura en centímetros, entre ${ALTURA_MIN_CM} y ${ALTURA_MAX_CM} (ej. 165).`;
  if (s.idMedico === null) e.idMedico = 'Selecciona tu médico.';
  if (s.idActividad === null) e.idActividad = 'Selecciona tu nivel de actividad.';
  if (s.enfermedadId === null) e.enfermedadId = 'Selecciona tu afección.';
  if (s.tratamientoId === null) e.tratamientoId = 'Selecciona tu tratamiento.';
  if (!s.dosis.trim()) e.dosis = 'Indica la dosis de tu tratamiento.';
  if (!s.nombreEmergencia.trim()) e.nombreEmergencia = 'Escribe el nombre de tu contacto de emergencia.';
  if (!esTelefono(s.numeroEmergencia)) e.numeroEmergencia = 'Escribe un teléfono de 7 u 8 dígitos.';
  if (!s.foto) e.foto = 'La foto de perfil es obligatoria.';
  return e;
}

/** Campos de texto del multipart (nombres exactos del backend). Booleanos como "true"/"false". */
export function camposSolicitud(s: SolicitudPaciente): [string, string][] {
  const embarazada = s.genero === 'Femenino' && s.embarazada;
  const campos: [string, string][] = [
    ['nombre_completo', s.nombreCompleto.trim()],
    ['correo', s.correo.trim()],
    ['contrasena', s.contrasena],
    ['rol', 'paciente'],
    ['fecha_nac', s.fechaNac.trim()],
    ['telefono', s.telefono.trim()],
    ['id_medico', String(s.idMedico)],
    ['id_actividad', String(s.idActividad)],
    ['genero', s.genero],
    ['peso', String(aNumero(s.peso))],
    ['altura', alturaCmAMetros(s.altura)], // la base guarda metros (numeric(4,2)): 170 cm -> "1.70"
    ['enfermedad_id', String(s.enfermedadId)],
    ['tratamiento_id', String(s.tratamientoId)],
    ['dosis_', s.dosis.trim()],
    ['nombre_emergencia', s.nombreEmergencia.trim()],
    ['numero_emergencia', s.numeroEmergencia.trim()],
    ['embarazada', embarazada ? 'true' : 'false'],
  ];
  if (embarazada) campos.push(['semanas', String(Number(s.semanas))]);
  return campos;
}

/** FormData listo para enviar. En React Native el archivo se adjunta como {uri, name, type}. */
export function construirFormData(s: SolicitudPaciente): FormData {
  const datos = new FormData();
  for (const [clave, valor] of camposSolicitud(s)) datos.append(clave, valor);
  if (s.foto) {
    datos.append('foto_perfil', { uri: s.foto.uri, name: s.foto.nombre, type: s.foto.tipo } as unknown as Blob);
  }
  return datos;
}

/** Solo desarrollo: tipo MIME y tamaño del adjunto. Nunca su contenido, su ruta ni datos personales. */
function registrarAdjuntoDev(s: SolicitudPaciente): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && s.foto) {
    console.log(`[registro-paciente] adjunto: tipo=${s.foto.tipo} bytes=${s.foto.bytes ?? 'desconocido'}`);
  }
}

/**
 * Prueba de aislamiento (solo desarrollo): el mismo tipo de petición multipart SIN archivo y con un único campo
 * no personal. El servidor debe responder 400 "Archivo de perfil faltante" y no escribe nada. Si llega ese 400, el
 * multipart y la red funcionan y cualquier fallo está en el archivo; si falla, el problema es el envío multipart.
 */
export async function probarMultipartSinArchivo(): Promise<string> {
  const datos = new FormData();
  datos.append('rol', 'paciente');
  try {
    await solicitar<unknown>({ base: API_BASE_URL, ruta: '/api/pacientes/registrarPaciente', metodo: 'POST', cuerpo: datos });
    return 'respuesta inesperada: el servidor aceptó una solicitud sin archivo';
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 400) return 'OK: el servidor respondió 400 (el multipart sin archivo sí llega)';
    return e instanceof ErrorApi ? `FALLO [${e.codigo} ${e.estado}] el multipart sin archivo no llegó al servidor` : 'FALLO desconocido';
  }
}

/** POST /api/pacientes/registrarPaciente. Lanza ErrorApi si el backend rechaza la solicitud. */
export async function enviarSolicitudPaciente(s: SolicitudPaciente): Promise<void> {
  if (USE_MOCK) return;
  registrarAdjuntoDev(s);
  try {
    await solicitar<unknown>({
      base: API_BASE_URL,
      ruta: '/api/pacientes/registrarPaciente',
      metodo: 'POST',
      cuerpo: construirFormData(s),
      timeoutMs: 60000, // incluye la subida de la foto
      mensajes: {
        400: 'Faltan datos obligatorios o la foto. Revisa el formulario.',
      },
    });
  } catch (e) {
    // Si el envío falló sin llegar al servidor, la sonda dice si el multipart en sí funciona (solo desarrollo)
    if (typeof __DEV__ !== 'undefined' && __DEV__ && e instanceof ErrorApi && (e.codigo === 'red' || e.codigo === 'timeout')) {
      console.log(`[registro-paciente] sonda sin archivo: ${await probarMultipartSinArchivo()}`);
    }
    throw e;
  }
}
