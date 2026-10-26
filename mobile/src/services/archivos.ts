// Archivos locales que se adjuntan a un multipart (foto, carnet, matrícula). Validación previa en el cliente:
// el backend sube los archivos a Storage ANTES de validar el resto y deja huérfanos si algo falla.

export interface ArchivoLocal {
  uri: string;
  /** Nombre con extensión (carnet.jpg, matricula.pdf...). */
  nombre: string;
  /** MIME completo: image/jpeg | image/png | application/pdf. */
  tipo: string;
  /** Tamaño en bytes si el selector lo informa. */
  bytes?: number;
}

export const MB = 1024 * 1024;

/** Límites acordados (decisión del usuario): PDF hasta 5 MB e imagen JPG/PNG hasta 2 MB. */
export const MAX_PDF_BYTES = 5 * MB;
export const MAX_IMAGEN_BYTES = 2 * MB;

export type TipoArchivo = 'pdf' | 'imagen';

/** Normaliza el MIME que informa el selector (o lo deduce de la extensión). Vacío si no se reconoce. */
export function mimeDeArchivo(mime: string | null | undefined, nombreOUri: string): string {
  let t = (mime ?? '').toLowerCase().trim();
  if (!t) {
    const ext = nombreOUri.split('?')[0].split('.').pop()?.toLowerCase();
    t = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : '';
  }
  return t === 'image/jpg' ? 'image/jpeg' : t;
}

/** Mensaje de error del archivo (null si es válido). */
export function validarArchivo(a: ArchivoLocal | null, tipo: TipoArchivo, etiqueta: string): string | null {
  if (!a) return `${etiqueta}: es obligatorio.`;
  if (tipo === 'pdf') {
    if (a.tipo !== 'application/pdf') return `${etiqueta}: debe ser un archivo PDF.`;
    if (a.bytes !== undefined && a.bytes > MAX_PDF_BYTES) return `${etiqueta}: el PDF no puede superar ${MAX_PDF_BYTES / MB} MB.`;
  } else {
    if (a.tipo !== 'image/jpeg' && a.tipo !== 'image/png') return `${etiqueta}: debe ser una imagen JPG o PNG.`;
    if (a.bytes !== undefined && a.bytes > MAX_IMAGEN_BYTES) return `${etiqueta}: la imagen no puede superar ${MAX_IMAGEN_BYTES / MB} MB.`;
  }
  return null;
}

/** Formato para agregarlo a un FormData de React Native: {uri, name, type}. */
export function comoParteMultipart(a: ArchivoLocal): Blob {
  return { uri: a.uri, name: a.nombre, type: a.tipo } as unknown as Blob;
}
