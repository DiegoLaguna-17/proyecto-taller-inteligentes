// Pruebas del port de glucosa.service.ts (front web). Ejecutar: npm test  (node --test, sin dependencias).
// La tabla de rangos máximos está escrita aquí a mano, aparte del código, para que sirva de segunda lectura del original.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluarGlucosa,
  getGrupoEdad,
  idTipoAlerta,
  mensajeResultado,
  momentoDeId,
  obtenerTipoPaciente,
  type Momento,
} from './clasificacionGlucosa.ts';

const MOMENTOS: Momento[] = ['ayunas', 'despues', 'dormir'];

// [grupo, edad representativa, máx. ayunas, máx. después, máx. dormir]
const NORMALES: [string, number, number, number, number][] = [
  ['infante', 8, 180, 200, 180],
  ['adolescente', 15, 130, 180, 150],
  ['joven', 28, 130, 140, 150],
  ['adulto', 45, 100, 150, 140],
  ['mayor', 70, 110, 160, 140],
];
const DIABETICOS: [string, number, number, number, number][] = [
  ['infante', 8, 130, 180, 150],
  ['adolescente', 15, 130, 180, 150],
  ['joven', 28, 130, 180, 150],
  ['adulto', 45, 130, 180, 150],
  ['mayor', 70, 110, 160, 180],
];
// [tipo, máx. ayunas, máx. después, máx. dormir]
const EMBARAZO: [string, number, number, number][] = [
  ['Embarazada', 95, 129, 120],
  ['Diabetes Gestacional', 95, 140, 120],
];

function verificarLimite(edad: number | null, tipo: string | null, momento: Momento, max: number, etiqueta: string) {
  assert.equal(evaluarGlucosa(edad, tipo, momento, max), 'NORMAL', `${etiqueta}: ${max} debe ser NORMAL`);
  assert.equal(evaluarGlucosa(edad, tipo, momento, max + 1), 'HIPERGLUCEMIA', `${etiqueta}: ${max + 1} debe ser HIPERGLUCEMIA`);
  assert.equal(evaluarGlucosa(edad, tipo, momento, 69), 'HIPOGLUCEMIA', `${etiqueta}: 69 debe ser HIPOGLUCEMIA`);
  assert.equal(evaluarGlucosa(edad, tipo, momento, 70), 'NORMAL', `${etiqueta}: 70 debe ser NORMAL`);
}

test('grupos de edad: límites 6/12/13/19/20/35/36/60/61', () => {
  const esperado: [number, string | null][] = [
    [5, null], [6, 'infante'], [12, 'infante'], [13, 'adolescente'], [19, 'adolescente'], [20, 'joven'],
    [35, 'joven'], [36, 'adulto'], [60, 'adulto'], [61, 'mayor'], [95, 'mayor'],
  ];
  for (const [edad, grupo] of esperado) assert.equal(getGrupoEdad(edad), grupo, `edad ${edad}`);
  assert.equal(getGrupoEdad(null), null);
  assert.equal(getGrupoEdad(undefined), null);
});

test('rangos normales (tipo === null en el original): por grupo de edad y momento', () => {
  for (const [grupo, edad, a, d, s] of NORMALES) {
    [a, d, s].forEach((max, i) => verificarLimite(edad, null, MOMENTOS[i], max, `normal/${grupo}/${MOMENTOS[i]}`));
  }
});

test('rangos diabéticos (Tipo 1 y Tipo 2): por grupo de edad y momento', () => {
  for (const tipo of ['Diabetes Tipo 1', 'Diabetes Tipo 2']) {
    for (const [grupo, edad, a, d, s] of DIABETICOS) {
      [a, d, s].forEach((max, i) => verificarLimite(edad, tipo, MOMENTOS[i], max, `${tipo}/${grupo}/${MOMENTOS[i]}`));
    }
  }
});

test('embarazo: Embarazada y Diabetes Gestacional, sin importar la edad', () => {
  for (const [tipo, a, d, s] of EMBARAZO) {
    for (const edad of [16, 30, 44]) {
      [a, d, s].forEach((max, i) => verificarLimite(edad, tipo, MOMENTOS[i], max, `${tipo}/${edad}/${MOMENTOS[i]}`));
    }
  }
});

test('hipoglucemia fija < 70 en cualquier tipo, momento y edad', () => {
  for (const tipo of ['Diabetes Tipo 1', 'Embarazada', 'Diabetes Gestacional', 'Normal', undefined, null]) {
    for (const m of MOMENTOS) {
      assert.equal(evaluarGlucosa(45, tipo as string, m, 69), 'HIPOGLUCEMIA');
      assert.equal(evaluarGlucosa(2, tipo as string, m, 50), 'HIPOGLUCEMIA');
    }
  }
});

// ---------------------------------------------------------------------------
// RAREZAS del servicio original, portadas tal cual (design.md § Clasificación en el cliente)
// ---------------------------------------------------------------------------

