import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { ESPACIO, FUENTE, RADIO } from '../../../utils/medidas';
import { useMedidas } from '../../../utils/useMedidas';
import {
  LEYENDA_RIESGO,
  TITULO_RIESGO,
  formatearPorcentaje,
  listaFaltantes,
  resumenAccesible,
  textoMotivo,
  textoSupuesto,
  type RiesgoMl,
} from '../../../services/riesgoMl';

interface Props {
  riesgo: RiesgoMl;
}

/**
 * Estimación experimental de riesgo de hipoglucemia (ML) para el resultado del médico. Solo informativa: sin categorías,
 * semáforos ni colores de alarma (no hay umbral clínico validado), y la leyenda siempre visible.
 */
export const RiesgoMlBloque: React.FC<Props> = ({ riesgo }) => {
  const { esc } = useMedidas();
  const faltantes = riesgo.motivo === 'datos_insuficientes' ? listaFaltantes(riesgo.faltantes) : '';

  return (
    <View style={styles.bloque} testID="ml-riesgo-bloque" accessible accessibilityLabel={`${resumenAccesible(riesgo)}. ${LEYENDA_RIESGO}`}>
      <Text style={[styles.titulo, { fontSize: esc(FUENTE.cuerpo, 1.1) }]} accessibilityRole="header">{TITULO_RIESGO}</Text>

      {riesgo.riesgo !== null ? (
        <>
          <Text style={[styles.valor, { fontSize: esc(FUENTE.cifra, 1.1) }]} testID="ml-riesgo-valor" adjustsFontSizeToFit numberOfLines={1}>
            {formatearPorcentaje(riesgo.riesgo)}
          </Text>
          {riesgo.supuestos.length > 0 ? (
            <View style={styles.lista} testID="ml-riesgo-supuestos">
              {riesgo.supuestos.map((s) => (
                <Text key={s} style={[styles.item, { fontSize: esc(FUENTE.caption + 1, 1.1) }]}>{`• ${textoSupuesto(s)}`}</Text>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <>
          <Text style={[styles.motivo, { fontSize: esc(FUENTE.cuerpo, 1.1) }]} testID="ml-riesgo-motivo">
            {textoMotivo(riesgo.motivo ?? 'desconocido')}
          </Text>
          {faltantes ? (
            <Text style={[styles.item, styles.faltantes, { fontSize: esc(FUENTE.caption + 1, 1.1) }]} testID="ml-riesgo-faltantes">
              {`Datos que faltan: ${faltantes}`}
            </Text>
          ) : null}
        </>
      )}

      {riesgo.version ? (
        <Text style={[styles.version, { fontSize: esc(FUENTE.nota, 1.1) }]} testID="ml-riesgo-version">{`Versión del modelo ${riesgo.version}`}</Text>
      ) : null}

      <Text style={[styles.leyenda, { fontSize: esc(FUENTE.caption, 1.1) }]} testID="ml-riesgo-leyenda">{LEYENDA_RIESGO}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bloque: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIO.lg,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    padding: ESPACIO.md,
    marginBottom: ESPACIO.lg,
  },
  titulo: { fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: 'center', marginBottom: ESPACIO.sm },
  valor: { fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: 'center', marginBottom: ESPACIO.sm },
  motivo: { fontFamily: FONTS.medium, color: COLORS.textPrimary, textAlign: 'center', marginBottom: ESPACIO.sm },
  lista: { alignSelf: 'stretch', marginBottom: ESPACIO.sm },
  item: { fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 19 },
  faltantes: { textAlign: 'center', marginBottom: ESPACIO.sm },
  version: { fontFamily: FONTS.regular, color: COLORS.textMuted, textAlign: 'center', marginBottom: ESPACIO.sm },
  leyenda: {
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: ESPACIO.sm,
  },
});
