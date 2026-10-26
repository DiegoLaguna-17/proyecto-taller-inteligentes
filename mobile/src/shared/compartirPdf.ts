// Convierte un HTML en PDF dentro del dispositivo y abre la hoja del sistema para compartirlo o guardarlo.
// Nunca registra el contenido (datos de salud). Los módulos nativos se cargan al usarse, no al abrir la app.

export class ErrorPdf extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorPdf';
  }
}

export const MENSAJES_PDF = {
  noGenerado: 'No se pudo generar el PDF. Intenta de nuevo.',
  noCompartir: 'Este dispositivo no permite compartir archivos. El PDF no se pudo entregar.',
  cancelado: 'No se pudo abrir la hoja para compartir el PDF. Intenta de nuevo.',
} as const;

export async function generarYCompartirPdf(html: string, titulo: string): Promise<void> {
  let uri: string;
  try {
    const Print = await import('expo-print');
    const r = await Print.printToFileAsync({ html });
    uri = r.uri;
  } catch {
    throw new ErrorPdf(MENSAJES_PDF.noGenerado);
  }
  if (!uri) throw new ErrorPdf(MENSAJES_PDF.noGenerado);

  const Sharing = await import('expo-sharing');
  let disponible = false;
  try {
    disponible = await Sharing.isAvailableAsync();
  } catch {
    disponible = false;
  }
  if (!disponible) throw new ErrorPdf(MENSAJES_PDF.noCompartir);
  try {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: titulo });
  } catch {
    throw new ErrorPdf(MENSAJES_PDF.cancelado);
  }
}
