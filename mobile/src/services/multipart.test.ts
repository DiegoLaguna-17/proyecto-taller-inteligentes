// Envío multipart con archivo local: en Expo SDK 58 el fetch global (expo/fetch) no admite {uri, name, type},
// así que los FormData van por XMLHttpRequest. Aquí se simula XMLHttpRequest (en node no existe).
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
delete process.env.EXPO_PUBLIC_USE_MOCK;

const { solicitar, ErrorApi, MENSAJES } = await import('./http.ts');
const R = await import('./registroPaciente.ts');

interface Prog {
  status?: number;
  cuerpo?: string;
  fallo?: 'red' | 'timeout';
  retryAfter?: string;
}
const enviados: { metodo: string; url: string; cabeceras: Record<string, string>; cuerpo: unknown; timeout: number }[] = [];
let programa: Prog = {};

class XhrFalso {
  status = 0;
  responseText = '';
  timeout = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  private m = '';
  private u = '';
  private h: Record<string, string> = {};
  open(m: string, u: string) { this.m = m; this.u = u; }
  setRequestHeader(k: string, v: string) { this.h[k] = v; }
  getResponseHeader(k: string) { return k.toLowerCase() === 'retry-after' ? (programa.retryAfter ?? null) : null; }
  send(cuerpo: unknown) {
    enviados.push({ metodo: this.m, url: this.u, cabeceras: this.h, cuerpo, timeout: this.timeout });
    queueMicrotask(() => {
      if (programa.fallo === 'red') return this.onerror?.();
      if (programa.fallo === 'timeout') return this.ontimeout?.();
      this.status = programa.status ?? 200;
      this.responseText = programa.cuerpo ?? '{}';
      this.onload?.();
    });
  }
}

const fetchOriginal = globalThis.fetch;
test.beforeEach(() => {
  enviados.length = 0;
  programa = {};
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = XhrFalso;
  // si el multipart usara fetch, la prueba debe fallar
  globalThis.fetch = (async () => { throw new Error('el multipart no debe usar fetch'); }) as unknown as typeof fetch;
});
test.afterEach(() => {
  delete (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
  globalThis.fetch = fetchOriginal;
});

const foto = { uri: 'file:///data/user/0/app/cache/ImagePicker/abc.jpg', nombre: 'perfil.jpg', tipo: 'image/jpeg', bytes: 183552 };
const solicitud = {
  nombreCompleto: 'Carlos Ruiz', correo: 'carlos.privado@x.test', contrasena: 'clave-secreta-1', fechaNac: '1990-05-23', telefono: '70000000',
  genero: 'Masculino' as const, embarazada: false, semanas: '', peso: '72.5', altura: '165', idMedico: 2, idActividad: 1,
  enfermedadId: 3, tratamientoId: 4, dosis: '850 mg', nombreEmergencia: 'María', numeroEmergencia: '71111111', foto,
};

function capturarLog(f: () => Promise<unknown>): Promise<string[]> {
  const lineas: string[] = [];
  const log = console.log;
  console.log = (...a: unknown[]) => lineas.push(a.join(' '));
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  return f().catch(() => {}).then(() => { console.log = log; return lineas; });
}

test('FormData con archivo: va por XMLHttpRequest, sin Content-Type propio y con el objeto {uri, name, type}', async () => {
  const fd = R.construirFormData(solicitud);
  await solicitar({ base: 'http://api.test', ruta: '/api/pacientes/registrarPaciente', metodo: 'POST', cuerpo: fd, timeoutMs: 60000 });
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].metodo, 'POST');
  assert.equal(enviados[0].url, 'http://api.test/api/pacientes/registrarPaciente');
  assert.equal(enviados[0].cabeceras['Content-Type'], undefined);
  assert.equal(enviados[0].cabeceras.Accept, 'application/json');
  assert.equal(enviados[0].timeout, 60000);
  assert.equal(enviados[0].cuerpo, fd);
});

test('el archivo se adjunta con MIME completo y nombre con extensión; ningún valor null ni undefined', () => {
  const campos = R.camposSolicitud(solicitud);
  for (const [k, v] of campos) assert.ok(v !== '' && v !== 'null' && v !== 'undefined' && v !== 'NaN', `campo ${k}: "${v}"`);
  assert.match(foto.tipo, /^image\/(jpeg|png)$/);
  assert.match(foto.nombre, /\.(jpg|png)$/);
});

