import { API_BASE_URL, USE_MOCK, MOCK_CON_OTP } from './config.ts';
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

/** Resultado del paso 1: `sesion` solo viene si el backend no exige OTP (OTP_ACTIVADO=false, ADR-0012). */
export interface ResultadoLogin {
  id_usuario: number;
  sesion?: SesionUsuario;
}

const ROLES_BACKEND = ['paciente', 'medico', 'administrador'];

/**
 * Interpreta la respuesta de POST /api/login. Con OTP trae id_usuario (e id_rol) y la app sigue al paso del código.
 * Sin OTP trae además `rol`: se crea la sesión. Un `rol` desconocido o un id_rol <= 0 es un error, nunca una sesión.
 */
export function leerRespuestaLogin(datos: { id_usuario?: unknown; id_rol?: unknown; rol?: unknown } | null | undefined): ResultadoLogin {
  if (typeof datos?.id_usuario !== 'number') throw new ErrorApi('respuesta', MENSAJES.respuesta);
  if (datos.rol === undefined || datos.rol === null) return { id_usuario: datos.id_usuario };
  if (typeof datos.rol !== 'string' || !ROLES_BACKEND.includes(datos.rol) || typeof datos.id_rol !== 'number') {
    throw new ErrorApi('respuesta', MENSAJES.respuesta);
  }
  if (datos.id_rol <= 0) throw new ErrorApi('http', 'No se encontró tu perfil. Contacta al administrador.', 200);
  return { id_usuario: datos.id_usuario, sesion: { id_usuario: datos.id_usuario, id_rol: datos.id_rol, rol: rolDeBackend(datos.rol) } };
}

// ---- Modo simulado con OTP (EXPO_PUBLIC_USE_MOCK=true y EXPO_PUBLIC_SIN_OTP=false). Credenciales fijas del README. SIMULADO ----
export const CODIGO_OTP_SIMULADO = '123456';
const USUARIOS_SIMULADOS: Record<string, { id_usuario: number; rol: 'paciente' | 'medico' | 'administrador' }> = {
  'carlos@email.com': { id_usuario: 1, rol: 'paciente' },
  'doctor@email.com': { id_usuario: 2, rol: 'medico' },
  'admin@email.com': { id_usuario: 3, rol: 'administrador' },
};
const ROL_DE_USUARIO_SIMULADO: Record<number, 'paciente' | 'medico' | 'administrador'> = { 1: 'paciente', 2: 'medico', 3: 'administrador' };

/** Paso 1: POST /api/login. Con OTP el backend lo envía por correo y devuelve el id_usuario; sin OTP devuelve también la sesión. */
export async function iniciarSesion(correo: string, contrasena: string): Promise<ResultadoLogin> {
  if (USE_MOCK) {
    if (!MOCK_CON_OTP) throw new ErrorApi('config', 'El modo simulado no usa el servidor.');
    const u = contrasena === '12345' ? USUARIOS_SIMULADOS[correo.trim().toLowerCase()] : undefined;
    if (!u) throw new ErrorApi('http', MENSAJE_LOGIN_401, 401);
    return { id_usuario: u.id_usuario };
  }
  const datos = await solicitar<{ id_usuario?: unknown; id_rol?: unknown; rol?: unknown }>({
    base: API_BASE_URL,
    ruta: '/api/login',
    metodo: 'POST',
    cuerpo: { correo: correo.trim(), contrasena },
    // El backend distingue "correo no encontrado" de "contraseña incorrecta": la app no lo revela.
    mensajes: { 401: MENSAJE_LOGIN_401 },
  });
  return leerRespuestaLogin(datos);
}

/** Paso 2: POST /api/verify-otp con el código de 6 dígitos. */
export async function verificarOtp(idUsuario: number, codigo: string): Promise<SesionUsuario> {
  if (USE_MOCK) {
    if (!MOCK_CON_OTP || !ROL_DE_USUARIO_SIMULADO[idUsuario]) throw new ErrorApi('config', 'El modo simulado no usa el servidor.');
    if (codigo.trim() !== CODIGO_OTP_SIMULADO) throw new ErrorApi('http', MENSAJE_OTP_401, 401);
    return { id_usuario: idUsuario, id_rol: 1, rol: rolDeBackend(ROL_DE_USUARIO_SIMULADO[idUsuario]) };
  }
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
