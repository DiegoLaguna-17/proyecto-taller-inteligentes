// Cliente HTTP mínimo con fetch. Un único tipo de error con mensaje en español para el usuario.
// Nunca registra cuerpos, URLs con datos ni respuestas (NFR-001).

// 'ruta' = el servidor no tiene esa ruta (404 de FastAPI): error de configuración, casi siempre la URL base.
export type CodigoError = 'config' | 'red' | 'timeout' | 'http' | 'respuesta' | 'ruta';

// __DEV__ lo define React Native; fuera de la app (pruebas con node) no existe.
declare const __DEV__: boolean | undefined;

export class ErrorApi extends Error {
  codigo: CodigoError;
  /** Código HTTP (0 si no hubo respuesta). */
  estado: number;
  /** Segundos de espera sugeridos por la cabecera Retry-After (429). */
  reintentarEnSeg?: number;

  constructor(codigo: CodigoError, mensaje: string, estado = 0, reintentarEnSeg?: number) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.codigo = codigo;
    this.estado = estado;
    this.reintentarEnSeg = reintentarEnSeg;
  }
}

export const MENSAJES = {
  config: 'La aplicación no está configurada para conectarse al servidor.',
  red: 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
  timeout: 'El servidor tardó demasiado en responder. Intenta de nuevo.',
  respuesta: 'El servidor envió una respuesta inesperada. Intenta de nuevo.',
  servidor: 'Ocurrió un error en el servidor. Intenta de nuevo más tarde.',
  limite: 'Demasiados intentos seguidos. Espera un momento e intenta de nuevo.',
  invalido: 'Los datos enviados no son válidos.',
  noEncontrado: 'No se encontró la información solicitada.',
  ruta: 'No se encontró el servicio solicitado. Revisa la dirección del servidor en la configuración de la app.',
  generico: 'No se pudo completar la solicitud.',
} as const;

export interface OpcionesSolicitud {
  base: string;
  ruta: string;
  metodo?: 'GET' | 'POST' | 'PUT';
  cuerpo?: unknown;
  timeoutMs?: number;
  /** Mensajes propios por código HTTP; tienen prioridad sobre los genéricos. */
  mensajes?: Partial<Record<number, string>>;
}

/** 404 de FastAPI para una ruta inexistente: {"detail": "Not Found"} y nada más. */
function esRutaInexistente(datos: unknown): boolean {
  const d = datos as { detail?: unknown; error?: unknown; message?: unknown } | undefined;
  return d?.detail === 'Not Found' && d?.error === undefined && d?.message === undefined;
}

