// Riesgo de hipoglucemia (TASK-017g): lector defensivo, porcentaje, textos y que nunca rompa el registro.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test/';
delete process.env.EXPO_PUBLIC_USE_MOCK;

const R = await import('./riesgoMl.ts');
const { registrarGlucosaMedico } = await import('./glucosa.ts');
const { registrarTomaMedico } = await import('./registroTomaMedico.ts');

const CON_RIESGO = {
  riesgo_hipoglucemia: 0.1712,
  version_modelo: '1.1.0',
  motivo: null,
  supuestos: ['duracion_estimada', 'comorbilidades_no_capturadas', 'hba1c_no_disponible'],
  faltantes: [],
};

test('riesgo válido: probabilidad, versión y supuestos', () => {
  assert.deepEqual(R.leerRiesgoMl(CON_RIESGO), {
    riesgo: 0.1712,
    motivo: null,
    version: '1.1.0',
    supuestos: ['duracion_estimada', 'comorbilidades_no_capturadas', 'hba1c_no_disponible'],
    faltantes: [],
  });
});

test('los extremos 0 y 1 exactos son válidos', () => {
  assert.equal(R.leerRiesgoMl({ ...CON_RIESGO, riesgo_hipoglucemia: 0 })?.riesgo, 0);
  assert.equal(R.leerRiesgoMl({ ...CON_RIESGO, riesgo_hipoglucemia: 1 })?.riesgo, 1);
});

test('ausente, null o forma inválida → null (sin UI de riesgo)', () => {
  for (const x of [undefined, null, 'texto', 5, true, [], [CON_RIESGO]]) assert.equal(R.leerRiesgoMl(x), null, String(x));
});

test('riesgo fuera de [0, 1] o de tipo inválido → no_disponible', () => {
  const sinCalculo = { riesgo: null, motivo: 'no_disponible', version: null, supuestos: [], faltantes: [] };
  for (const malo of [-0.01, 1.01, 17.12, NaN, Infinity, -Infinity, '0.17', true, false, {}, []]) {
    assert.deepEqual(R.leerRiesgoMl({ ...CON_RIESGO, riesgo_hipoglucemia: malo }), sinCalculo, String(malo));
  }
});

test('motivos conocidos, con faltantes solo en datos_insuficientes', () => {
  for (const m of ['no_aplica_tipo', 'momento_no_cubierto', 'no_disponible']) {
    const r = R.leerRiesgoMl({ riesgo_hipoglucemia: null, version_modelo: null, motivo: m, supuestos: [], faltantes: ['imc'] });
    assert.deepEqual(r, { riesgo: null, motivo: m, version: null, supuestos: [], faltantes: [] }, m);
  }
  const d = R.leerRiesgoMl({ riesgo_hipoglucemia: null, motivo: 'datos_insuficientes', faltantes: ['imc', 'medicacion'] });
  assert.deepEqual(d?.faltantes, ['imc', 'medicacion']);
});

test('motivo desconocido o ausente: genérico y no_disponible', () => {
  assert.equal(R.leerRiesgoMl({ riesgo_hipoglucemia: null, motivo: 'otra_cosa' })?.motivo, 'desconocido');
  assert.equal(R.leerRiesgoMl({ riesgo_hipoglucemia: null, motivo: 42 })?.motivo, 'desconocido');
  assert.equal(R.leerRiesgoMl({ riesgo_hipoglucemia: null })?.motivo, 'no_disponible');
  assert.equal(R.leerRiesgoMl({})?.motivo, 'no_disponible');
  assert.equal(R.textoMotivo('desconocido'), 'No se pudo calcular la estimación');
});

