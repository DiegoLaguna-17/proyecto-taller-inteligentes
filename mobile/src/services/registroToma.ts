// Flujo de registro de una toma: clasifica en el cliente, guarda y, si no es NORMAL, registra la alerta.
import {
  evaluarGlucosa,
  idTipoAlerta,
  momentoDeId,
  obtenerTipoPaciente,
  type Estado,
  type EstadoAlerta,
} from './clasificacionGlucosa.ts';
import { registrarAlerta, registrarGlucosa, type DatosPaciente } from './glucosa.ts';
import type { RiesgoMl } from './riesgoMl.ts';

export interface ResultadoToma {
  estado: Estado;
  idRegistro: number | null;
  /** 'no_aplica' si el estado es NORMAL o PARAM_INVALIDO (no se envía alerta). */
  alerta: EstadoAlerta;
  /** Riesgo de hipoglucemia (ML) solo en el registro del médico y solo si el backend lo devolvió; informativo, no se guarda. */
  riesgoMl?: RiesgoMl;
}

const dos = (n: number) => String(n).padStart(2, '0');

/** Fecha LOCAL del dispositivo (YYYY-MM-DD). El front web usa la fecha en UTC; aquí no se replica. */
export function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Hora LOCAL del dispositivo (HH:MM:SS). */
export function horaLocal(d: Date): string {
  return `${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}

export async function registrarToma(p: {
  datos: DatosPaciente;
  idMomento: number;
  valor: number;
  ahora: Date;
  observaciones?: string;
}): Promise<ResultadoToma> {
  const tipo = obtenerTipoPaciente(p.datos);
  const momento = momentoDeId(p.idMomento);
  const estado: Estado = momento ? evaluarGlucosa(p.datos.edad, tipo, momento, p.valor) : 'PARAM_INVALIDO';

  // Si esto falla (ErrorApi) no se guardó nada y no se envía ninguna alerta.
  const { id_registro } = await registrarGlucosa({
    id_paciente: p.datos.id_paciente,
    id_momento: p.idMomento,
    nivel_glucosa: p.valor,
    fecha: fechaLocal(p.ahora),
    hora: horaLocal(p.ahora),
    ...(p.observaciones ? { observaciones: p.observaciones } : {}),
  });

  const tipoAlerta = idTipoAlerta(estado);
  if (!tipoAlerta) return { estado, idRegistro: id_registro, alerta: 'no_aplica' };

  // Sin médico asignado o sin id del registro no se puede registrar la alerta: se informa, no se oculta.
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
