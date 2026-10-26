// Robustez (TASK-059): guarda contra doble envío, aviso de registro parcial, 404 de perfil y contraste del texto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tomarTurno, liberarTurno, conTurno } from '../utils/turno.ts';
import { ErrorApi, MENSAJES, esRecursoInexistente } from './http.ts';
import { AVISO_REGISTRO_PARCIAL, mensajeFalloRegistro, pudoQuedarParcial } from './registroAviso.ts';
import { COLORS } from '../utils/colors.ts';

test('turno: el segundo toque seguido se descarta y se puede reintentar al terminar', () => {
  const t = { current: false };
  assert.equal(tomarTurno(t), true);
  assert.equal(tomarTurno(t), false); // doble toque
  liberarTurno(t);
  assert.equal(tomarTurno(t), true);
});

test('conTurno: dos llamadas simultáneas ejecutan el envío UNA sola vez; libera aunque falle', async () => {
  const t = { current: false };
  let envios = 0;
  const envio = async () => {
    envios += 1;
    await new Promise((r) => setTimeout(r, 10));
    return 'ok';
  };
  const [a, b] = await Promise.all([conTurno(t, envio), conTurno(t, envio)]);
  assert.equal(envios, 1);
  assert.deepEqual([a, b], ['ok', undefined]);
  await assert.rejects(conTurno(t, async () => { throw new Error('falla'); }), /falla/);
  assert.equal(t.current, false); // el turno se libera: se puede reintentar
  assert.equal(await conTurno(t, async () => 'otra vez'), 'otra vez');
});

test('registro parcial: el aviso solo se añade a fallos de red, tiempo, 5xx o respuesta ilegible', () => {
  assert.equal(pudoQuedarParcial(new ErrorApi('red', MENSAJES.red)), true);
  assert.equal(pudoQuedarParcial(new ErrorApi('timeout', MENSAJES.timeout)), true);
  assert.equal(pudoQuedarParcial(new ErrorApi('http', MENSAJES.servidor, 500)), true);
  assert.equal(pudoQuedarParcial(new ErrorApi('respuesta', MENSAJES.respuesta, 200)), true);
  assert.equal(pudoQuedarParcial(new ErrorApi('http', 'Faltan datos', 400)), false);
  assert.equal(pudoQuedarParcial(new ErrorApi('http', MENSAJES.invalido, 422)), false);
  assert.equal(pudoQuedarParcial(new Error('otro')), false);
});

test('mensajeFalloRegistro: conserva el mensaje base y añade el aviso sin filtrar datos', () => {
  const m5 = mensajeFalloRegistro(new ErrorApi('http', MENSAJES.servidor, 500));
  assert.ok(m5.startsWith(MENSAJES.servidor));
  assert.ok(m5.includes(AVISO_REGISTRO_PARCIAL));
  assert.ok(m5.includes('otro correo'));
  assert.equal(mensajeFalloRegistro(new ErrorApi('http', 'Faltan datos', 400)), 'Faltan datos');
  assert.equal(mensajeFalloRegistro(new Error('detalle técnico')), MENSAJES.generico);
});

test('esRecursoInexistente: solo el 404 de un recurso, no la ruta mal configurada ni otros errores', () => {
  assert.equal(esRecursoInexistente(new ErrorApi('http', 'No existe', 404)), true);
  assert.equal(esRecursoInexistente(new ErrorApi('ruta', MENSAJES.ruta, 404)), false);
  assert.equal(esRecursoInexistente(new ErrorApi('red', MENSAJES.red)), false);
  assert.equal(esRecursoInexistente(new ErrorApi('http', MENSAJES.servidor, 500)), false);
  assert.equal(esRecursoInexistente(null), false);
});

// Contraste WCAG 2.x
function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test('contraste del texto (AA, 4,5:1) en las combinaciones de la app', () => {
  const casos: Array<[string, string, string]> = [
    ['textPrimary sobre blanco', COLORS.textPrimary, COLORS.backgroundWhite],
    ['textSecondary sobre blanco', COLORS.textSecondary, COLORS.backgroundWhite],
    ['textMuted sobre blanco', COLORS.textMuted, COLORS.backgroundWhite],
    ['textMuted sobre el fondo de los campos', COLORS.textMuted, COLORS.surfaceInput],
    ['textMuted sobre el fondo de la pantalla', COLORS.textMuted, COLORS.background],
    ['primary sobre blanco', COLORS.primary, COLORS.backgroundWhite],
    ['blanco sobre primary (botón)', COLORS.textWhite, COLORS.primary],
    ['estado normal', COLORS.normalText, COLORS.normalBg],
    ['estado hipoglucemia', COLORS.riesgoHipoText, COLORS.riesgoHipoBg],
    ['estado hiperglucemia', COLORS.riesgoHiperText, COLORS.riesgoHiperBg],
    ['error sobre blanco', COLORS.riesgoHiperText, COLORS.backgroundWhite],
    ['normalText sobre blanco', COLORS.normalText, COLORS.backgroundWhite],
    ['riesgoHipoText sobre blanco', COLORS.riesgoHipoText, COLORS.backgroundWhite],
  ];
  for (const [nombre, texto, fondo] of casos) {
    assert.ok(contraste(texto, fondo) >= 4.5, `${nombre}: ${contraste(texto, fondo).toFixed(2)}:1`);
  }
});