test('faltantes ausente (backend anterior a ML-1b) → []; no string o repetidos se descartan', () => {
  assert.deepEqual(R.leerRiesgoMl({ riesgo_hipoglucemia: null, motivo: 'datos_insuficientes' })?.faltantes, []);
  assert.deepEqual(R.leerRiesgoMl({ riesgo_hipoglucemia: null, motivo: 'datos_insuficientes', faltantes: 'imc' })?.faltantes, []);
  const f = R.leerRiesgoMl({ riesgo_hipoglucemia: null, motivo: 'datos_insuficientes', faltantes: ['imc', 7, null, {}, 'IMC', 'imc', 'a b', '<b>', ''] });
  assert.deepEqual(f?.faltantes, ['imc']);
});

test('supuestos desconocidos o no string: se sanean y los desconocidos usan texto genérico', () => {
  const r = R.leerRiesgoMl({ ...CON_RIESGO, supuestos: ['hba1c_no_disponible', 'algo_nuevo', 3, null, ['x'], '<script>', 'x'.repeat(41)] });
  assert.deepEqual(r?.supuestos, ['hba1c_no_disponible', 'algo_nuevo']);
  assert.equal(R.textoSupuesto('algo_nuevo'), 'Otro supuesto del modelo');
  assert.equal(R.textoSupuesto('toString'), 'Otro supuesto del modelo');
  assert.equal(R.textoSupuesto('constructor'), 'Otro supuesto del modelo');
  assert.deepEqual(R.leerRiesgoMl({ ...CON_RIESGO, supuestos: 'duracion_estimada' })?.supuestos, []);
  assert.deepEqual(R.leerRiesgoMl({ ...CON_RIESGO, supuestos: undefined })?.supuestos, []);
});

test('máximo de elementos en supuestos y faltantes', () => {
  const muchos = Array.from({ length: 30 }, (_, i) => `codigo_${i}`);
  assert.equal(R.leerRiesgoMl({ ...CON_RIESGO, supuestos: muchos })?.supuestos.length, R.MAX_ELEMENTOS);
  assert.equal(R.leerRiesgoMl({ riesgo_hipoglucemia: null, motivo: 'datos_insuficientes', faltantes: muchos })?.faltantes.length, R.MAX_ELEMENTOS);
});

test('version_modelo: solo caracteres seguros y longitud acotada; si no, se omite', () => {
  const v = (x: unknown) => R.leerRiesgoMl({ ...CON_RIESGO, version_modelo: x })?.version;
  assert.equal(v('1.1.0'), '1.1.0');
  assert.equal(v(' 2.0.0-rc1+b3 '), '2.0.0-rc1+b3');
  for (const malo of ['<img src=x>', '1.0 0', 'v 1','1'.repeat(21), '', '   ', 7, null, undefined, {}, 'ñ1.0']) assert.equal(v(malo), null, String(malo));
});

test('campos desconocidos y prototipos se ignoran', () => {
  const r = R.leerRiesgoMl({ ...CON_RIESGO, extra: 'x', __proto__: { riesgo_hipoglucemia: 0.9 } });
  assert.equal(r?.riesgo, 0.1712);
  assert.ok(!('extra' in (r as object)));
});

test('un valor hostil nunca lanza (getters que fallan)', () => {
  const hostil = new Proxy({}, { get() { throw new Error('boom'); }, ownKeys() { throw new Error('boom'); } });
  assert.doesNotThrow(() => R.leerRiesgoMl(hostil));
  assert.equal(R.leerRiesgoMl(hostil), null);
  const campo = { get riesgo_hipoglucemia(): number { throw new Error('boom'); } };
  assert.equal(R.leerRiesgoMl(campo), null);
});

test('porcentaje: 1 decimal y coma decimal', () => {
  assert.equal(R.formatearPorcentaje(0.1712), '17,1 %');
  assert.equal(R.formatearPorcentaje(0), '0,0 %');
  assert.equal(R.formatearPorcentaje(1), '100,0 %');
  assert.equal(R.formatearPorcentaje(0.5), '50,0 %');
  assert.equal(R.formatearPorcentaje(0.0004), '0,0 %');
  assert.equal(R.formatearPorcentaje(0.0005), '0,1 %');
  assert.equal(R.formatearPorcentaje(0.9999), '100,0 %');
  assert.equal(R.formatearPorcentaje(0.1725), '17,3 %'); // medio punto hacia arriba, sin error binario
  assert.equal(R.formatearPorcentaje(0.285), '28,5 %');
  assert.equal(R.formatearPorcentaje(0.0304), '3,0 %');
  assert.ok(!R.formatearPorcentaje(0.1712).includes('.'));
});

