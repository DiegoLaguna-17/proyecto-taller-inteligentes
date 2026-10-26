// Guarda contra el doble envío (TASK-059). Un estado de React (`guardando`) tarda un ciclo de renderizado en
// deshabilitar el botón: dos toques seguidos pueden lanzar dos envíos. El turno se toma de forma síncrona, así que el
// segundo toque se descarta antes de llegar a la red. Uso: `const turno = useRef(false)`;
// `if (!tomarTurno(turno)) return;` al empezar el envío y `liberarTurno(turno)` en el `finally`.

export interface Turno {
  current: boolean;
}

/** Toma el turno; false si ya hay un envío en curso (en ese caso no hay que enviar nada). */
export function tomarTurno(t: Turno): boolean {
  if (t.current) return false;
  t.current = true;
  return true;
}

export function liberarTurno(t: Turno): void {
  t.current = false;
}

/** Ejecuta `fn` solo si no hay otra ejecución en curso con el mismo turno; devuelve undefined si se descartó. */
export async function conTurno<T>(t: Turno, fn: () => Promise<T>): Promise<T | undefined> {
  if (!tomarTurno(t)) return undefined;
  try {
    return await fn();
  } finally {
    liberarTurno(t);
  }
}
