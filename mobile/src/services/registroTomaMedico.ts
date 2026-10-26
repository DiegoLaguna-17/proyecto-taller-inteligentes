// Registro de una toma POR el médico para un paciente (design.md § Registro de glucosa por el médico, TASK-067).
// Clasifica en el cliente con el port existente, guarda con POST /api/medicos/registrar/glucosa y, si no es NORMAL,
// crea la alerta (el backend no la genera). Las funciones de validación y textos son puras.
import {
  evaluarGlucosa,
  idTipoAlerta,
  momentoDeId,
  obtenerTipoPaciente,
  type Estado,
  type EstadoAlerta,
} from './clasificacionGlucosa.ts';
import { registrarAlerta, registrarGlucosaMedico, type DatosPaciente } from './glucosa.ts';
import { mensajeDeError } from './http.ts';
import { pudoQuedarParcial } from './registroAviso.ts';
import { fechaLocal, horaLocal, type ResultadoToma } from './registroToma.ts';
import { GLUCOSA_CAPTURA_MAX, GLUCOSA_CAPTURA_MIN } from './umbrales.ts';

/** Límite de las observaciones (lo elige la app; el backend no lo valida). */
export const MAX_OBSERVACIONES = 200;

export interface EntradaTomaMedico {
  /** Texto del campo (solo dígitos). */
  valor: string;
  idMomento: number | null;
  observaciones: string;
}

/** Mensaje de error de la validación previa al envío, o null si la lectura es válida. */
export function validarTomaMedico(e: EntradaTomaMedico): string | null {
  const texto = e.valor.trim();
  // Solo enteros: se rechazan vacío, letras, decimales y negativos (el backend acepta incluso 0)
  if (!/^\d+$/.test(texto)) return `Ingresa un nivel de glucosa entre ${GLUCOSA_CAPTURA_MIN} y ${GLUCOSA_CAPTURA_MAX} mg/dL.`;
  const n = Number(texto);
  if (n < GLUCOSA_CAPTURA_MIN || n > GLUCOSA_CAPTURA_MAX) {
    return `Ingresa un nivel de glucosa entre ${GLUCOSA_CAPTURA_MIN} y ${GLUCOSA_CAPTURA_MAX} mg/dL.`;
  }
  if (e.idMomento === null || !Number.isInteger(e.idMomento)) return 'Selecciona el momento de la toma.';
  if (e.observaciones.trim().length > MAX_OBSERVACIONES) {
    return `Las observaciones admiten como máximo ${MAX_OBSERVACIONES} caracteres.`;
  }
  return null;
}

/**
 * Guarda la lectura del paciente `datos.id_paciente` registrada por el médico `idMedico`.
 * Si guardar la lectura falla (ErrorApi) no se envía ninguna alerta. Si la lectura se guarda y la alerta falla,
 * se devuelve alerta 'fallida' SIN repetir la lectura.
 */
export async function registrarTomaMedico(p: {
  datos: DatosPaciente;
  idMedico: number;
  idMomento: number;
  valor: number;
  ahora: Date;
  observaciones?: string;
}): Promise<ResultadoToma> {
  const tipo = obtenerTipoPaciente(p.datos);
  const momento = momentoDeId(p.idMomento);
  const estado: Estado = momento ? evaluarGlucosa(p.datos.edad, tipo, momento, p.valor) : 'PARAM_INVALIDO';
  const obs = (p.observaciones ?? '').trim();

  const { id_registro } = await registrarGlucosaMedico({
    id_paciente: p.datos.id_paciente,
    id_medico: p.idMedico,
    id_momento: p.idMomento,
    nivel_glucosa: p.valor,
    fecha: fechaLocal(p.ahora),
    hora: horaLocal(p.ahora),
    ...(obs ? { observaciones: obs } : {}),
  });

  const tipoAlerta = idTipoAlerta(estado);
  if (!tipoAlerta) return { estado, idRegistro: id_registro, alerta: 'no_aplica' };

  // La alerta se atribuye al médico ASIGNADO al paciente (como el front web), no necesariamente a quien registra
  if (id_registro === null || p.datos.id_medico === null) return { estado, idRegistro: id_registro, alerta: 'fallida' };
  try {
    await registrarAlerta({
      id_tipo_alerta: tipoAlerta,
      id_registro,
      id_medico: p.datos.id_medico,
      fecha_alerta: fechaLocal(p.ahora),
    });
    return { estado, idRegistro: id_registro, alerta: 'enviada' };
  } catch {
    return { estado, idRegistro: id_registro, alerta: 'fallida' };
  }
}

/** Texto del resultado redactado PARA EL MÉDICO (no «tu glucosa está baja»). */
export function mensajeResultadoMedico(estado: Estado, alerta: EstadoAlerta, paciente: string): string {
  const quien = paciente.trim() || 'el paciente';
  const aviso =
    alerta === 'enviada'
      ? ' Se creó la alerta para el médico asignado al paciente.'
      : ' La lectura quedó guardada, pero no se pudo crear la alerta: no la repitas; avisa al médico asignado o al paciente directamente.';
  if (estado === 'HIPOGLUCEMIA') return `Lectura baja registrada por el médico para ${quien}.${aviso}`;
  if (estado === 'HIPERGLUCEMIA') return `Lectura alta registrada por el médico para ${quien}.${aviso}`;
  if (estado === 'PARAM_INVALIDO') {
    return `La lectura de ${quien} se guardó, pero no se pudo clasificar con los datos de su perfil (por ejemplo, su edad o su tipo de diabetes): no se creó ninguna alerta. Revisa el perfil del paciente.`;
  }
  return `Lectura registrada por el médico para ${quien}: dentro de los parámetros esperados para este momento.`;
}

export const AVISO_LECTURA_POSIBLEMENTE_GUARDADA =
  'Es posible que la lectura se haya guardado: revisa el historial del paciente antes de volver a registrarla.';

/** Mensaje de un envío fallido: genérico (nunca el texto de la excepción del backend) y, si no hubo respuesta clara, con el aviso. */
export function mensajeFalloTomaMedico(e: unknown): string {
  const base = mensajeDeError(e);
  return pudoQuedarParcial(e) ? `${base} ${AVISO_LECTURA_POSIBLEMENTE_GUARDADA}` : base;
}
