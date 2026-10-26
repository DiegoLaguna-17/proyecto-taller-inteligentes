// Clasificación de glucosa EN EL CLIENTE (decisión del equipo, design.md § Clasificación en el cliente).
// Port FIEL de glucosa.service.ts del front web (GlucoTracker_Front, rama main), como funciones puras.
// NO se corrige nada en silencio. Rarezas del original, conservadas a propósito y cubiertas por pruebas:
//   (1) el tipo "Normal" no está contemplado en obtenerRango (compara `tipo === null`): da PARAM_INVALIDO;
//   (2) los mínimos de embarazo nunca se usan: la hipoglucemia (< 70) se evalúa antes;
//   (3) edad < 6 (o ausente) -> PARAM_INVALIDO, salvo que el valor sea < 70 (entonces HIPOGLUCEMIA).
// Los rangos difieren de docs/nlp/umbrales_ada_v1.json (ayunas 70-130, postprandial máx. 180) que usa el chatbot.

import { GLUCOSA_HIPO_MAX } from './umbrales.ts';

export type Momento = 'ayunas' | 'despues' | 'dormir';
export type GrupoEdad = 'infante' | 'adolescente' | 'joven' | 'adulto' | 'mayor';
export type TipoPaciente = 'Normal' | 'Diabetes Tipo 1' | 'Diabetes Tipo 2' | 'Embarazada' | 'Diabetes Gestacional';
export type Estado = 'HIPOGLUCEMIA' | 'NORMAL' | 'HIPERGLUCEMIA' | 'PARAM_INVALIDO';

export interface RangoGlucosa {
  min: number;
  max: number;
}

type RangosPorMomento = Record<Momento, RangoGlucosa>;

const RANGOS_NORMALES: Record<GrupoEdad, RangosPorMomento> = {
  infante: { ayunas: { min: 90, max: 180 }, despues: { min: 90, max: 200 }, dormir: { min: 100, max: 180 } },
  adolescente: { ayunas: { min: 90, max: 130 }, despues: { min: 90, max: 180 }, dormir: { min: 90, max: 150 } },
  joven: { ayunas: { min: 90, max: 130 }, despues: { min: 90, max: 140 }, dormir: { min: 90, max: 150 } },
  adulto: { ayunas: { min: 90, max: 100 }, despues: { min: 90, max: 150 }, dormir: { min: 100, max: 140 } },
  mayor: { ayunas: { min: 80, max: 110 }, despues: { min: 80, max: 160 }, dormir: { min: 100, max: 140 } },
};

const RANGOS_DIABETICOS: Record<GrupoEdad, RangosPorMomento> = {
  infante: { ayunas: { min: 90, max: 130 }, despues: { min: 90, max: 180 }, dormir: { min: 90, max: 150 } },
  adolescente: { ayunas: { min: 90, max: 130 }, despues: { min: 90, max: 180 }, dormir: { min: 90, max: 150 } },
  joven: { ayunas: { min: 80, max: 130 }, despues: { min: 80, max: 180 }, dormir: { min: 90, max: 150 } },
  adulto: { ayunas: { min: 80, max: 130 }, despues: { min: 80, max: 180 }, dormir: { min: 90, max: 150 } },
  mayor: { ayunas: { min: 80, max: 110 }, despues: { min: 80, max: 160 }, dormir: { min: 100, max: 180 } },
};

const RANGOS_EMBARAZADAS: Record<Momento, RangoGlucosa> = {
  ayunas: { min: 70, max: 95 },
  despues: { min: 109, max: 129 },
  dormir: { min: 100, max: 120 },
};

const RANGOS_EMBARAZADAS_DG: Record<Momento, RangoGlucosa> = {
  ayunas: { min: 40, max: 95 },
  despues: { min: 40, max: 140 },
  dormir: { min: 40, max: 120 },
};

export function getGrupoEdad(edad: number | null | undefined): GrupoEdad | null {
  if (typeof edad !== 'number') return null; // en el original, null/undefined fallan todas las comparaciones
  if (edad >= 6 && edad <= 12) return 'infante';
  if (edad >= 13 && edad <= 19) return 'adolescente';
  if (edad >= 20 && edad <= 35) return 'joven';
  if (edad >= 36 && edad <= 60) return 'adulto';
  if (edad > 60) return 'mayor';
  return null;
}

