import { useWindowDimensions } from 'react-native';
import { anchoContenido, escalar, factorEscala } from './medidas';

/** Medidas de la ventana actual (se recalculan al rotar o redimensionar). */
export function useMedidas() {
  const { width, height } = useWindowDimensions();
  return {
    ancho: width,
    alto: height,
    factor: factorEscala(width),
    anchoContenido: anchoContenido(width),
    /** Escala un tamaño según el ancho, con tope opcional del factor. */
    esc: (valor: number, tope?: number) => escalar(valor, width, tope),
  };
}
