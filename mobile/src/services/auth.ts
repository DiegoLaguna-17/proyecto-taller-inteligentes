import { API_BASE_URL, USE_MOCK } from './config.ts';
import { solicitar, ErrorApi, MENSAJES } from './http.ts';

export type RolApp = 'paciente' | 'medico' | 'admin';

/** Lo único que devuelve el backend al verificar el OTP. No hay token (RB-01). */
export interface SesionUsuario {
  id_usuario: number;
  /** id_paciente, id_medico o id_admin según el rol: es el que usan las demás llamadas. */
  id_rol: number;
  rol: RolApp;
}

/** "administrador" -> admin, "medico" -> medico, cualquier otro -> paciente (igual que el front web). */
export function rolDeBackend(rol: unknown): RolApp {
  if (rol === 'administrador') return 'admin';
  if (rol === 'medico') return 'medico';
  return 'paciente';
}

const MENSAJE_LOGIN_401 = 'Correo o contraseña incorrectos.';
const MENSAJE_OTP_401 = 'Código incorrecto o expirado.';

/** Paso 1: POST /api/login. El backend envía un OTP por correo y devuelve el id_usuario. */
export async function iniciarSesion(correo: string, contrasena: string): Promise<{ id_usuario: number }> {
  if (USE_MOCK) throw new ErrorApi('config', 'El modo simulado no usa el servidor.');
  const datos = await solicitar<{ id_usuario?: unknown }>({
    base: API_BASE_URL,
    ruta: '/api/login',
    metodo: 'POST',
    cuerpo: { correo: correo.trim(), contrasena },
    // El backend distingue "correo no encontrado" de "contraseña incorrecta": la app no lo revela.
    mensajes: { 401: MENSAJE_LOGIN_401 },
  });
  if (typeof datos?.id_usuario !== 'number') throw new ErrorApi('respuesta', MENSAJES.respuesta);
  return { id_usuario: datos.id_usuario };
}

/** Paso 2: POST /api/verify-otp con el código de 6 dígitos. */
export async function verificarOtp(idUsuario: number, codigo: string): Promise<SesionUsuario> {
  if (USE_MOCK) throw new ErrorApi('config', 'El modo simulado no usa el servidor.');
  const datos = await solicitar<{ id_usuario?: unknown; id_rol?: unknown; rol?: unknown }>({
    base: API_BASE_URL,
    ruta: '/api/verify-otp',
    metodo: 'POST',
    cuerpo: { id_usuario: idUsuario, codigo: codigo.trim() },
    mensajes: { 401: MENSAJE_OTP_401 },
  });
  if (typeof datos?.id_usuario !== 'number' || typeof datos?.id_rol !== 'number') {
    throw new ErrorApi('respuesta', MENSAJES.respuesta);
  }
  // El backend devuelve id_rol = 0 cuando no encuentra el perfil del rol.
  if (datos.id_rol <= 0) throw new ErrorApi('http', 'No se encontró tu perfil. Contacta al administrador.', 200);
  return { id_usuario: datos.id_usuario, id_rol: datos.id_rol, rol: rolDeBackend(datos.rol) };
}
