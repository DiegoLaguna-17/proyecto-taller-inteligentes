// Registro de glucosa por el médico (TASK-067): validación, cuerpo, clasificación, alerta y errores (fetch simulado).
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test/';
delete process.env.EXPO_PUBLIC_USE_MOCK;

const M = await import('./registroTomaMedico.ts');
const { ErrorApi, MENSAJES } = await import('./http.ts');

type Llamada = { url: string; metodo: string; cuerpo: unknown };
const original = globalThis.fetch;
const llamadas: Llamada[] = [];
function simular(r: (l: Llamada) => Response) {
  llamadas.length = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const l = { url, metodo: init?.method ?? 'GET', cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined };
    llamadas.push(l);
    return r(l);
  }) as unknown as typeof fetch;
}
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
test.afterEach(() => { globalThis.fetch = original; });

// paciente 5 con médico ASIGNADO 9; quien registra es el médico 3
const paciente = { id_paciente: 5, id_medico: 9, edad: 45, embarazo: false, enfermedades: ['Diabetes Tipo 2'] };
const ahora = new Date(2026, 9, 26, 8, 5, 9);
const base = { datos: paciente, idMedico: 3, ahora };
const esGlucosa = (l: Llamada) => l.url.endsWith('/medicos/registrar/glucosa');

test('validación: acepta 20 y 600; rechaza 0, 19, 601, vacío, letras, decimales y negativos', () => {
  const v = (valor: string, idMomento: number | null = 1, observaciones = '') => M.validarTomaMedico({ valor, idMomento, observaciones });
  assert.equal(v('20'), null);
  assert.equal(v('600'), null);
  assert.equal(v('110'), null);
  for (const malo of ['0', '00', '19', '601', '', ' ', 'abc', '12a', '110.5', '-5', '1e2']) {
    assert.match(v(malo) ?? '', /entre 20 y 600/, `debe rechazar «${malo}»`);
  }
});

test('validación: momento obligatorio y observaciones con límite', () => {
  assert.equal(M.validarTomaMedico({ valor: '100', idMomento: null, observaciones: '' }), 'Selecciona el momento de la toma.');
  assert.equal(M.validarTomaMedico({ valor: '100', idMomento: 1, observaciones: 'x'.repeat(M.MAX_OBSERVACIONES) }), null);
  assert.match(M.validarTomaMedico({ valor: '100', idMomento: 1, observaciones: 'x'.repeat(M.MAX_OBSERVACIONES + 1) }) ?? '', /como máximo/);
});

test('cuerpo exacto: POST a /medicos/registrar/glucosa con id_medico, fecha aaaa-mm-dd y hora hh:mm:ss locales', async () => {
  simular(() => json({ registro_glucosa: { id_registro: 70 } }));
  const r = await M.registrarTomaMedico({ ...base, idMomento: 1, valor: 110 });
  assert.deepEqual(r, { estado: 'NORMAL', idRegistro: 70, alerta: 'no_aplica' });
  assert.equal(llamadas.length, 1); // NORMAL: ninguna alerta
  assert.deepEqual(llamadas[0], {
    url: 'http://api.test/api/medicos/registrar/glucosa',
    metodo: 'POST',
    cuerpo: { id_paciente: 5, id_medico: 3, id_momento: 1, nivel_glucosa: 110, fecha: '2026-10-26', hora: '08:05:09' },
  });
});

test('observaciones: se envían recortadas solo si hay texto', async () => {
  simular(() => json({ registro_glucosa: { id_registro: 71 } }));
  await M.registrarTomaMedico({ ...base, idMomento: 1, valor: 110, observaciones: '  mareo leve  ' });
  assert.equal((llamadas[0].cuerpo as { observaciones?: string }).observaciones, 'mareo leve');
  await M.registrarTomaMedico({ ...base, idMomento: 1, valor: 110, observaciones: '   ' });
  assert.ok(!('observaciones' in (llamadas[1].cuerpo as object)));
});

test('hipoglucemia: alerta tipo 1 con el médico ASIGNADO al paciente (9), no el que registra (3)', async () => {
  simular((l) => (esGlucosa(l) ? json({ registro_glucosa: { id_registro: 72 } }) : json({ message: 'ok' })));
  const r = await M.registrarTomaMedico({ ...base, idMomento: 3, valor: 60 });
  assert.deepEqual(r, { estado: 'HIPOGLUCEMIA', idRegistro: 72, alerta: 'enviada' });
  assert.deepEqual(llamadas[1], {
    url: 'http://api.test/api/registro/registrarAlerta',
    metodo: 'POST',
    cuerpo: { id_tipo_alerta: 1, id_registro: 72, id_medico: 9, fecha_alerta: '2026-10-26' },
  });
});

