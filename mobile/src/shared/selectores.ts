// Selectores de archivos del dispositivo. Devuelven un ArchivoLocal ya normalizado (MIME completo, nombre con extensión)
// o un mensaje de error; la validación de tipo y tamaño se hace después con validarArchivo (services/archivos).
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ArchivoLocal, mimeDeArchivo } from '../services/archivos';

export type ResultadoSelector = { archivo: ArchivoLocal } | { error: string } | null; // null = el usuario canceló

/** Elige una imagen de la galería (JPG o PNG). `calidad` comprime la foto para que la subida sea liviana. */
export async function elegirImagen(nombreBase: string, calidad = 0.5): Promise<ResultadoSelector> {
  try {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: calidad });
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];
    const tipo = mimeDeArchivo(a.mimeType, a.fileName ?? a.uri);
    if (tipo !== 'image/jpeg' && tipo !== 'image/png') return { error: 'Selecciona una imagen JPG o PNG.' };
    return { archivo: { uri: a.uri, nombre: `${nombreBase}.${tipo === 'image/png' ? 'png' : 'jpg'}`, tipo, bytes: a.fileSize } };
  } catch {
    return { error: 'No se pudo abrir la galería. Revisa los permisos de fotos.' };
  }
}

/** Elige un PDF (solo documentos application/pdf). */
export async function elegirPdf(nombreBase: string): Promise<ResultadoSelector> {
  try {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];
    const tipo = mimeDeArchivo(a.mimeType, a.name ?? a.uri);
    if (tipo !== 'application/pdf') return { error: 'Selecciona un archivo PDF.' };
    return { archivo: { uri: a.uri, nombre: `${nombreBase}.pdf`, tipo, bytes: a.size } };
  } catch {
    return { error: 'No se pudo abrir el selector de documentos.' };
  }
}
