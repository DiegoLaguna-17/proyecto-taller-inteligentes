// Registro de desarrollo de las respuestas 5xx: enmascarado de datos personales y truncado.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
delete process.env.EXPO_PUBLIC_USE_MOCK;

const { enmascarar, solicitar, MAX_TEXTO_5XX, MENSAJES, ErrorApi } = await import('./http.ts');

const CORREO = 'carlos.privado@ejemplo.com';
const TEL = '70123456';
const CLAVE = 'MiClaveSecreta-99';

test('enmascarar: correos, teléfonos y números largos', () => {
  const t = enmascarar(`Usuario ${CORREO} con teléfono ${TEL}, otro +591 70123456 y cuenta 12345678901234`);
  assert.ok(!t.includes('carlos') && !t.includes('ejemplo.com'), t);
  assert.ok(!t.includes('70123456') && !t.includes('12345678901234') && !t.includes('591'), t);
  assert.equal((t.match(/<dato>/g) ?? []).length, 4);
});

test('enmascarar: contraseñas, códigos, tokens y hashes', () => {
  const t = enmascarar(
    `{'contrasena': '${CLAVE}', "password": "${CLAVE}", codigo=123456, token: abc.def, hash $2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123456}`,
  );
  assert.ok(!t.includes(CLAVE) && !t.includes('123456') && !t.includes('abc.def') && !t.includes('$2b$'), t);
});

test('enmascarar: filas y claves de Postgres con datos personales', () => {
  const fila = enmascarar(`null value in column "fecha_registro" violates not-null constraint. Failing row contains (12, Carlos Ruiz, ${CORREO}, hash, paciente).`);
  assert.ok(!fila.includes('Carlos Ruiz') && !fila.includes('carlos') && !fila.includes('paciente)'), fila);
  assert.match(fila, /Failing row contains \(<dato>\)/);
  const clave = enmascarar(`duplicate key value violates unique constraint "usuario_correo_key" DETAIL: Key (correo)=(${CORREO}) already exists.`);
  assert.ok(!clave.includes('carlos'), clave);
  assert.match(clave, /Key \(correo\)=\(<dato>\) already exists/);
  assert.match(clave, /usuario_correo_key/); // el nombre de la restricción es útil y no es personal
});

test('enmascarar: rutas de archivos, URLs y tokens largos', () => {
  const t = enmascarar('upload failed file:///data/user/0/app/cache/ImagePicker/abc.jpg y imgs/1730000000_perfil.png en http://192.0.2.7:8000/x token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghij');
  assert.ok(!/ImagePicker|abc\.jpg|perfil\.png|192\.0\.2\.7|eyJhbGci/.test(t), t);
});

test('enmascarar: conserva la causa técnica útil (sin datos)', () => {
  const t = enmascarar('numeric field overflow DETAIL: A field with precision 3, scale 2 must round to an absolute value less than 10^1.');
  assert.match(t, /numeric field overflow/);
  assert.match(t, /precision 3, scale 2/);
});

const original = globalThis.fetch;
const json = (c: unknown, s: number) => new Response(JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
function capturar(f: () => Promise<unknown>, dev: boolean): Promise<string[]> {
  const lineas: string[] = [];
  const log = console.log;
  console.log = (...a: unknown[]) => lineas.push(a.join(' '));
  if (dev) (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  else delete (globalThis as { __DEV__?: boolean }).__DEV__;
  return f().catch(() => {}).then(() => { console.log = log; return lineas; });
}
test.afterEach(() => { globalThis.fetch = original; delete (globalThis as { __DEV__?: boolean }).__DEV__; });

test('5xx en desarrollo: registra error y details enmascarados, sin el cuerpo de la petición', async () => {
  globalThis.fetch = (async () =>
    json({
      error: `duplicate key value violates unique constraint "usuario_correo_key"`,
      details: `Key (correo)=(${CORREO}) already exists. fila: ${TEL}`,
    }, 500)) as unknown as typeof fetch;
  const lineas = await capturar(
    () => solicitar({ base: 'http://api.test', ruta: '/api/pacientes/registrarPaciente', metodo: 'POST', cuerpo: { correo: CORREO, contrasena: CLAVE, telefono: TEL } }),
    true,
  );
  const log = lineas.join('\n');
  assert.match(log, /^\[http\] POST \/api\/pacientes\/registrarPaciente -> 500 error=".*usuario_correo_key.*" details=".*"/m);
  // el registro de estado "-> 500 (N ms)" sigue presente
  assert.match(log, /-> 500 \(\d+ ms\)/);
  assert.ok(!log.includes(CORREO) && !log.includes('carlos') && !log.includes(TEL) && !log.includes(CLAVE), log);
});

test('5xx: se trunca a 300 caracteres y avisa si faltan campos', async () => {
  globalThis.fetch = (async () => json({ error: 'palabra '.repeat(200) + 'fin' }, 500)) as unknown as typeof fetch;
  const lineas = await capturar(() => solicitar({ base: 'http://api.test', ruta: '/x' }), true);
  const linea = lineas.find((l) => l.includes('error='))!;
  const valor = /error="([^"]*)"/.exec(linea)![1];
  assert.equal(valor.length, MAX_TEXTO_5XX + 1); // 300 + "…"
  assert.ok(!valor.includes('fin'));
  assert.match(linea, /details=\(sin campo\)/);
});

test('5xx con campos no textuales (objeto) se enmascaran igual', async () => {
  globalThis.fetch = (async () => json({ error: 'fallo', details: { correo: CORREO, telefono: TEL } }, 500)) as unknown as typeof fetch;
  const lineas = await capturar(() => solicitar({ base: 'http://api.test', ruta: '/x' }), true);
  assert.ok(!lineas.join('\n').includes(CORREO) && !lineas.join('\n').includes(TEL));
});

test('solo 5xx: un 400 o 404 no registra el texto del servidor', async () => {
  globalThis.fetch = (async () => json({ error: `Correo ${CORREO} inválido` }, 400)) as unknown as typeof fetch;
  const lineas = await capturar(() => solicitar({ base: 'http://api.test', ruta: '/x' }), true);
  assert.ok(!lineas.join('\n').includes('error='));
});

test('producción (sin __DEV__): no se registra nada y el usuario ve el mensaje genérico', async () => {
  globalThis.fetch = (async () => json({ error: `boom ${CORREO}`, details: TEL }, 500)) as unknown as typeof fetch;
  let error: unknown;
  const lineas = await capturar(
    () => solicitar({ base: 'http://api.test', ruta: '/x' }).catch((e) => { error = e; throw e; }),
    false,
  );
  assert.equal(lineas.length, 0);
  assert.ok(error instanceof ErrorApi);
  assert.equal((error as InstanceType<typeof ErrorApi>).message, MENSAJES.servidor);
  assert.ok(!(error as Error).message.includes(CORREO));
});

test('en desarrollo el mensaje al usuario sigue siendo el genérico', async () => {
  globalThis.fetch = (async () => json({ error: `boom ${CORREO}` }, 500)) as unknown as typeof fetch;
  let error: unknown;
  await capturar(() => solicitar({ base: 'http://api.test', ruta: '/x' }).catch((e) => { error = e; throw e; }), true);
  assert.equal((error as Error).message, MENSAJES.servidor);
});