// `tipo` llega del backend como texto libre (enfermedades[0]) o ausente: se acepta string | null | undefined.
export function obtenerRango(
  edad: number | null | undefined,
  tipo: string | null | undefined,
  momento: Momento,
): RangoGlucosa | undefined {
  if (tipo === 'Embarazada') {
    return RANGOS_EMBARAZADAS[momento];
  } else if (tipo === 'Diabetes Gestacional') {
    return RANGOS_EMBARAZADAS_DG[momento];
  } else {
    const grupo = getGrupoEdad(edad);
    if (!grupo) return undefined;

    if (tipo === null) {
      return RANGOS_NORMALES[grupo][momento];
    } else if (tipo === 'Diabetes Tipo 1' || tipo === 'Diabetes Tipo 2') {
      return RANGOS_DIABETICOS[grupo][momento];
    }
  }
  return undefined;
}

export function esHipoglucemia(valor: number): boolean {
  return valor < GLUCOSA_HIPO_MAX;
}

export function esHiperglucemia(
  edad: number | null | undefined,
  tipo: string | null | undefined,
  momento: Momento,
  valor: number,
): boolean {
  const rango = obtenerRango(edad, tipo, momento);
  return rango ? valor > rango.max : false;
}

export function evaluarGlucosa(
  edad: number | null | undefined,
  tipo: string | null | undefined,
  momento: Momento,
  valor: number,
): Estado {
  if (esHipoglucemia(valor)) {
    return 'HIPOGLUCEMIA';
  }

  if (esHiperglucemia(edad, tipo, momento, valor)) {
    return 'HIPERGLUCEMIA';
  }

  const rango = obtenerRango(edad, tipo, momento);
  if (!rango) {
    return 'PARAM_INVALIDO';
  }

  return 'NORMAL';
}

/** Tipo de paciente según registrar-glucosa.ts del front web (embarazo manda; si no, la primera enfermedad). */
export function obtenerTipoPaciente(datos: { embarazo: boolean; enfermedades: string[] }): string | undefined {
  if (datos.embarazo === true) {
    return datos.enfermedades.includes('Diabetes Gestacional') ? 'Diabetes Gestacional' : 'Embarazada';
  }
  return datos.enfermedades[0];
}

/** Momentos de la base (GET /api/general/momentos): 1 = ayunas, 2 = después de comer, 3 = antes de dormir. */
export function momentoDeId(idMomento: number): Momento | undefined {
  if (idMomento === 1) return 'ayunas';
  if (idMomento === 2) return 'despues';
  if (idMomento === 3) return 'dormir';
  return undefined;
}

/** La recomendación de medir «2 horas después» solo aplica cuando el momento es posterior a una comida. */
export function esMomentoPostComida(clave: string | undefined | null): boolean {
  return clave === 'despues';
}

/** 1 = hipoglucemia, 2 = hiperglucemia (POST /api/registro/registrarAlerta); undefined si no hay alerta. */
export function idTipoAlerta(estado: Estado): 1 | 2 | undefined {
  if (estado === 'HIPOGLUCEMIA') return 1;
  if (estado === 'HIPERGLUCEMIA') return 2;
  return undefined;
}

export type EstadoAlerta = 'enviada' | 'fallida' | 'no_aplica';

/** Textos del front web (hipoglucemia e hiperglucemia). Solo afirma que se avisó al médico si la alerta se registró. */
export function mensajeResultado(estado: Estado, alerta: EstadoAlerta): string {
  const aviso =
    alerta === 'enviada'
      ? ' Se envió un correo a tu médico asignado para su seguimiento.'
      : ' No se pudo avisar a tu médico: contáctalo directamente.';
  if (estado === 'HIPOGLUCEMIA') {
    return 'Tu glucosa está baja. Toma una fuente de azúcar de acción rápida y vuelve a medir en unos minutos.' + aviso;
  }
  if (estado === 'HIPERGLUCEMIA') {
    return 'Tu glucosa está elevada. Hidrátate y vuelve a medir más adelante.' + aviso;
  }
  if (estado === 'PARAM_INVALIDO') {
    return 'No se pudo clasificar esta toma con los datos de tu perfil (por ejemplo, tu edad o tu tipo de diabetes). La toma se guardó, pero no se avisó a tu médico: consúltalo directamente.';
  }
  return 'Tu nivel de glucemia se encuentra dentro de los parámetros esperados para este momento.';
}
