// Estructura de los recorridos E2E de Maestro (ADR-0012 y ADR-0013): la suite C (escrituras reales) no se mezcla con A ni B.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('../../.maestro/', import.meta.url);
const ruta = (...p: string[]) => join(decodeURIComponent(RAIZ.pathname).replace(/^\/([A-Za-z]:)/, '$1'), ...p);
const yamls = (carpeta: string) => readdirSync(ruta('flows', carpeta)).filter((f) => f.endsWith('.yaml'));
const etiquetas = (texto: string) => [...(texto.split('\n---')[0].match(/^tags:\n((?:\s+- .+\n?)+)/m)?.[1] ?? '').matchAll(/- (\S+)/g)].map((m) => m[1]);
const leer = (...p: string[]) => readFileSync(ruta(...p), 'utf8');

test('la suite C existe, tiene como máximo 4 flujos y todos llevan la etiqueta escritura-real', () => {
  const flujos = yamls('real-escritura');
  assert.ok(flujos.length >= 1 && flujos.length <= 4, `${flujos.length} flujos`);
  for (const f of flujos) assert.ok(etiquetas(leer('flows', 'real-escritura', f)).includes('escritura-real'), f);
});

test('solo C4 llama al chatbot real y lleva la etiqueta que el script omite por defecto (chat-gemini)', () => {
  const conChat = yamls('real-escritura').filter((f) => etiquetas(leer('flows', 'real-escritura', f)).includes('chat-gemini'));
  assert.deepEqual(conChat.map((f) => f.slice(0, 2)), ['C4']);
  const consultas = yamls('real-escritura').filter((f) => /preguntar-chatbot|chat-enviar/.test(leer('flows', 'real-escritura', f)));
  assert.deepEqual(consultas, conChat); // ningún otro flujo de la suite C gasta cuota de Gemini
});

test('las suites A y B no incluyen flujos con escritura real ni sus etiquetas', () => {
  for (const carpeta of ['simulado', 'real']) {
    for (const f of yamls(carpeta)) {
      const t = leer('flows', carpeta, f);
      assert.ok(!etiquetas(t).some((e) => e === 'escritura-real' || e === 'chat-gemini'), `${carpeta}/${f}`);
      assert.ok(!/E2E_PACIENTE_ID|abrir-paciente-de-prueba/.test(t), `${carpeta}/${f}`);
    }
  }
  assert.deepEqual(yamls('real-escritura').filter((f) => yamls('simulado').includes(f) || yamls('real').includes(f)), []);
});

test('ejecutar-suite.ps1: cada suite corre solo su carpeta y la C exige -ConfirmoEscrituras', () => {
  const s = readFileSync(ruta('scripts', 'ejecutar-suite.ps1'), 'utf8');
  assert.match(s, /'A' \{ 'simulado' \} 'B' \{ 'real' \} 'C' \{ 'real-escritura' \}/);
  assert.match(s, /\$Suite -eq 'C' -and -not \$ConfirmoEscrituras/);
  assert.match(s, /chat-gemini/);
  assert.match(s, /E2E_CHAT_ACTIVO/);
  // La defensa de solo lectura de la suite B sigue mirando solo flows\real (no la carpeta de escrituras)
  assert.ok(!/flows\real-escritura/.test(s.split("if ($Suite -eq 'B')")[1]?.split('elseif')[0] ?? ''));
});

test('los flujos E2E no llevan correos, IPs ni credenciales reales (las cuentas llegan por -e)', () => {
  for (const f of yamls('real-escritura')) {
    const t = leer('flows', 'real-escritura', f);
    assert.ok(!/[\w.]+@[\w.]+/.test(t.replace(/\$\{[A-Z_]+\}/g, '')), `${f}: correo`);
    assert.ok(!/\b\d{1,3}(\.\d{1,3}){3}\b/.test(t), `${f}: IP`);
  }
  assert.ok(existsSync(ruta('env.e2e.ejemplo')));
  const ejemplo = leer('env.e2e.ejemplo');
  for (const linea of ejemplo.split('\n').filter((l) => /^[A-Z0-9_]+=/.test(l))) assert.match(linea, /=$/, 'el ejemplo no lleva valores');
});

test('la suite C no depende de la posición de nadie en la lista: el paciente se busca por texto y C4 no escribe', () => {
  const archivos = [...yamls('real-escritura').map((f) => ['flows/real-escritura/' + f, leer('flows', 'real-escritura', f)] as const), ['subflows/abrir-paciente-de-prueba.yaml', leer('subflows', 'abrir-paciente-de-prueba.yaml')] as const];
  for (const [nombre, t] of archivos) assert.ok(!/medico-paciente-/.test(t.replace(/^#.*$/gm, '')), `${nombre}: usa el id de la tarjeta`);
  const abrir = leer('subflows', 'abrir-paciente-de-prueba.yaml');
  assert.match(abrir, /scrollUntilVisible:\s+element:\s+text:/);
  assert.match(abrir, /direction: DOWN/);
  assert.match(abrir, /tapOn:\s+text:/);
  assert.match(abrir, /detalle-cabecera/);
  const c4 = leer('flows', 'real-escritura', yamls('real-escritura').find((f) => f.startsWith('C4'))!);
  assert.ok(!/inputText/.test(c4) && !/preguntar-chatbot\.yaml/.test(c4), 'C4 no debe usar el teclado');
  assert.match(leer('subflows', 'preguntar-chatbot-sugerencia.yaml'), /chat-sugerencia-1/);
});
