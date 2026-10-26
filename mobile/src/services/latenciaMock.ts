// Espera artificial de los servicios simulados (EXPO_PUBLIC_MOCK_LATENCIA, ms). Sin la variable o con el backend real no espera.
import { MOCK_LATENCIA_MS } from './config.ts';

export async function esperarMock(ms: number = MOCK_LATENCIA_MS): Promise<void> {
  if (ms > 0) await new Promise<void>((resolver) => setTimeout(resolver, ms));
}
