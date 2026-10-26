// Aviso de registro con fallo parcial (TASK-059, hallazgo conocido del backend: el registro NO es transaccional).
// registrarPaciente / registrar (médico) crean primero el usuario y después suben archivos y crean el perfil: si algo
// falla a mitad, el correo puede quedar tomado aunque el registro no se haya completado. La app no puede deshacerlo.
import { ErrorApi, mensajeDeError } from './http.ts';

export const AVISO_REGISTRO_PARCIAL =
  'Es posible que tu registro haya quedado incompleto. Si al reintentar el correo aparece como ya registrado, usa otro correo o pide ayuda al administrador.';

/** true si el fallo ocurrió sin una respuesta clara del servidor (red, tiempo, 5xx o respuesta ilegible). */
export function pudoQuedarParcial(e: unknown): boolean {
  if (!(e instanceof ErrorApi)) return false;
  if (e.codigo === 'red' || e.codigo === 'timeout' || e.codigo === 'respuesta') return true;
  return e.estado >= 500;
}

/** Mensaje para el usuario tras un envío de registro fallido; añade el aviso solo cuando pudo quedar parcial. */
export function mensajeFalloRegistro(e: unknown): string {
  const base = mensajeDeError(e);
  return pudoQuedarParcial(e) ? `${base} ${AVISO_REGISTRO_PARCIAL}` : base;
}
