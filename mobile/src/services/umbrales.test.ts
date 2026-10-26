// Umbrales clínicos centralizados (TASK-055) y medidas/escalado (TASK-058). Funciones puras.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as U from './umbrales.ts';
import * as H from './historial.ts';
import * as V from './medicoVista.ts';
import * as M from '../utils/medidas.ts';

test('umbrales: rango meta oficial 70-180, hipoglucemia < 70, captura 20-600, 3 tomas diarias', () => {
  assert.equal(U.RANGO_META_MIN, 70);
  assert.equal(U.RANGO_META_MAX, 180);
  assert.equal(U.GLUCOSA_HIPO_MAX, 70);
  assert.equal(U.GLUCOSA_CAPTURA_MIN, 20);
  assert.equal(U.GLUCOSA_CAPTURA_MAX, 600);
  assert.equal(U.LECTURAS_DIARIAS_ESPERADAS, 3);
  assert.equal(U.TIR_OBJETIVO_PORCENTAJE, 70);
  assert.equal(U.textoRangoMeta(), '70-180');
  assert.equal(U.textoRangoMeta(' - '), '70 - 180');
});

test('enRangoMeta: límites incluidos (69 fuera, 70 y 180 dentro, 181 fuera)', () => {
  assert.deepEqual([69, 70, 100, 180, 181].map(U.enRangoMeta), [false, true, true, true, false]);
});

test('porcentajeEnRangoMeta: redondea y devuelve null sin lecturas', () => {
  assert.equal(U.porcentajeEnRangoMeta([]), null);
  assert.equal(U.porcentajeEnRangoMeta([100, 150, 200]), 67);
  assert.equal(U.porcentajeEnRangoMeta([60]), 0);
});

test('una sola fuente: historial, reporte del médico y umbrales coinciden en el mismo caso', () => {
  const regs = [
    { id: 1, fecha: '2026-10-26', hora: '08:00', nivelGlucosa: 160, momentoDia: 'AYUNAS', observaciones: null, tipo_alerta: null },
    { id: 2, fecha: '2026-10-26', hora: '12:00', nivelGlucosa: 200, momentoDia: 'AYUNAS', observaciones: null, tipo_alerta: null },
  ];
  assert.equal(H.porcentajeEnRango(regs), 50); // 160 dentro del rango meta y 200 fuera
  assert.equal(V.metricasReporte(regs, new Date(2026, 9, 26), 7).tir, 50);
  assert.equal(V.REPORTE_MIN, U.RANGO_META_MIN);
  assert.equal(V.REPORTE_MAX, U.RANGO_META_MAX);
});

test('factorEscala: 1 en 360 dp, acotado entre 0,9 y 1,15; entradas inválidas dan 1', () => {
  assert.equal(M.factorEscala(360), 1);
  assert.equal(M.factorEscala(320), 0.9); // 0,889 -> mínimo
  assert.ok(Math.abs(M.factorEscala(412) - 412 / 360) < 1e-9); // 1,144: dentro del intervalo, sin acotar
  assert.ok(M.factorEscala(412) <= M.FACTOR_MAX);
  assert.equal(M.factorEscala(900), M.FACTOR_MAX);
  assert.equal(M.factorEscala(100), M.FACTOR_MIN);
  for (const x of [0, -5, NaN, Infinity]) assert.equal(M.factorEscala(x), 1);
});

test('escalar: aplica el factor y respeta el tope', () => {
  assert.equal(M.escalar(10, 360), 10);
  assert.equal(M.escalar(10, 900), 11.5);
  assert.equal(M.escalar(10, 900, 1), 10); // tope 1: no crece
});

test('anchoContenido: nunca pasa del máximo; ancho inválido usa el máximo', () => {
  assert.equal(M.anchoContenido(360), 360);
  assert.equal(M.anchoContenido(1024), M.ANCHO_MAXIMO_CONTENIDO);
  assert.equal(M.anchoContenido(NaN), M.ANCHO_MAXIMO_CONTENIDO);
});

test('posicionY: mínimo abajo, máximo arriba, valores fuera del dominio se acotan', () => {
  const d = M.DOMINIO_GRAFICO_GLUCOSA;
  assert.equal(M.posicionY(d.min, d, 10, 130), 130);
  assert.equal(M.posicionY(d.max, d, 10, 130), 10);
  assert.equal(M.posicionY(0, d, 10, 130), 130);
  assert.equal(M.posicionY(999, d, 10, 130), 10);
  // el rango meta cae dentro del área del gráfico y 180 queda más arriba que 70
  const y70 = M.posicionY(U.RANGO_META_MIN, d, 10, 130);
  const y180 = M.posicionY(U.RANGO_META_MAX, d, 10, 130);
  assert.ok(y180 < y70 && y180 > 10 && y70 < 130);
});

test('tamaños de fuente: cuerpo 14-16, títulos 20-24 y cifras destacadas de 40 como máximo', () => {
  assert.ok(M.FUENTE.cuerpo >= 14 && M.FUENTE.cuerpoGrande <= 16);
  assert.ok(M.FUENTE.titulo >= 20 && M.FUENTE.tituloGrande <= 24);
  assert.ok(M.FUENTE.cifraGrande <= 40);
  assert.ok(M.ALTURA.boton >= M.ALTURA.tactilMin);
});
