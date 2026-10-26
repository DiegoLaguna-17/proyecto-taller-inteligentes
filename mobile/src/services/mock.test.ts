// Modo simulado (EXPO_PUBLIC_USE_MOCK=true): ningún flujo conectado debe tocar la red.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
process.env.EXPO_PUBLIC_NLP_URL = 'http://nlp.test';
process.env.EXPO_PUBLIC_USE_MOCK = 'true';

const { USE_MOCK } = await import('./config.ts');
const { iniciarSesion } = await import('./auth.ts');
const { obtenerMomentos, obtenerDatosPaciente, obtenerRegistros } = await import('./glucosa.ts');
const { registrarToma } = await import('./registroToma.ts');
const { consultarChatbot } = await import('./chatbot.ts');
const { filtrarPorPeriodo } = await import('./historial.ts');

const original = globalThis.fetch;
test.beforeEach(() => {
  globalThis.fetch = (async () => { throw new Error('el modo simulado no debe usar la red'); }) as unknown as typeof fetch;
});
test.afterEach(() => { globalThis.fetch = original; });

test('solo "true" activa el modo simulado', () => {
  assert.equal(USE_MOCK, true);
});

test('registro, historial y chatbot funcionan sin red', async () => {
  assert.equal((await obtenerMomentos()).length, 3);
  const datos = await obtenerDatosPaciente(1);
  const r = await registrarToma({ datos, idMomento: 1, valor: 110, ahora: new Date() });
  assert.equal(r.estado, 'NORMAL');
  const hipo = await registrarToma({ datos, idMomento: 3, valor: 60, ahora: new Date() });
  assert.deepEqual([hipo.estado, hipo.alerta], ['HIPOGLUCEMIA', 'enviada']);
  const registros = await obtenerRegistros(1);
  assert.ok(filtrarPorPeriodo(registros, 'Mensual', new Date()).length > 0);
  assert.match(await consultarChatbot('hola'), /médico tratante/);
});

test('el login real no se usa en modo simulado', async () => {
  await assert.rejects(iniciarSesion('a@b.c', 'x'));
});
