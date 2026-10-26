// Abre un documento de Storage (matrícula, carnet) en el navegador del teléfono. Sin dependencias nuevas.
import { Linking } from 'react-native';
import { esUrlAbrible } from '../services/administradorVista';

/** Devuelve un mensaje de error, o null si se pudo abrir. Solo se abren URL http(s). */
export async function abrirDocumento(url: string | null | undefined): Promise<string | null> {
  if (!esUrlAbrible(url)) return 'El documento no tiene una dirección válida.';
  try {
    await Linking.openURL(url.trim());
    return null;
  } catch {
    return 'No se pudo abrir el documento en este dispositivo.';
  }
}
