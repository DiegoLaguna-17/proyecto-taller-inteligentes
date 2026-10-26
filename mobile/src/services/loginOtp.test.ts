// Login con y sin OTP (ADR-0012, TASK-069): la app obedece la respuesta del backend.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test/';
delete process.env.EXPO_PUBLIC_USE_MOCK;
delete process.env.EXPO_PUBLIC_SIN_OTP;

const { iniciarSesion, leerRespuestaLogin, verificarOtp } = await import('./auth.ts');
const { ErrorApi } = await import('./http.ts');

const original = globalThis.fetch;
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const responder = (c: unknown, s = 200) => { globalThis.fetch = (async () => json(c, s)) as unknown as typeof fetch; };
test.afterEach(() => { globalThis.fetch = original; });

test('con OTP (respuesta actual, sin rol): solo id_usuario y sigue al paso del código', async () => {
  responder({ id_usuario: 7, id_rol: 3, message: 'OTP enviado al correo' });
  assert.deepEqual(await iniciarSesion('a@b.c', 'clave'), { id_usuario: 7 });
});

test('sin OTP (respuesta con id_rol y rol): crea la sesión y no hace falta verify-otp', async () => {
  let llamadas = 0;
  globalThis.fetch = (async () => { llamadas += 1; return json({ id_usuario: 7, id_rol: 3, rol: 'medico', message: 'Login exitoso (OTP desactivado para pruebas)' }); }) as unknown as typeof fetch;
  const r = await iniciarSesion('a@b.c', 'clave');
  assert.deepEqual(r, { id_usuario: 7, sesion: { id_usuario: 7, id_rol: 3, rol: 'medico' } });
  assert.equal(llamadas, 1);
});

test('sin OTP: mapea los tres roles del backend como el verify-otp', () => {
  const rol = (r: string) => leerRespuestaLogin({ id_usuario: 1, id_rol: 2, rol: r }).sesion?.rol;
  assert.equal(rol('paciente'), 'paciente');
  assert.equal(rol('medico'), 'medico');
  assert.equal(rol('administrador'), 'admin');
});

test('respuestas inválidas: rol desconocido, rol sin id_rol, id_rol 0 o sin id_usuario fallan, nunca crean sesión', () => {
  for (const mala of [
    { id_usuario: 1, id_rol: 2, rol: 'superusuario' },
    { id_usuario: 1, id_rol: 2, rol: 5 },
    { id_usuario: 1, rol: 'medico' },
    { id_usuario: 1, id_rol: '2', rol: 'medico' },
    { rol: 'medico', id_rol: 2 },
    {},
    null,
    undefined,
  ]) {
    assert.throws(() => leerRespuestaLogin(mala as never), (e: unknown) => e instanceof ErrorApi, JSON.stringify(mala));
  }
  assert.throws(() => leerRespuestaLogin({ id_usuario: 1, id_rol: 0, rol: 'paciente' }), (e: InstanceType<typeof ErrorApi>) => /perfil/.test(e.message));
  assert.deepEqual(leerRespuestaLogin({ id_usuario: 1, rol: null }), { id_usuario: 1 }); // rol nulo = como sin rol
});

test('401 sigue dando el mensaje genérico en ambos caminos', async () => {
  responder({ error: 'Contraseña incorrecta' }, 401);
  await assert.rejects(iniciarSesion('a@b.c', 'x'), (e: InstanceType<typeof ErrorApi>) => e.message === 'Correo o contraseña incorrectos.');
});

test('verify-otp no cambia', async () => {
  responder({ id_usuario: 7, id_rol: 2, rol: 'administrador' });
  assert.deepEqual(await verificarOtp(7, ' 123456 '), { id_usuario: 7, id_rol: 2, rol: 'admin' });
});