test('hiperglucemia: alerta tipo 2', async () => {
  simular((l) => (esGlucosa(l) ? json({ registro_glucosa: { id_registro: 73 } }) : json({})));
  const r = await M.registrarTomaMedico({ ...base, idMomento: 1, valor: 131 });
  assert.equal(r.estado, 'HIPERGLUCEMIA');
  assert.equal((llamadas[1].cuerpo as { id_tipo_alerta: number }).id_tipo_alerta, 2);
});

test('PARAM_INVALIDO (edad fuera de tabla): se guarda y NO se crea alerta', async () => {
  simular(() => json({ registro_glucosa: { id_registro: 74 } }));
  const r = await M.registrarTomaMedico({ ...base, datos: { ...paciente, edad: 4 }, idMomento: 1, valor: 100 });
  assert.deepEqual(r, { estado: 'PARAM_INVALIDO', idRegistro: 74, alerta: 'no_aplica' });
  assert.equal(llamadas.length, 1);
});

test('si la alerta falla: la lectura queda guardada, alerta fallida y la lectura NO se repite', async () => {
  simular((l) => (esGlucosa(l) ? json({ registro_glucosa: { id_registro: 75 } }) : json({ error: 'x' }, 500)));
  const r = await M.registrarTomaMedico({ ...base, idMomento: 3, valor: 60 });
  assert.deepEqual(r, { estado: 'HIPOGLUCEMIA', idRegistro: 75, alerta: 'fallida' });
  assert.equal(llamadas.filter(esGlucosa).length, 1);
});

test('sin médico asignado: no se puede alertar -> alerta fallida', async () => {
  simular(() => json({ registro_glucosa: { id_registro: 76 } }));
  const r = await M.registrarTomaMedico({ ...base, datos: { ...paciente, id_medico: null }, idMomento: 3, valor: 60 });
  assert.equal(r.alerta, 'fallida');
  assert.equal(llamadas.length, 1);
});

test('errores al guardar: 400 con mensaje propio, 5xx genérico sin texto de la excepción; ninguna alerta', async () => {
  simular(() => json({ error: 'Todos los campos (menos observaciones) deben estar llenados' }, 400));
  await assert.rejects(M.registrarTomaMedico({ ...base, idMomento: 3, valor: 60 }), (e: InstanceType<typeof ErrorApi>) => e.estado === 400 && /Faltan datos de la toma/.test(e.message));
  simular(() => json({ error: 'duplicate key value violates constraint "registro_glucosa_pkey" (id)=(5)' }, 500));
  await assert.rejects(M.registrarTomaMedico({ ...base, idMomento: 3, valor: 60 }), (e: InstanceType<typeof ErrorApi>) => {
    return e.estado === 500 && e.message === MENSAJES.servidor && !/duplicate|pkey|\(5\)/.test(e.message);
  });
  assert.equal(llamadas.length, 1);
});

test('mensaje de fallo: aviso de lectura posiblemente guardada en red, tiempo y 5xx; no en 400', () => {
  const m500 = M.mensajeFalloTomaMedico(new ErrorApi('http', MENSAJES.servidor, 500));
  assert.ok(m500.startsWith(MENSAJES.servidor) && m500.includes(M.AVISO_LECTURA_POSIBLEMENTE_GUARDADA));
  assert.ok(M.mensajeFalloTomaMedico(new ErrorApi('red', MENSAJES.red)).includes('historial'));
  assert.ok(M.mensajeFalloTomaMedico(new ErrorApi('timeout', MENSAJES.timeout)).includes('historial'));
  assert.equal(M.mensajeFalloTomaMedico(new ErrorApi('http', 'Faltan datos', 400)), 'Faltan datos');
  assert.equal(M.mensajeFalloTomaMedico(new Error('detalle técnico')), MENSAJES.generico);
});

test('textos para el médico: nombran al paciente y no hablan en segunda persona del paciente', () => {
  const baja = M.mensajeResultadoMedico('HIPOGLUCEMIA', 'enviada', 'Ana Pérez');
  assert.ok(baja.startsWith('Lectura baja registrada por el médico para Ana Pérez.'));
  assert.ok(M.mensajeResultadoMedico('HIPERGLUCEMIA', 'enviada', 'Ana Pérez').startsWith('Lectura alta registrada por el médico para Ana Pérez.'));
  for (const estado of ['HIPOGLUCEMIA', 'HIPERGLUCEMIA', 'NORMAL', 'PARAM_INVALIDO'] as const) {
    assert.ok(!/tu glucosa|tu médico/i.test(M.mensajeResultadoMedico(estado, 'enviada', 'Ana Pérez')));
  }
  assert.match(M.mensajeResultadoMedico('HIPOGLUCEMIA', 'fallida', 'Ana'), /no se pudo crear la alerta: no la repitas/);
  assert.match(M.mensajeResultadoMedico('PARAM_INVALIDO', 'no_aplica', 'Ana'), /no se creó ninguna alerta/);
  assert.match(M.mensajeResultadoMedico('NORMAL', 'no_aplica', ''), /para el paciente/);
});