/** Solo desarrollo: método, ruta, estado HTTP y milisegundos. Nunca cuerpos, contraseñas, OTP, correos ni tokens. */
function registrarDev(metodo: string, ruta: string, estado: number, desde: number): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[http] ${metodo} ${ruta} -> ${estado} (${Date.now() - desde} ms)`);
  }
}

function mensajeHttp(estado: number, datos: unknown): string {
  if (estado >= 500) return MENSAJES.servidor; // el backend puede devolver texto técnico en 5xx
  if (estado === 429) return MENSAJES.limite;
  if (estado === 422) return MENSAJES.invalido; // el 422 por defecto de FastAPI repite lo enviado: nunca se muestra
  if (estado === 404) {
    if (esRutaInexistente(datos)) return MENSAJES.ruta;
    // El backend responde {message} o {error} cuando no existe el recurso (p. ej. el paciente)
    const texto = (datos as { message?: unknown; error?: unknown } | undefined);
    const m = typeof texto?.message === 'string' ? texto.message : texto?.error;
    if (typeof m === 'string' && m.trim() && m.length <= 200) return m;
    return MENSAJES.noEncontrado;
  }
  const error = (datos as { error?: unknown } | undefined)?.error;
  if (typeof error === 'string' && error.trim() && error.length <= 200) return error;
  return MENSAJES.generico;
}

/** Respuesta ya reducida a lo que necesita solicitar(), venga de fetch o de XMLHttpRequest. */
interface RespuestaCruda {
  status: number;
  ok: boolean;
  texto: string;
  retryAfter: string | null;
}

/**
 * Envía un FormData con XMLHttpRequest. Motivo: en Expo SDK 58 el `fetch` global es `expo/fetch`, que NO admite
 * archivos locales `{uri, name, type}` (lanza "Unsupported FormDataPart implementation" antes de salir a la red),
 * mientras que el XMLHttpRequest de React Native los lee de forma nativa. No se fija Content-Type: el XHR
 * añade el multipart con su boundary.
 */
function enviarFormDataXhr(url: string, metodo: string, cuerpo: FormData, timeoutMs: number): Promise<RespuestaCruda> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(metodo, url);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.timeout = timeoutMs;
    xhr.onload = () =>
      resolve({
        status: xhr.status,
        ok: xhr.status >= 200 && xhr.status < 300,
        texto: xhr.responseText ?? '',
        retryAfter: xhr.getResponseHeader('retry-after'),
      });
    xhr.onerror = () => reject(Object.assign(new Error('Network request failed'), { name: 'TypeError' }));
    xhr.ontimeout = () => reject(Object.assign(new Error('Request timed out'), { name: 'AbortError' }));
    xhr.send(cuerpo as unknown as XMLHttpRequestBodyInit);
  });
}

/** Largo máximo del texto de error del servidor que se registra en desarrollo. */
export const MAX_TEXTO_5XX = 300;

/**
 * Enmascara datos personales y sensibles en un texto que viene del servidor (solo para el registro de desarrollo).
 * Correos, teléfonos y números largos, hashes de contraseña, valores de claves/contraseñas/códigos, filas completas
 * de Postgres ("Failing row contains (...)", "Key (col)=(valor)"), URLs, rutas de archivos y tokens largos.
 */
export function enmascarar(texto: string): string {
  return texto
    .replace(/Failing row contains \([^)]*\)/gi, 'Failing row contains (<dato>)')
    .replace(/\)=\([^)]*\)/g, ')=(<dato>)')
    .replace(/https?:\/\/\S+/gi, '<url>')
    .replace(/file:\/\/\S+/gi, '<ruta>')
    .replace(/\S*\.(?:jpe?g|png|heic|webp)\b/gi, '<ruta>')
    .replace(/\$2[aby]\$\S+/g, '<dato>')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<dato>')
    .replace(/(contrase[nñ]a|password|clave|codigo|otp|token)(["']?\s*[:=]\s*)("[^"]*"|'[^']*'|\S+)/gi, '$1$2<dato>')
    .replace(/\+?\d[\d\s().-]{5,}\d/g, '<dato>')
    .replace(/[A-Za-z0-9_-]{32,}/g, '<dato>');
}

/** Texto de un campo del cuerpo de error (cadena u objeto) ya enmascarado y truncado. */
function textoSeguro(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  const crudo = typeof valor === 'string' ? valor : JSON.stringify(valor);
  const limpio = enmascarar(crudo ?? '');
  return limpio.length > MAX_TEXTO_5XX ? limpio.slice(0, MAX_TEXTO_5XX) + '…' : limpio;
}

/**
 * Solo desarrollo, respuestas 5xx: el backend devuelve la excepción en los campos `error` y `details`, que la app
 * oculta al usuario. Se registran enmascarados y truncados. Nunca el cuerpo de la petición.
 */
function registrar5xxDev(metodo: string, ruta: string, estado: number, datos: unknown): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && estado >= 500) {
    const d = (datos ?? {}) as { error?: unknown; details?: unknown };
    const error = textoSeguro(d.error);
    const detalles = textoSeguro(d.details);
    console.log(
      `[http] ${metodo} ${ruta} -> ${estado} error=${error === null ? '(sin campo)' : JSON.stringify(error)} details=${detalles === null ? '(sin campo)' : JSON.stringify(detalles)}`,
    );
  }
}

/** Solo desarrollo: nombre y mensaje del error (sin URL ni datos), para ver la causa real en la terminal de Expo. */
function registrarErrorDev(metodo: string, ruta: string, e: unknown, desde: number): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const nombre = (e as { name?: string } | null)?.name ?? 'Error';
    const mensaje = String((e as { message?: string } | null)?.message ?? '')
      .replace(/https?:\/\/\S+/g, '<url>')
      .slice(0, 120);
    console.log(`[http] ${metodo} ${ruta} -> FALLO ${nombre}: ${mensaje} (${Date.now() - desde} ms)`);
  }
}

export async function solicitar<T>(op: OpcionesSolicitud): Promise<T> {
  if (!op.base) throw new ErrorApi('config', MENSAJES.config);

  const metodo = op.metodo ?? 'GET';
  const inicio = Date.now();
  const timeoutMs = op.timeoutMs ?? 15000;
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    let respuesta: RespuestaCruda;
    try {
      const esFormData = typeof FormData !== 'undefined' && op.cuerpo instanceof FormData;
      if (esFormData && typeof XMLHttpRequest !== 'undefined') {
        respuesta = await enviarFormDataXhr(op.base + op.ruta, metodo, op.cuerpo as FormData, timeoutMs);
      } else {
        const r = await fetch(op.base + op.ruta, {
          method: metodo,
          headers: esFormData
            ? { Accept: 'application/json' }
            : { Accept: 'application/json', 'Content-Type': 'application/json' },
          body:
            op.cuerpo === undefined ? undefined : esFormData ? (op.cuerpo as FormData) : JSON.stringify(op.cuerpo),
          signal: controlador.signal,
        });
        respuesta = {
          status: r.status,
          ok: r.ok,
          texto: await r.text(),
          retryAfter: r.headers?.get?.('retry-after') ?? null,
        };
      }
    } catch (e) {
      registrarErrorDev(metodo, op.ruta, e, inicio);
      if ((e as { name?: string } | null)?.name === 'AbortError') throw new ErrorApi('timeout', MENSAJES.timeout);
      throw new ErrorApi('red', MENSAJES.red);
    }
    registrarDev(metodo, op.ruta, respuesta.status, inicio);

    let datos: unknown;
    try {
      datos = respuesta.texto ? JSON.parse(respuesta.texto) : undefined;
    } catch {
      datos = undefined;
      if (respuesta.ok) throw new ErrorApi('respuesta', MENSAJES.respuesta, respuesta.status);
    }

    if (!respuesta.ok) {
      registrar5xxDev(metodo, op.ruta, respuesta.status, datos);
      const espera = Number(respuesta.retryAfter);
      const rutaInexistente = respuesta.status === 404 && esRutaInexistente(datos);
      throw new ErrorApi(
        rutaInexistente ? 'ruta' : 'http',
        (rutaInexistente ? undefined : op.mensajes?.[respuesta.status]) ?? mensajeHttp(respuesta.status, datos),
        respuesta.status,
        Number.isFinite(espera) && espera > 0 ? espera : undefined,
      );
    }
    return datos as T;
  } finally {
    clearTimeout(temporizador);
  }
}

/** true si el servidor respondió 404 sobre un recurso concreto (no una ruta inexistente de configuración). */
export function esRecursoInexistente(e: unknown): boolean {
  return e instanceof ErrorApi && e.codigo === 'http' && e.estado === 404;
}

/** Mensaje seguro para mostrar al usuario ante cualquier excepción. */
export function mensajeDeError(e: unknown): string {
  return e instanceof ErrorApi ? e.message : MENSAJES.generico;
}
