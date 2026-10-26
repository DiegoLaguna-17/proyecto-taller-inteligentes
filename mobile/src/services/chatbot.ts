import { NLP_API_BASE_URL, USE_MOCK } from './config.ts';
import { solicitar, ErrorApi, MENSAJES } from './http.ts';

/** Largo máximo por defecto del servicio (CHATBOT_MAX_INPUT_CHARS). Si el servicio usa otro, responde 422. */
export const LIMITE_CONSULTA = 1000;

/** El servicio puede tardar: la llamada al proveedor LLM tiene su propio timeout (NLP_TIMEOUT_SECONDS). */
const TIMEOUT_MS = 60000;

const MENSAJE_NO_DISPONIBLE = 'El asistente no está disponible en este momento. Intenta de nuevo más tarde.';

/**
 * POST {NLP}/api/chatbot/consulta. El contrato solo acepta {texto}: no se envía ningún dato del
 * usuario ni contexto clínico. Devuelve la respuesta completa (el servicio añade el aviso médico).
 */
export async function consultarChatbot(texto: string): Promise<string> {
  if (USE_MOCK) {
    return 'He registrado tu consulta. Recuerda mantener un registro constante de tus tomas para un mejor seguimiento clínico con tu especialista.\n\nConsulta siempre a tu médico tratante para cambios en tu medicación.';
  }
  try {
    const datos = await solicitar<{ respuesta?: unknown }>({
      base: NLP_API_BASE_URL,
      ruta: '/api/chatbot/consulta',
      metodo: 'POST',
      cuerpo: { texto },
      timeoutMs: TIMEOUT_MS,
      mensajes: {
        401: 'El asistente requiere iniciar sesión y todavía no está disponible en la app.',
        422: `Tu consulta no es válida. Escribe un texto que no esté vacío y tenga como máximo ${LIMITE_CONSULTA} caracteres.`,
        429: 'Hiciste muchas consultas seguidas. Espera un momento e intenta de nuevo.',
        502: MENSAJE_NO_DISPONIBLE,
        503: MENSAJE_NO_DISPONIBLE,
        504: 'El asistente tardó demasiado en responder. Intenta de nuevo.',
      },
    });
    if (typeof datos?.respuesta !== 'string' || !datos.respuesta.trim()) {
      throw new ErrorApi('respuesta', MENSAJES.respuesta);
    }
    return datos.respuesta;
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 429 && e.reintentarEnSeg) {
      throw new ErrorApi('http', `${e.message} (unos ${e.reintentarEnSeg} s)`, 429, e.reintentarEnSeg);
    }
    throw e;
  }
}