test('respuestas del servidor por XHR: 200, 400 con mensaje y 500 sin filtrar', async () => {
  const llamar = () => solicitar({ base: 'http://api.test', ruta: '/x', metodo: 'POST', cuerpo: new FormData(), mensajes: { 400: 'Falta la foto.' } });
  programa = { status: 200, cuerpo: '{"message":"ok"}' };
  assert.deepEqual(await llamar(), { message: 'ok' });
  programa = { status: 400, cuerpo: '{"error":"Archivo de perfil faltante"}' };
  await assert.rejects(llamar(), (e: InstanceType<typeof ErrorApi>) => e.estado === 400 && e.message === 'Falta la foto.');
  programa = { status: 500, cuerpo: '{"error":"duplicate key value violates unique constraint"}' };
  await assert.rejects(llamar(), (e: InstanceType<typeof ErrorApi>) => e.message === MENSAJES.servidor);
  programa = { status: 429, cuerpo: '{}', retryAfter: '7' };
  await assert.rejects(llamar(), (e: InstanceType<typeof ErrorApi>) => e.estado === 429 && e.reintentarEnSeg === 7);
});

test('fallo de red y timeout por XHR se traducen a mensajes amables', async () => {
  const llamar = () => solicitar({ base: 'http://api.test', ruta: '/x', metodo: 'POST', cuerpo: new FormData() });
  programa = { fallo: 'red' };
  await assert.rejects(llamar(), (e: InstanceType<typeof ErrorApi>) => e.codigo === 'red' && e.message === MENSAJES.red);
  programa = { fallo: 'timeout' };
  await assert.rejects(llamar(), (e: InstanceType<typeof ErrorApi>) => e.codigo === 'timeout' && e.message === MENSAJES.timeout);
});

test('sonda de aislamiento: sin archivo, solo el campo "rol"; el 400 del servidor significa que el multipart llega', async () => {
  programa = { status: 400, cuerpo: '{"error":"Archivo de perfil faltante"}' };
  const r = await R.probarMultipartSinArchivo();
  assert.match(r, /^OK: el servidor respondió 400/);
  const fd = enviados[0].cuerpo as FormData;
  assert.deepEqual([...fd.keys()], ['rol']);
  assert.equal(fd.has('foto_perfil'), false);
  assert.equal(fd.has('correo'), false); // sin datos personales
  programa = { fallo: 'red' };
  assert.match(await R.probarMultipartSinArchivo(), /^FALLO \[red 0\]/);
});

test('desarrollo: al fallar el envío se registra nombre y mensaje del error, tipo y tamaño del adjunto, y la sonda', async () => {
  programa = { fallo: 'red' };
  const lineas = await capturarLog(() => R.enviarSolicitudPaciente(solicitud));
  const log = lineas.join('\n');
  assert.match(log, /\[http\] POST \/api\/pacientes\/registrarPaciente -> FALLO TypeError: Network request failed \(\d+ ms\)/);
  assert.match(log, /\[registro-paciente\] adjunto: tipo=image\/jpeg bytes=183552/);
  assert.match(log, /\[registro-paciente\] sonda sin archivo: FALLO \[red 0\]/);
  // nunca contenido, ruta del archivo, correo, contraseña ni URL
  assert.ok(!/carlos\.privado|clave-secreta|ImagePicker|abc\.jpg|api\.test|Carlos|70000000/.test(log), log);
});

test('desarrollo: si el servidor responde, la sonda no se dispara; sin __DEV__ no se registra nada', async () => {
  programa = { status: 400, cuerpo: '{"error":"Faltan datos"}' };
  const lineas = await capturarLog(() => R.enviarSolicitudPaciente(solicitud));
  assert.ok(!lineas.join('\n').includes('sonda'));
  assert.match(lineas.join('\n'), /-> 400 \(\d+ ms\)/);

  delete (globalThis as { __DEV__?: boolean }).__DEV__;
  const log = console.log;
  const sinDev: string[] = [];
  console.log = (...a: unknown[]) => sinDev.push(a.join(' '));
  programa = { fallo: 'red' };
  await R.enviarSolicitudPaciente(solicitud).catch(() => {});
  console.log = log;
  assert.equal(sinDev.length, 0);
});

test('el mensaje del error se limpia de URLs en el registro de desarrollo', async () => {
  globalThis.fetch = (async () => { throw new TypeError('Failed to connect to http://192.0.2.7:8000/api/x'); }) as unknown as typeof fetch;
  delete (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
  const lineas = await capturarLog(() => solicitar({ base: 'http://api.test', ruta: '/x' }));
  assert.match(lineas.join('\n'), /FALLO TypeError: Failed to connect to <url>/);
  assert.ok(!lineas.join('\n').includes('192.0.2.7'));
});
