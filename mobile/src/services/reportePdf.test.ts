// Reporte PDF (TASK-056): resumen y HTML puros, sin red.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from './reportePdf.ts';
import * as V from './medicoVista.ts';
import * as U from './umbrales.ts';

const hoy = new Date(2026, 9, 26, 15, 30); // 26-oct-2026
const reg = (id: number, fecha: string, hora: string | null, v: number | null, alerta: string | null = null, momento: string | null = 'AYUNAS') => ({
  id,
  fecha,
  hora,
  nivelGlucosa: v,
  momentoDia: momento,
  observaciones: 'texto libre que no debe salir',
  tipo_alerta: alerta,
});
const paciente = { nombre: 'Ana Pérez', edad: 47, condicion: 'Diabetes Tipo 2' };

const datos = [
  reg(1, '2026-10-26', '08:00', 100),
  reg(2, '2026-10-25', '23:00', 60, 'hipoglucemia', 'ANTES DE DORMIR'),
  reg(3, '2026-10-24', '13:30', 200, 'hiperglucemia', 'DESPUES DE COMER'),
  reg(4, '2026-10-20', '09:00', 180), // límite superior: dentro del rango
  reg(5, '2026-10-26', '12:00', null), // sin valor: se ignora
  reg(6, '2026-09-20', '09:00', 300), // fuera del periodo de 7 días y de 30
];

test('resumen: promedio, mínimo, máximo, % en rango (constante central) y número de lecturas', () => {
  const r = R.resumenGlucosa(datos, hoy, 7);
  assert.ok(r);
  assert.deepEqual(r, { total: 4, promedio: 135, minimo: 60, maximo: 200, pctEnRango: 50, hipo: 1, hiper: 1 });
  // coincide con las métricas que muestra la pantalla del reporte
  const m = V.metricasReporte(datos, hoy, 7);
  assert.equal(r.pctEnRango, m.tir);
  assert.equal(r.promedio, m.promedio);
  assert.equal(r.hipo, m.hipo);
  assert.equal(r.hiper, m.hiper);
});

test('resumen: límites 69/70 y 180/181 usan la constante central', () => {
  const v = (x: number, i: number) => reg(i, '2026-10-26', '08:00', x);
  const r = R.resumenGlucosa([v(69, 1), v(70, 2), v(180, 3), v(181, 4)], hoy, 7);
  assert.equal(r?.pctEnRango, 50);
  assert.equal(r?.hipo, 1);
  assert.equal(r?.hiper, 1);
  assert.equal(U.RANGO_META_MAX, 180);
});

test('sin lecturas en el periodo: no hay resumen ni HTML (no se genera un PDF vacío)', () => {
  assert.equal(R.resumenGlucosa([], hoy, 30), null);
  assert.equal(R.resumenGlucosa([reg(1, '2026-10-26', '08:00', null)], hoy, 30), null);
  assert.equal(R.construirHtmlReporte({ paciente, registros: [reg(6, '2026-09-20', '09:00', 300)], dias: 7, hoy }), null);
});

test('lecturas del periodo en orden cronológico', () => {
  const ids = R.lecturasDelPeriodo(datos, hoy, 7).map((r) => r.id);
  assert.deepEqual(ids, [4, 3, 2, 1]);
});

test('HTML: contenido requerido (paciente, periodo, resumen, tabla, alertas, fecha de generación y leyenda)', () => {
  const html = R.construirHtmlReporte({ paciente, registros: datos, dias: 7, hoy }) as string;
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  for (const texto of [
    'Ana Pérez',
    '47 años',
    'Diabetes Tipo 2',
    'Últimos 7 días (20/10/2026 al 26/10/2026)',
    'Generado el 26/10/2026 15:30',
    '135 mg/dL',
    '60 mg/dL',
    '200 mg/dL',
    'En rango (70-180 mg/dL)',
    '50 %',
    'Después de comer',
    'Antes de dormir',
    'hipoglucemia',
    'hiperglucemia',
    R.LEYENDA_INFORMATIVA,
  ]) {
    assert.ok(html.includes(texto), `falta: ${texto}`);
  }
});

test('HTML: no incluye teléfono, correo, documento ni observaciones libres', () => {
  const html = R.construirHtmlReporte({ paciente, registros: datos, dias: 30, hoy }) as string;
  assert.ok(!html.includes('texto libre que no debe salir'));
  const cuerpo = html.replace(/<style>[\s\S]*<\/style>/, ''); // el CSS usa @page
  assert.ok(!/@/.test(cuerpo));
  assert.ok(!/tel[eé]fono|correo|C\.I\./i.test(cuerpo));
});

test('HTML: escapa texto del servidor (nombre, momento y alerta)', () => {
  const malo = { nombre: '<script>alert(1)</script> & "x"', edad: null, condicion: "O'Neil <b>" };
  const html = R.construirHtmlReporte({
    paciente: malo,
    registros: [reg(1, '2026-10-26', '08:00', 100, '<img src=x onerror=1>', '<i>raro</i>')],
    dias: 7,
    hoy,
  }) as string;
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;'));
  assert.ok(html.includes('No registrada')); // edad nula
  assert.equal(R.escaparHtml(null), '');
});

test('HTML: sin alertas en el periodo lo dice', () => {
  const html = R.construirHtmlReporte({ paciente, registros: [reg(1, '2026-10-26', '08:00', 100)], dias: 7, hoy }) as string;
  assert.ok(html.includes('Sin alertas registradas en el periodo.'));
});

test('fechaDdMmAaaa', () => {
  assert.equal(R.fechaDdMmAaaa('2026-10-05'), '05/10/2026');
  assert.equal(R.fechaDdMmAaaa('ayer'), 'ayer');
});
