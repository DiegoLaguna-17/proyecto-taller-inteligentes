// Edición de datos del paciente: formulario, validación y cuerpo de PUT /api/pacientes/actualizarPaciente.
// El backend EXIGE siempre nombre, altura, peso, telefono, correo, nombre_emergencia y numero_emergencia;
// los campos de embarazo solo se envían si cambió el estado (cada envío con semanas crea un seguimiento nuevo).
import type { ActualizacionPaciente, PerfilPaciente } from './paciente.ts';
import {
  ALTURA_MAX_CM,
  ALTURA_MIN_CM,
  aNumero,
  alturaCmAMetros,
  alturaMetrosACm,
  esAlturaCm,
  esCorreo,
  esFechaIso,
  esNumeroPositivo,
  esSemanas,
  esTelefono,
  fechaIso,
  metrosNormalizados,
} from './validaciones.ts';

export interface FormEdicion {
  nombre: string;
  /** En CENTÍMETROS (el perfil la trae en metros); se envía en metros. */
  altura: string;
  peso: string;
  telefono: string;
  correo: string;
  nombreEmergencia: string;
  numeroEmergencia: string;
  embarazo: boolean;
  /** Semanas al empezar a registrar el embarazo (solo si pasa de no embarazada a embarazada). */
  semanas: string;
  /** AAAA-MM-DD (solo si pasa de embarazada a no embarazada). */
  fechaTerminacion: string;
}

export function formDesdePerfil(p: PerfilPaciente, hoy: Date = new Date()): FormEdicion {
  return {
    nombre: p.nombre,
    altura: alturaMetrosACm(p.altura), // el backend devuelve metros (1.70): se muestra en cm (170)
    peso: p.peso ?? '',
    telefono: p.telefono ?? '',
    correo: p.correo ?? '',
    nombreEmergencia: p.nombreEmergencia ?? '',
    numeroEmergencia: p.numeroEmergencia ?? '',
    embarazo: p.embarazo,
    semanas: '',
    fechaTerminacion: fechaIso(hoy),
  };
}

export const empiezaEmbarazo = (f: FormEdicion, p: PerfilPaciente) => f.embarazo && !p.embarazo;
export const terminaEmbarazo = (f: FormEdicion, p: PerfilPaciente) => !f.embarazo && p.embarazo;

/** Errores por campo (vacío = válido). */
export function validarEdicion(f: FormEdicion, p: PerfilPaciente, hoy: Date = new Date()): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.nombre.trim().length < 3) e.nombre = 'Escribe tu nombre completo.';
  if (!esAlturaCm(f.altura)) e.altura = `Escribe tu altura en centímetros, entre ${ALTURA_MIN_CM} y ${ALTURA_MAX_CM} (ej. 165).`;
  if (!esNumeroPositivo(f.peso, 500)) e.peso = 'Escribe tu peso en kg (ej. 72.5).';
  if (!esTelefono(f.telefono)) e.telefono = 'Escribe un teléfono de 7 u 8 dígitos.';
  if (!esCorreo(f.correo)) e.correo = 'Escribe un correo válido.';
  if (!f.nombreEmergencia.trim()) e.nombreEmergencia = 'Escribe el nombre de tu contacto de emergencia.';
  if (!esTelefono(f.numeroEmergencia)) e.numeroEmergencia = 'Escribe un teléfono de 7 u 8 dígitos.';
  if (empiezaEmbarazo(f, p) && !esSemanas(f.semanas)) e.semanas = 'Indica las semanas (1 a 42).';
  if (terminaEmbarazo(f, p)) {
    if (!esFechaIso(f.fechaTerminacion)) e.fechaTerminacion = 'Usa el formato AAAA-MM-DD.';
    else if (f.fechaTerminacion.trim() > fechaIso(hoy)) e.fechaTerminacion = 'La fecha no puede ser futura.';
  }
  return e;
}

/** Hay algún cambio respecto al perfil cargado. */
export function hayCambios(f: FormEdicion, p: PerfilPaciente): boolean {
  return (
    f.nombre.trim() !== p.nombre ||
    // se compara en metros con dos decimales: perfil -> edición sin tocar el valor no cuenta como cambio
    (esAlturaCm(f.altura) ? alturaCmAMetros(f.altura) : f.altura.trim()) !== metrosNormalizados(p.altura) ||
    f.peso.trim() !== (p.peso ?? '') ||
    f.telefono.trim() !== (p.telefono ?? '') ||
    f.correo.trim() !== (p.correo ?? '') ||
    f.nombreEmergencia.trim() !== (p.nombreEmergencia ?? '') ||
    f.numeroEmergencia.trim() !== (p.numeroEmergencia ?? '') ||
    f.embarazo !== p.embarazo
  );
}

/** Cuerpo del PUT: los siete campos requeridos siempre; el embarazo solo si cambió. */
export function construirActualizacion(f: FormEdicion, p: PerfilPaciente): ActualizacionPaciente {
  const cuerpo: ActualizacionPaciente = {
    nombre: f.nombre.trim(),
    altura: alturaCmAMetros(f.altura), // la base guarda metros (numeric(4,2)): 170 cm -> "1.70"
    peso: String(aNumero(f.peso)),
    telefono: f.telefono.trim(),
    correo: f.correo.trim(),
    nombre_emergencia: f.nombreEmergencia.trim(),
    numero_emergencia: f.numeroEmergencia.trim(),
  };
  if (empiezaEmbarazo(f, p)) {
    cuerpo.embarazo = true;
    cuerpo.semanas_embarazo = Number(f.semanas);
  } else if (terminaEmbarazo(f, p)) {
    cuerpo.embarazo = false;
    cuerpo.fecha_terminacion = f.fechaTerminacion.trim();
  }
  return cuerpo;
}
