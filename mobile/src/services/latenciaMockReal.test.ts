// Con el backend real (sin EXPO_PUBLIC_USE_MOCK) la latencia simulada no tiene ningún efecto, aunque la variable exista.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test/';
delete process.env.EXPO_PUBLIC_USE_MOCK;
process.env.EXPO_PUBLIC_MOCK_LATENCIA = '5000';

const { MOCK_LATENCIA_MS } = await import('./config.ts');
const { esperarMock } = await import('./latenciaMock.ts');

test('sin modo simulado la latencia vale 0 y no espera', async () => {
  assert.equal(MOCK_LATENCIA_MS, 0);
  const t0 = Date.now();
  await esperarMock();
  assert.ok(Date.now() - t0 < 100);
});
