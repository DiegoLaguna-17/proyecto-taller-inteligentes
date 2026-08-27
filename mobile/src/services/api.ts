/**
 * Cliente base para consumir el backend de GlucoTracker (FastAPI en Azure).
 * Ver design.md § API / Interface Design para la lista completa de endpoints.
 */

// TODO: mover a variable de entorno / config por ambiente (dev, staging, prod)
export const API_BASE_URL = 'https://TODO-reemplazar-con-url-azure.net';

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}
