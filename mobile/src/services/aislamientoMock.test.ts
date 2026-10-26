// Con EXPO_PUBLIC_USE_MOCK apagado no se importa ni se usa ningún dato simulado (TASK-057).
// Comprobación estática del código fuente: ningún módulo de la app importa mockData.ts salvo App.tsx, y App.tsx solo
// lo requiere dentro de la rama USE_MOCK (el módulo no se evalúa con el modo apagado).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..', '..');

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : [p];
  });
}

const fuentes = archivos(join(RAIZ, 'src')).filter((p) => /\.(ts|tsx)$/.test(p) && !/\.test\.ts$/.test(p));

test('ningún módulo de src importa mockData salvo el propio mockData', () => {
  const infractores = fuentes.filter((p) => !p.endsWith('mockData.ts') && /mockData/.test(readFileSync(p, 'utf8')));
  assert.deepEqual(infractores, []);
});

test('App.tsx carga mockData solo con require dentro de la rama USE_MOCK', () => {
  const app = readFileSync(join(RAIZ, 'App.tsx'), 'utf8');
  assert.ok(!/import[^;]*from\s+['"]\.\/src\/utils\/mockData['"]/.test(app), 'App.tsx no debe importar mockData de forma estática');
  const linea = app.split('\n').find((l) => l.includes("require('./src/utils/mockData')"));
  assert.ok(linea && linea.includes('USE_MOCK'), 'el require debe estar en la rama USE_MOCK');
});

test('mockData.ts ya no exporta listas simuladas sin uso', () => {
  const m = readFileSync(join(RAIZ, 'src', 'utils', 'mockData.ts'), 'utf8');
  assert.ok(!/export const MOCK_/.test(m));
});
