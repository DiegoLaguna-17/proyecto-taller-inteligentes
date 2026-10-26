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
  assert.deepEqual(await registrarGlucosaMedico({ id_paciente: 1, id_medico: 1, id_momento: 1, nivel_glucosa: 100, fecha: '2026-10-26', hora: '08:00:00' }), { id_registro: 1 });
  await registrarAlerta({ id_tipo_alerta: 1, id_registro: 1, id_medico: 1, fecha_alerta: '2026-10-26' });
  const r = await registrarTomaMedico({
    datos: { id_paciente: 1, id_medico: 2, edad: 45, embarazo: false, enfermedades: ['Diabetes Tipo 2'] },
    idMedico: 2, idMomento: 3, valor: 60, ahora: new Date(2026, 9, 26, 8, 0, 0),
  });
  assert.deepEqual(r, { estado: 'HIPOGLUCEMIA', idRegistro: 1, alerta: 'enviada' });
  assert.equal(red, 0);
});
