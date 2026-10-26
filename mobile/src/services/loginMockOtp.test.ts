// Modo simulado con el OTP simulado (EXPO_PUBLIC_USE_MOCK=true y EXPO_PUBLIC_SIN_OTP=false), ADR-0012.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test/';
process.env.EXPO_PUBLIC_USE_MOCK = 'true';
process.env.EXPO_PUBLIC_SIN_OTP = 'false';

const { iniciarSesion, verificarOtp, CODIGO_OTP_SIMULADO } = await import('./auth.ts');
const { MOCK_CON_OTP } = await import('./config.ts');

test('el simulado con OTP está activo y no usa la red', async () => {
  let red = 0;
  globalThis.fetch = (async () => { red += 1; return new Response('{}'); }) as unknown as typeof fetch;
  assert.equal(MOCK_CON_OTP, true);
  const paso1 = await iniciarSesion(' Doctor@email.com ', '12345');
  assert.deepEqual(paso1, { id_usuario: 2 }); // sin sesión: falta el código
  assert.deepEqual(await verificarOtp(2, ` ${CODIGO_OTP_SIMULADO} `), { id_usuario: 2, id_rol: 1, rol: 'medico' });
  assert.equal((await verificarOtp(3, CODIGO_OTP_SIMULADO)).rol, 'admin');
  assert.equal((await verificarOtp(1, CODIGO_OTP_SIMULADO)).rol, 'paciente');
  assert.equal(red, 0);
});

test('simulado con OTP: credenciales y código incorrectos fallan con los mensajes de siempre', async () => {
  await assert.rejects(iniciarSesion('doctor@email.com', 'mala'), /Correo o contraseña incorrectos\./);
  await assert.rejects(iniciarSesion('nadie@email.com', '12345'), /Correo o contraseña incorrectos\./);
  await assert.rejects(verificarOtp(2, '000000'), /Código incorrecto o expirado\./);
  await assert.rejects(verificarOtp(99, CODIGO_OTP_SIMULADO));
});
