// Efecto de escritura del chatbot (TASK-061), testID normalizados (TASK-064) y recomendación post comida (TASK-065).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from './revelado.ts';
import { normalizarTestId } from '../utils/testId.ts';
import { esMomentoPostComida, momentoDeId } from './clasificacionGlucosa.ts';
import { anchoBurbuja, ANCHO_MAXIMO_CONTENIDO } from '../utils/medidas.ts';

const sinSurrogadoSuelto = (s: string) => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

test('trocear: unir los fragmentos devuelve el texto exacto (palabras, espacios y saltos de línea)', () => {
  const t = 'Hola  mundo,\n\nsegundo párrafo con\tTAB y salto.\n';
  const partes = R.trocear(t);
  assert.equal(partes.join(''), t);
  assert.ok(partes.includes('Hola') && partes.includes('mundo,'));
  assert.ok(partes.some((p) => p === '\n\n')); // el salto de línea doble es un fragmento propio
});

test('trocear: texto vacío no da fragmentos', () => {
  assert.deepEqual(R.trocear(''), []);
});

test('trocear: acentos y eñes quedan enteros, también descompuestos (e + acento combinado)', () => {
  const t = 'canción niño máséxito';
  assert.equal(R.trocear(t).join(''), t);
  const larga = 'a'.repeat(23) + 'é' + 'b'.repeat(30); // el acento combinado cae en el límite del trozo
  for (const p of R.trocear(larga)) assert.ok(!/^[̀-ͯ]/.test(p), 'un trozo no puede empezar con un acento suelto');
});

test('trocear: emojis (con pareja sustituta, tono de piel y unidos con ZWJ) no se parten', () => {
  const familia = '👨‍👩‍👧‍👦'; // 4 emojis unidos
  const manos = '👍🏽';
  const t = 'ok ' + familia.repeat(8) + ' ' + manos.repeat(30) + ' fin';
  const partes = R.trocear(t);
  assert.equal(partes.join(''), t);
  for (const p of partes) assert.ok(sinSurrogadoSuelto(p), 'sin mitades de caracteres');
  // ningún trozo empieza con unidor, tono de piel ni selector de variación
  for (const p of partes) assert.ok(!/^[‍️︎]/.test(p) && !/^\p{Emoji_Modifier}/u.test(p));
  // ni termina con un unidor colgando
  for (const p of partes) assert.ok(!p.endsWith('‍'));
});

test('planRevelado: la última parte es el texto íntegro y cada parte es prefijo de la siguiente', () => {
  const t = 'Primera frase con acentos: canción. Segunda frase.\n\nTercera 👍🏽 línea.';
  const plan = R.planRevelado(t);
  assert.equal(plan.partes.at(-1), t);
  for (let i = 1; i < plan.partes.length; i += 1) assert.ok(plan.partes[i].startsWith(plan.partes[i - 1]));
  for (const p of plan.partes) assert.ok(sinSurrogadoSuelto(p));
  assert.equal(plan.intervaloMs, R.MS_POR_PASO);
});

test('planRevelado: tope de duración de 4 s aunque el texto sea largo (se agrupan fragmentos)', () => {
  const largo = Array.from({ length: 5000 }, (_, i) => `palabra${i}`).join(' ');
  const plan = R.planRevelado(largo);
  assert.ok(plan.duracionMs <= R.DURACION_MAXIMA_MS, `duración ${plan.duracionMs}`);
  assert.equal(plan.duracionMs, plan.partes.length * plan.intervaloMs);
  assert.equal(plan.partes.at(-1), largo);
  // texto corto: un paso por fragmento, muy por debajo del tope
  const corto = R.planRevelado('uno dos tres');
  assert.equal(corto.partes.length, 5); // 3 palabras + 2 espacios
  assert.ok(corto.duracionMs < R.DURACION_MAXIMA_MS);
});

test('planRevelado: tope configurable y ritmo configurable', () => {
  const t = Array.from({ length: 400 }, () => 'a').join(' ');
  const plan = R.planRevelado(t, { maxMs: 1000, msPorPaso: 50 });
  assert.ok(plan.duracionMs <= 1000);
  assert.equal(plan.intervaloMs, 50);
});

test('planRevelado: modo inmediato = una sola parte con el texto completo y sin esperas', () => {
  const plan = R.planRevelado('Respuesta completa de golpe', { modo: 'inmediato' });
  assert.deepEqual(plan.partes, ['Respuesta completa de golpe']);
  assert.equal(plan.duracionMs, 0);
  assert.equal(plan.intervaloMs, 0);
});

