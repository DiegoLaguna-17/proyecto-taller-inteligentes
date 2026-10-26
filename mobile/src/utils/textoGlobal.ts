// Límite de escala de fuente para TODOS los textos (design.md § Fase Móvil 5, TASK-058).
// Si el usuario sube el tamaño de letra del teléfono, el texto crece como máximo MAX_ESCALA_FUENTE_SISTEMA veces y no
// desborda las tarjetas. React 19 ignora `defaultProps` en componentes de función, así que se envuelve `render` de
// Text/TextInput una sola vez. Si la forma interna cambiara, no se hace nada (los textos quedan sin límite, sin error).
import { cloneElement, isValidElement, type ReactElement } from 'react';
import { Text, TextInput } from 'react-native';
import { MAX_ESCALA_FUENTE_SISTEMA } from './medidas';

type ConRender = { render?: (...args: unknown[]) => unknown; __limiteFuente?: boolean };

function limitar(componente: unknown): void {
  const c = componente as ConRender;
  if (!c || typeof c.render !== 'function' || c.__limiteFuente) return;
  const original = c.render;
  c.render = function (this: unknown, ...args: unknown[]) {
    const el = original.apply(this, args);
    if (!isValidElement(el)) return el;
    const props = (el as ReactElement<{ maxFontSizeMultiplier?: number }>).props;
    if (props.maxFontSizeMultiplier !== undefined) return el; // el componente ya fijó su propio límite
    return cloneElement(el as ReactElement<{ maxFontSizeMultiplier?: number }>, { maxFontSizeMultiplier: MAX_ESCALA_FUENTE_SISTEMA });
  };
  c.__limiteFuente = true;
}

export function aplicarLimiteDeFuente(): void {
  try {
    limitar(Text);
    limitar(TextInput);
  } catch {
    // sin límite global: no es un error de la app
  }
}
