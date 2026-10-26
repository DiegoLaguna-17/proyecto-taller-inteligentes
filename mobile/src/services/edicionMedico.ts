// Edición del médico: PUT /api/medicos/actualizar/{id_medico} (teléfono, correo, departamento y carnet).
import type { ActualizacionMedico, PerfilMedico } from './medico.ts';
import { validarArchivo, type ArchivoLocal } from './archivos.ts';
import { esCorreo } from './validaciones.ts';

export interface FormEdicionMedico {
  telefono: string;
  correo: string;
  departamento: string;
  /** Carnet nuevo elegido en esta edición (null = no se cambia). */
  carnet: ArchivoLocal | null;
}

/** 8 dígitos (regla del front web al registrar médicos; pendiente de confirmar con el equipo). */
export const esTelefonoMedico = (v: string): boolean => /^\d{8}$/.test(v.trim());

export function formDesdePerfilMedico(p: PerfilMedico): FormEdicionMedico {
  // Los textos de relleno del backend ya vienen como null: no se copian al formulario
  return { telefono: p.telefono ?? '', correo: p.correo ?? '', departamento: p.departamento ?? '', carnet: null };
}

export function validarEdicionMedico(f: FormEdicionMedico): Record<string, string> {
  const e: Record<string, string> = {};
  if (!esTelefonoMedico(f.telefono)) e.telefono = 'Escribe un teléfono de 8 dígitos.';
  if (!esCorreo(f.correo)) e.correo = 'Escribe un correo válido.';
  const dep = f.departamento.trim();
  if (dep.length < 2 || dep.length > 40) e.departamento = 'Escribe tu departamento (2 a 40 caracteres).';
  if (f.carnet) {
    const m = validarArchivo(f.carnet, 'imagen', 'Carnet');
    if (m) e.carnet = m;
  }
  return e;
}

/** Solo los campos que cambiaron y no están vacíos (el backend borra el dato si llega una cadena vacía). */
export function construirActualizacionMedico(f: FormEdicionMedico, p: PerfilMedico): ActualizacionMedico {
  const c: ActualizacionMedico = {};
  if (f.telefono.trim() !== (p.telefono ?? '') && f.telefono.trim()) c.telefono = f.telefono.trim();
  if (f.correo.trim() !== (p.correo ?? '') && f.correo.trim()) c.correo = f.correo.trim();
  if (f.departamento.trim() !== (p.departamento ?? '') && f.departamento.trim()) c.departamento = f.departamento.trim();
  if (f.carnet) c.carnet = f.carnet;
  return c;
}

export const hayCambiosMedico = (f: FormEdicionMedico, p: PerfilMedico): boolean =>
  Object.keys(construirActualizacionMedico(f, p)).length > 0;