test('rareza 1: el tipo "Normal" no está contemplado -> PARAM_INVALIDO (salvo hipoglucemia)', () => {
  for (const m of MOMENTOS) {
    assert.equal(evaluarGlucosa(45, 'Normal', m, 85), 'PARAM_INVALIDO');
    assert.equal(evaluarGlucosa(45, 'Normal', m, 100), 'PARAM_INVALIDO');
    assert.equal(evaluarGlucosa(45, 'Normal', m, 500), 'PARAM_INVALIDO'); // ni siquiera detecta hiperglucemia
    assert.equal(evaluarGlucosa(45, 'Normal', m, 69), 'HIPOGLUCEMIA');
  }
  // Mismo efecto con una enfermedad que no es diabetes o sin enfermedades (tipo = enfermedades[0])
  assert.equal(evaluarGlucosa(45, 'Hipertensión', 'ayunas', 100), 'PARAM_INVALIDO');
  assert.equal(evaluarGlucosa(45, undefined, 'ayunas', 100), 'PARAM_INVALIDO');
});

test('rareza 2: los mínimos de embarazo nunca se usan (la hipoglucemia < 70 va primero)', () => {
  // Diabetes Gestacional tiene mínimo 40 en todos los momentos, pero 50 mg/dL es HIPOGLUCEMIA
  for (const m of MOMENTOS) assert.equal(evaluarGlucosa(30, 'Diabetes Gestacional', m, 50), 'HIPOGLUCEMIA');
  // Embarazada, después de comer: mínimo 109, pero 80 mg/dL (por debajo del mínimo) es NORMAL
  assert.equal(evaluarGlucosa(30, 'Embarazada', 'despues', 80), 'NORMAL');
  assert.equal(evaluarGlucosa(30, 'Embarazada', 'despues', 108), 'NORMAL');
  // Embarazada, dormir: mínimo 100, pero 75 es NORMAL
  assert.equal(evaluarGlucosa(30, 'Embarazada', 'dormir', 75), 'NORMAL');
});

test('rareza 3: edad < 6 (o ausente) -> PARAM_INVALIDO, salvo hipoglucemia y embarazo', () => {
  for (const edad of [5, 0, -1, null, undefined]) {
    assert.equal(evaluarGlucosa(edad, 'Diabetes Tipo 2', 'ayunas', 100), 'PARAM_INVALIDO', `edad ${edad}`);
    assert.equal(evaluarGlucosa(edad, 'Diabetes Tipo 2', 'ayunas', 69), 'HIPOGLUCEMIA', `edad ${edad}`);
    assert.equal(evaluarGlucosa(edad, 'Diabetes Tipo 2', 'ayunas', 300), 'PARAM_INVALIDO', `edad ${edad}`); // sin rango no hay hiper
  }
  // En embarazo la edad no se consulta
  assert.equal(evaluarGlucosa(null, 'Embarazada', 'ayunas', 90), 'NORMAL');
});

// ---------------------------------------------------------------------------

test('tipo de paciente: embarazo manda; si no, enfermedades[0]', () => {
  assert.equal(obtenerTipoPaciente({ embarazo: true, enfermedades: ['Diabetes Gestacional'] }), 'Diabetes Gestacional');
  assert.equal(obtenerTipoPaciente({ embarazo: true, enfermedades: ['Diabetes Tipo 2', 'Diabetes Gestacional'] }), 'Diabetes Gestacional');
  assert.equal(obtenerTipoPaciente({ embarazo: true, enfermedades: ['Diabetes Tipo 1'] }), 'Embarazada');
  assert.equal(obtenerTipoPaciente({ embarazo: true, enfermedades: [] }), 'Embarazada');
  assert.equal(obtenerTipoPaciente({ embarazo: false, enfermedades: ['Diabetes Tipo 2', 'Hipertensión'] }), 'Diabetes Tipo 2');
  assert.equal(obtenerTipoPaciente({ embarazo: false, enfermedades: [] }), undefined);
});

test('momentos de la base y tipos de alerta', () => {
  assert.equal(momentoDeId(1), 'ayunas');
  assert.equal(momentoDeId(2), 'despues');
  assert.equal(momentoDeId(3), 'dormir');
  assert.equal(momentoDeId(4), undefined);
  assert.equal(idTipoAlerta('HIPOGLUCEMIA'), 1);
  assert.equal(idTipoAlerta('HIPERGLUCEMIA'), 2);
  assert.equal(idTipoAlerta('NORMAL'), undefined);
  assert.equal(idTipoAlerta('PARAM_INVALIDO'), undefined);
});

test('mensajes del resultado: solo afirman que se avisó al médico si la alerta se registró', () => {
  assert.match(mensajeResultado('HIPOGLUCEMIA', 'enviada'), /Tu glucosa está baja\. Toma una fuente de azúcar de acción rápida y vuelve a medir/);
  assert.match(mensajeResultado('HIPOGLUCEMIA', 'enviada'), /Se envió un correo a tu médico/);
  assert.match(mensajeResultado('HIPERGLUCEMIA', 'enviada'), /Tu glucosa está elevada\. Hidrátate/);
  assert.match(mensajeResultado('HIPERGLUCEMIA', 'enviada'), /Se envió un correo a tu médico/);
  assert.doesNotMatch(mensajeResultado('HIPERGLUCEMIA', 'fallida'), /Se envió un correo/);
  assert.match(mensajeResultado('HIPERGLUCEMIA', 'fallida'), /No se pudo avisar a tu médico/);
  assert.match(mensajeResultado('PARAM_INVALIDO', 'no_aplica'), /No se pudo clasificar/);
  assert.doesNotMatch(mensajeResultado('PARAM_INVALIDO', 'no_aplica'), /Se envió un correo/);
  assert.match(mensajeResultado('NORMAL', 'no_aplica'), /dentro de los parámetros esperados/);
});
