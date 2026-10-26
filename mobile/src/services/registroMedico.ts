// Solicitud de registro de MÉDICO: validación completa ANTES de enviar y multipart (POST /api/medicos/registrar).
// El backend sube la matrícula y el carnet a Storage antes de validar el resto y no usa transacciones.
import { API_BASE_URL, USE_MOCK } from './config.ts';
import { solicitar } from './http.ts';
import { comoParteMultipart, validarArchivo, type ArchivoLocal } from './archivos.ts';
import { esCorreo, esFechaIso, fechaIso } from './validaciones.ts';
import { esTelefonoMedico } from './edicionMedico.ts';
import { MIN_CONTRASENA } from './registroPaciente.ts';

export interface SolicitudMedico {
  nombreCompleto: string;
  correo: string;
  contrasena: string;
  /** AAAA-MM-DD */
  fechaNac: string;
  telefono: string;
  departamento: string;
  idEspecialidad: number | null;
  matricula: ArchivoLocal | null;
  carnet: ArchivoLocal | null;
}

export const SOLICITUD_MEDICO_VACIA: SolicitudMedico = {
  nombreCompleto: '', correo: '', contrasena: '', fechaNac: '', telefono: '', departamento: '', idEspecialidad: null, matricula: null, carnet: null,
};

export function validarSolicitudMedico(s: SolicitudMedico, hoy: Date = new Date()): Record<string, string> {
  const e: Record<string, string> = {};
  if (s.nombreCompleto.trim().length < 3) e.nombreCompleto = 'Escribe tu nombre completo.';
  if (!esCorreo(s.correo)) e.correo = 'Escribe un correo válido.';
  if (s.contrasena.length < MIN_CONTRASENA) e.contrasena = `Mínimo ${MIN_CONTRASENA} caracteres.`;
  if (!esFechaIso(s.fechaNac)) e.fechaNac = 'Usa el formato AAAA-MM-DD.';
  else if (s.fechaNac.trim() > fechaIso(hoy)) e.fechaNac = 'La fecha no puede ser futura.';
  else if (Number(s.fechaNac.slice(0, 4)) < hoy.getFullYear() - 120) e.fechaNac = 'Revisa el año de nacimiento.';
  if (!esTelefonoMedico(s.telefono)) e.telefono = 'Escribe un teléfono de 8 dígitos.';
  const dep = s.departamento.trim();
  if (dep.length < 2 || dep.length > 40) e.departamento = 'Escribe tu departamento (2 a 40 caracteres).';
  if (s.idEspecialidad === null) e.idEspecialidad = 'Selecciona tu especialidad.';
  const m = validarArchivo(s.matricula, 'pdf', 'Matrícula profesional');
  if (m) e.matricula = m;
  const c = validarArchivo(s.carnet, 'imagen', 'Carnet profesional');
  if (c) e.carnet = c;
  return e;
}

/** Campos de texto del multipart (nombres exactos del backend). No se envían `estado` ni `fecha_solicitud`: el backend los ignora. */
export function camposSolicitudMedico(s: SolicitudMedico): [string, string][] {
  return [
    ['nombre_completo', s.nombreCompleto.trim()],
    ['correo', s.correo.trim()],
    ['contrasena', s.contrasena],
    ['telefono', s.telefono.trim()],
    ['fecha_nac', s.fechaNac.trim()],
    ['id_especialidad', String(s.idEspecialidad)],
    ['departamento', s.departamento.trim()],
  ];
}

export function construirFormDataMedicoRegistro(s: SolicitudMedico): FormData {
  const datos = new FormData();
  for (const [k, v] of camposSolicitudMedico(s)) datos.append(k, v);
  if (s.matricula) datos.append('matriculaProfesional', comoParteMultipart(s.matricula));
  if (s.carnet) datos.append('carnetProfesional', comoParteMultipart(s.carnet));
  return datos;
}

/** POST /api/medicos/registrar (multipart por XMLHttpRequest, sin Content-Type manual). */
export async function enviarSolicitudMedico(s: SolicitudMedico): Promise<void> {
  if (USE_MOCK) return;
  await solicitar<unknown>({
    base: API_BASE_URL,
    ruta: '/api/medicos/registrar',
    metodo: 'POST',
    cuerpo: construirFormDataMedicoRegistro(s),
    timeoutMs: 90000, // dos archivos
    mensajes: { 400: 'Falta la matrícula o el carnet. Revisa el formulario.' },
  });
}
