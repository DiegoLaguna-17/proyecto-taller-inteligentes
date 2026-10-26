// Sesión en almacenamiento seguro. Solo ids y rol: el backend no emite token (RB-01) y la app no inventa uno.
// El correo y la contraseña nunca se guardan.
import * as SecureStore from 'expo-secure-store';
import type { SesionUsuario } from './auth.ts';

const CLAVE = 'glucotracker_sesion';

export function esSesionValida(x: unknown): x is SesionUsuario {
  const s = x as Partial<SesionUsuario> | null;
  return (
    !!s &&
    typeof s.id_usuario === 'number' &&
    typeof s.id_rol === 'number' &&
    s.id_rol > 0 &&
    (s.rol === 'paciente' || s.rol === 'medico' || s.rol === 'admin')
  );
}

export async function guardarSesion(sesion: SesionUsuario): Promise<void> {
  try {
    await SecureStore.setItemAsync(CLAVE, JSON.stringify(sesion));
  } catch {
    // Sin almacenamiento seguro (p. ej. web): la sesión vive solo en memoria.
  }
}

export async function leerSesion(): Promise<SesionUsuario | null> {
  try {
    const crudo = await SecureStore.getItemAsync(CLAVE);
    if (!crudo) return null;
    const dato: unknown = JSON.parse(crudo);
    return esSesionValida(dato) ? dato : null;
  } catch {
    return null;
  }
}

export async function borrarSesion(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CLAVE);
  } catch {
    // nada que borrar
  }
}