test('textos de motivos, faltantes y supuestos', () => {
  assert.equal(R.textoMotivo('no_aplica_tipo'), 'No aplica: la estimación se calcula solo para pacientes con diabetes tipo 2');
  assert.equal(R.textoMotivo('datos_insuficientes'), 'Faltan datos del paciente para estimar el riesgo');
  assert.equal(R.textoMotivo('momento_no_cubierto'), 'La estimación solo cubre mediciones en ayunas o después de comer');
  assert.equal(R.textoMotivo('no_disponible'), 'La estimación no está disponible en este momento');
  assert.deepEqual(
    ['genero', 'edad', 'imc', 'medicacion', 'glucosa', 'paciente', 'nuevo'].map(R.textoFaltante),
    ['género', 'edad', 'IMC (peso o altura)', 'tratamiento', 'valor de glucosa', 'datos del paciente', 'otro dato'],
  );
  assert.equal(R.textoSupuesto('duracion_estimada'), 'Duración de la diabetes estimada, no registrada');
  assert.equal(R.textoSupuesto('comorbilidades_no_capturadas'), 'Sin comorbilidades capturadas');
  assert.equal(R.textoSupuesto('hba1c_no_disponible'), 'Sin HbA1c');
});

test('lista legible de faltantes: uno, varios, vacío y repetidos', () => {
  assert.equal(R.listaFaltantes([]), '');
  assert.equal(R.listaFaltantes(['imc']), 'IMC (peso o altura)');
  assert.equal(R.listaFaltantes(['genero', 'edad']), 'género y edad');
  assert.equal(R.listaFaltantes(['genero', 'edad', 'imc']), 'género, edad y IMC (peso o altura)');
  assert.equal(R.listaFaltantes(['x1', 'x2']), 'otro dato'); // dos desconocidos no repiten el texto genérico
  const base = (f: string[]) => R.mensajeMotivo({ riesgo: null, motivo: 'datos_insuficientes', version: null, supuestos: [], faltantes: f });
  assert.equal(base([]), 'Faltan datos del paciente para estimar el riesgo');
  assert.equal(base(['imc', 'medicacion']), 'Faltan datos del paciente para estimar el riesgo: IMC (peso o altura) y tratamiento');
});

test('la leyenda es fija, no usa «demo» y ningún texto del módulo menciona categorías', () => {
  assert.equal(R.LEYENDA_RIESGO, 'Modelo experimental, no validado clínicamente. Es solo orientativo y no sustituye el criterio del médico.');
  const todo = [R.LEYENDA_RIESGO, R.TITULO_RIESGO, ...['no_aplica_tipo', 'datos_insuficientes', 'momento_no_cubierto', 'no_disponible', 'desconocido'].map((m) => R.textoMotivo(m as never))].join(' ');
  assert.ok(!/demo/i.test(todo));
  assert.ok(!/\b(bajo|medio|alto)\b/i.test(todo));
  assert.equal(R.TITULO_RIESGO, 'Estimación de riesgo de hipoglucemia (experimental)');
});

// ---- Integración con el registro: riesgo_ml nunca hace fallar la lectura ----
const original = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = original; });
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const toma = { id_paciente: 5, id_medico: 3, id_momento: 1, nivel_glucosa: 110, fecha: '2026-10-26', hora: '08:05:09' };

