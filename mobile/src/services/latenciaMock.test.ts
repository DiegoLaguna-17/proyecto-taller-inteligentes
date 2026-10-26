// Latencia simulada (EXPO_PUBLIC_MOCK_LATENCIA): solo modo simulado; sin la variable no hay esperas.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test/';
process.env.EXPO_PUBLIC_USE_MOCK = 'true';
process.env.EXPO_PUBLIC_MOCK_LATENCIA = '40';

const { leerLatenciaMock, MOCK_LATENCIA_MS, MOCK_LATENCIA_MAX_MS } = await import('./config.ts');
const { esperarMock } = await import('./latenciaMock.ts');
const { registrarGlucosa } = await import('./glucosa.ts');

test('leerLatenciaMock: sin valor, inválido, cero o negativo da 0; con valor lo acota', () => {
  for (const v of [undefined, '', '  ', 'abc', '0', '-5', 'NaN', 'Infinity']) assert.equal(leerLatenciaMock(v), 0, String(v));
  assert.equal(leerLatenciaMock('250'), 250);
  assert.equal(leerLatenciaMock(' 12.6 '), 13);
  assert.equal(leerLatenciaMock('999999'), MOCK_LATENCIA_MAX_MS);
});

test('en modo simulado con la variable, el servicio simulado espera; con 0 no espera', async () => {
  assert.equal(MOCK_LATENCIA_MS, 40);
  const t0 = Date.now();
  assert.deepEqual(await registrarGlucosa({ id_paciente: 1, id_momento: 1, nivel_glucosa: 100, fecha: '2026-10-26', hora: '08:00:00' }), { id_registro: 1 });
  assert.ok(Date.now() - t0 >= 35);
  const t1 = Date.now();
  await esperarMock(0);
  assert.ok(Date.now() - t1 < 30);
});
