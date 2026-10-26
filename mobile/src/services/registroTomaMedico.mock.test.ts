// Modo simulado (EXPO_PUBLIC_USE_MOCK=true): el registro por el médico no llama a la red (TASK-067).
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
process.env.EXPO_PUBLIC_USE_MOCK = 'true';

const { registrarGlucosaMedico, registrarAlerta } = await import('./glucosa.ts');
const { registrarTomaMedico } = await import('./registroTomaMedico.ts');

test('mock: registrarGlucosaMedico y el flujo completo no usan la red', async () => {
  let red = 0;
  globalThis.fetch = (async () => { red += 1; return new Response('{}'); }) as unknown as typeof fetch;
  assert.deepEqual(await registrarGlucosaMedico({ id_paciente: 1, id_medico: 1, id_momento: 1, nivel_glucosa: 100, fecha: '2026-10-26', hora: '08:00:00' }), { id_registro: 1, riesgoMl: null });
  await registrarAlerta({ id_tipo_alerta: 1, id_registro: 1, id_medico: 1, fecha_alerta: '2026-10-26' });
  const r = await registrarTomaMedico({
    datos: { id_paciente: 1, id_medico: 2, edad: 45, embarazo: false, enfermedades: ['Diabetes Tipo 2'] },
    idMedico: 2, idMomento: 3, valor: 60, ahora: new Date(2026, 9, 26, 8, 0, 0),
  });
  assert.deepEqual(r, { estado: 'HIPOGLUCEMIA', idRegistro: 1, alerta: 'enviada' });
  assert.equal(red, 0);
});

test('mock: la última cifra de la glucosa elige el caso del riesgo de forma determinista', async () => {
  const caso = async (valor: number) =>
    (await registrarGlucosaMedico({ id_paciente: 1, id_medico: 1, id_momento: 1, nivel_glucosa: valor, fecha: '2026-10-26', hora: '08:00:00' })).riesgoMl;
  assert.equal(await caso(100), null); // 0: ML apagado, sin riesgo_ml
  assert.equal(await caso(60), null);
  assert.deepEqual(await caso(111), { riesgo: 0.1712, motivo: null, version: '1.1.0', supuestos: ['duracion_estimada', 'comorbilidades_no_capturadas', 'hba1c_no_disponible'], faltantes: [] });
  assert.deepEqual(await caso(112), { riesgo: null, motivo: 'datos_insuficientes', version: null, supuestos: [], faltantes: ['imc'] });
  assert.deepEqual((await caso(113))?.faltantes, ['imc', 'medicacion']);
  assert.deepEqual(await caso(114), { riesgo: null, motivo: 'datos_insuficientes', version: null, supuestos: [], faltantes: [] });
  assert.equal((await caso(115))?.motivo, 'no_aplica_tipo');
  assert.equal((await caso(116))?.motivo, 'momento_no_cubierto');
  assert.equal((await caso(117))?.motivo, 'no_disponible');
  assert.equal((await caso(118))?.riesgo, 0);
  assert.equal((await caso(119))?.riesgo, 1);
  assert.deepEqual(await caso(121), await caso(111)); // determinista: solo cuenta la última cifra
});