test('registrarGlucosaMedico: lee riesgo_ml; sin la clave (ML apagado) es null', async () => {
  globalThis.fetch = (async () => json({ registro_glucosa: { id_registro: 7 }, riesgo_ml: CON_RIESGO })) as unknown as typeof fetch;
  const a = await registrarGlucosaMedico(toma);
  assert.equal(a.id_registro, 7);
  assert.equal(a.riesgoMl?.riesgo, 0.1712);
  globalThis.fetch = (async () => json({ registro_glucosa: { id_registro: 8 } })) as unknown as typeof fetch;
  assert.deepEqual(await registrarGlucosaMedico(toma), { id_registro: 8, riesgoMl: null });
});

test('registrarGlucosaMedico: riesgo_ml basura no rompe el registro', async () => {
  for (const basura of ['x', 12, [], [1, 2], { riesgo_hipoglucemia: 'mucho' }, { riesgo_hipoglucemia: 9, supuestos: 1, faltantes: {} }]) {
    globalThis.fetch = (async () => json({ registro_glucosa: { id_registro: 9 }, riesgo_ml: basura })) as unknown as typeof fetch;
    const r = await registrarGlucosaMedico(toma);
    assert.equal(r.id_registro, 9);
  }
});

test('registrarTomaMedico: adjunta riesgoMl solo si existe y no cambia la alerta (decide la clasificación)', async () => {
  const paciente = { id_paciente: 5, id_medico: 9, edad: 45, embarazo: false, enfermedades: ['Diabetes Tipo 2'] };
  const ahora = new Date(2026, 9, 26, 8, 5, 9);
  let alertas = 0;
  const con = (valor: unknown) => (async (url: string) => {
    if (String(url).endsWith('/registrarAlerta')) { alertas += 1; return json({}); }
    return json({ registro_glucosa: { id_registro: 70 }, ...(valor === undefined ? {} : { riesgo_ml: valor }) });
  }) as unknown as typeof fetch;

  // NORMAL (110 en ayunas) con un riesgo alto: no se crea alerta
  globalThis.fetch = con({ ...CON_RIESGO, riesgo_hipoglucemia: 0.99 });
  const normal = await registrarTomaMedico({ datos: paciente, idMedico: 3, idMomento: 1, valor: 110, ahora });
  assert.equal(normal.alerta, 'no_aplica');
  assert.equal(normal.riesgoMl?.riesgo, 0.99);
  assert.equal(alertas, 0);

  // Hipoglucemia (60) con riesgo bajo: se crea la alerta igual
  globalThis.fetch = con({ ...CON_RIESGO, riesgo_hipoglucemia: 0.01 });
  const baja = await registrarTomaMedico({ datos: paciente, idMedico: 3, idMomento: 1, valor: 60, ahora });
  assert.equal(baja.alerta, 'enviada');
  assert.equal(alertas, 1);

  // Sin riesgo_ml: el resultado no trae la clave (forma anterior intacta)
  globalThis.fetch = con(undefined);
  assert.deepEqual(await registrarTomaMedico({ datos: paciente, idMedico: 3, idMomento: 1, valor: 110, ahora }), { estado: 'NORMAL', idRegistro: 70, alerta: 'no_aplica' });
});

test('si la alerta falla, el riesgo viaja igual y la alerta fallida sigue informada', async () => {
  const paciente = { id_paciente: 5, id_medico: 9, edad: 45, embarazo: false, enfermedades: ['Diabetes Tipo 2'] };
  globalThis.fetch = (async (url: string) =>
    String(url).endsWith('/registrarAlerta')
      ? json({ error: 'x' }, 500)
      : json({ registro_glucosa: { id_registro: 70 }, riesgo_ml: CON_RIESGO })) as unknown as typeof fetch;
  const r = await registrarTomaMedico({ datos: paciente, idMedico: 3, idMomento: 1, valor: 60, ahora: new Date(2026, 9, 26, 8, 5, 9) });
  assert.equal(r.alerta, 'fallida');
  assert.equal(r.riesgoMl?.riesgo, 0.1712);
});