test('planRevelado: texto vacío no tiene pasos', () => {
  for (const modo of ['escritura', 'inmediato'] as const) {
    const plan = R.planRevelado('', { modo });
    assert.deepEqual(plan.partes, []);
    assert.equal(plan.duracionMs, 0);
  }
  assert.equal(R.textoEnPaso(R.planRevelado(''), 3), '');
});

test('textoEnPaso: 0 = nada, más allá del final = texto íntegro', () => {
  const plan = R.planRevelado('uno dos');
  assert.equal(R.textoEnPaso(plan, 0), '');
  assert.equal(R.textoEnPaso(plan, 1), 'uno');
  assert.equal(R.textoEnPaso(plan, 999), 'uno dos');
});

test('modos: normalizarModo y reducir movimiento fuerza inmediato', () => {
  assert.equal(R.normalizarModo('inmediato'), 'inmediato');
  assert.equal(R.normalizarModo(' INMEDIATO '), 'inmediato');
  assert.equal(R.normalizarModo('escritura'), 'escritura');
  assert.equal(R.normalizarModo(undefined), 'escritura');
  assert.equal(R.normalizarModo('otra cosa'), 'escritura');
  assert.equal(R.modoEfectivo('escritura', true), 'inmediato');
  assert.equal(R.modoEfectivo('escritura', false), 'escritura');
  assert.equal(R.modoEfectivo('inmediato', false), 'inmediato');
});

test('separarAviso: aparta el aviso médico final y no inventa uno si falta', () => {
  const aviso = 'Consulta siempre a tu médico tratante para cambios en tu medicación.';
  const r = R.separarAviso(`Mantén un registro constante.\n\nOtra idea.\n\n${aviso}\n`);
  assert.equal(r.aviso, aviso);
  assert.equal(r.cuerpo, 'Mantén un registro constante.\n\nOtra idea.');
  // sin aviso
  assert.deepEqual(R.separarAviso('Solo una respuesta corta.'), { cuerpo: 'Solo una respuesta corta.', aviso: null });
  assert.equal(R.separarAviso('Párrafo uno.\n\nPárrafo dos sin aviso.').aviso, null);
  // el aviso en medio del texto no se separa (solo el último párrafo)
  assert.equal(R.separarAviso(`${aviso}\n\nY después más texto.`).aviso, null);
  // el aviso debe seguir completo, sin recortes
  assert.equal(R.separarAviso(`Hola.\n\n${aviso}`).aviso?.length, aviso.length);
});

test('normalizarTestId: sin acentos, minúsculas y solo [a-z0-9-]', () => {
  assert.equal(normalizarTestId('Médico-1'), 'medico-1');
  assert.equal(normalizarTestId('Paciente-12'), 'paciente-12');
  assert.equal(normalizarTestId('Administrador-3'), 'administrador-3');
  assert.equal(normalizarTestId('Pestaña Ñandú / 2'), 'pestana-nandu-2');
  assert.equal(normalizarTestId('  --a__b--  '), 'a-b');
  assert.equal(normalizarTestId(''), '');
  for (const s of ['Médico-1', 'ÁÉÍÓÚ ü ñ 9', 'x y']) assert.match(normalizarTestId(s), /^[a-z0-9-]*$/);
});

test('recomendación de 2 horas: solo con el momento posterior a una comida del catálogo', () => {
  assert.equal(esMomentoPostComida(momentoDeId(2)), true); // id 2 = después de comer
  assert.equal(esMomentoPostComida(momentoDeId(1)), false); // ayunas
  assert.equal(esMomentoPostComida(momentoDeId(3)), false); // antes de dormir
  assert.equal(esMomentoPostComida(undefined), false); // sin selección
  assert.equal(esMomentoPostComida(null), false);
});

test('anchoBurbuja: 85 % del contenido, con tope de 480 dp', () => {
  assert.equal(anchoBurbuja(360), 306);
  assert.equal(anchoBurbuja(412), 350);
  assert.equal(anchoBurbuja(1024), 480); // tablet: contenido de 600 -> 510 -> tope 480
  assert.ok(ANCHO_MAXIMO_CONTENIDO * 0.85 > 480);
  assert.equal(anchoBurbuja(NaN), 480);
});
