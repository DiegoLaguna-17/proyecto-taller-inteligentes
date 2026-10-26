import test from 'node:test';
import assert from 'node:assert/strict';
import { solicitar, ErrorApi, MENSAJES, mensajeDeError } from './http.ts';

const original = globalThis.fetch;
const sustituir = (f: typeof fetch) => { globalThis.fetch = f; };
const json = (cuerpo: unknown, estado = 200, cabeceras: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json', ...cabeceras } });

test.afterEach(() => { globalThis.fetch = original; });

test('sin URL base: error de configuración y no se llama a la red', async () => {
  let llamado = false;
  sustituir((async () => { llamado = true; return json({}); }) as typeof fetch);
  await assert.rejects(solicitar({ base: '', ruta: '/x' }), (e: ErrorApi) => e.codigo === 'config' && e.message === MENSAJES.config);
  assert.equal(llamado, false);
});

test('200: devuelve el JSON y envía el cuerpo en POST', async () => {
  let visto: { url: string; init?: RequestInit } | undefined;
  sustituir((async (url: string, init?: RequestInit) => { visto = { url, init }; return json({ ok: 1 }); }) as unknown as typeof fetch);
  const r = await solicitar<{ ok: number }>({ base: 'http://srv', ruta: '/api/x', metodo: 'POST', cuerpo: { a: 1 } });
  assert.deepEqual(r, { ok: 1 });
  assert.equal(visto?.url, 'http://srv/api/x');
  assert.equal(visto?.init?.method, 'POST');
  assert.equal(visto?.init?.body, '{"a":1}');
});

test('4xx con {error}: muestra el texto del backend', async () => {
  sustituir((async () => json({ error: 'Código incorrecto o expirado' }, 401)) as typeof fetch);
  await assert.rejects(solicitar({ base: 'http://srv', ruta: '/x' }), (e: ErrorApi) => e.estado === 401 && e.message === 'Código incorrecto o expirado');
});

test('mensajes propios por código tienen prioridad', async () => {
  sustituir((async () => json({ error: 'Contraseña incorrecta' }, 401)) as typeof fetch);
  await assert.rejects(
    solicitar({ base: 'http://srv', ruta: '/x', mensajes: { 401: 'Correo o contraseña incorrectos.' } }),
    (e: ErrorApi) => e.message === 'Correo o contraseña incorrectos.',
  );
});

test('5xx: nunca muestra el texto técnico del backend', async () => {
  sustituir((async () => json({ error: 'duplicate key value violates unique constraint "pk_x"' }, 500)) as typeof fetch);
  await assert.rejects(solicitar({ base: 'http://srv', ruta: '/x' }), (e: ErrorApi) => e.message === MENSAJES.servidor && !/duplicate/.test(e.message));
});

test('422 de FastAPI: no filtra "detail" ni el cuerpo enviado (puede incluir la contraseña)', async () => {
  const detalle = { detail: [{ type: 'missing', loc: ['body', 'contrasena'], msg: 'Field required', input: { correo: 'a@b.c', contrasena: 'SECRETO' } }] };
  sustituir((async () => json(detalle, 422)) as typeof fetch);
  await assert.rejects(solicitar({ base: 'http://srv', ruta: '/x' }), (e: ErrorApi) => e.message === MENSAJES.invalido && !/SECRETO|a@b\.c/.test(e.message));
});

test('429: usa Retry-After', async () => {
  sustituir((async () => json({ detail: 'x' }, 429, { 'retry-after': '12' })) as typeof fetch);
  await assert.rejects(solicitar({ base: 'http://srv', ruta: '/x' }), (e: ErrorApi) => e.estado === 429 && e.reintentarEnSeg === 12 && e.message === MENSAJES.limite);
});

test('red caída: mensaje amable sin detalles técnicos', async () => {
  sustituir((async () => { throw new TypeError('Network request failed: ECONNREFUSED servidor-interno:8000'); }) as typeof fetch);
  await assert.rejects(solicitar({ base: 'http://srv', ruta: '/x' }), (e: ErrorApi) => e.codigo === 'red' && e.message === MENSAJES.red && !/ECONNREFUSED|servidor-interno/.test(e.message));
});

test('timeout: aborta y avisa', async () => {
  sustituir(((_u: string, init?: RequestInit) => new Promise((_res, rej) => {
    init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('abortado'), { name: 'AbortError' })));
  })) as unknown as typeof fetch);
  await assert.rejects(solicitar({ base: 'http://srv', ruta: '/x', timeoutMs: 20 }), (e: ErrorApi) => e.codigo === 'timeout' && e.message === MENSAJES.timeout);
});

test('200 con cuerpo que no es JSON: respuesta inesperada', async () => {
  sustituir((async () => new Response('<html>', { status: 200 })) as typeof fetch);
  await assert.rejects(solicitar({ base: 'http://srv', ruta: '/x' }), (e: ErrorApi) => e.codigo === 'respuesta');
});

test('mensajeDeError: excepción desconocida -> mensaje genérico', () => {
  assert.equal(mensajeDeError(new Error('boom con datos internos')), MENSAJES.generico);
  assert.equal(mensajeDeError(new ErrorApi('red', 'hola')), 'hola');
});
