// testID estables para Maestro: sin acentos, en minúsculas y solo [a-z0-9-] (design.md § Fase Chatbot-Front, TASK-064).
// Se usa en los testID dinámicos que llevan texto libre (p. ej. el rol «Médico» de las tarjetas del administrador).

export function normalizarTestId(texto: string): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}
