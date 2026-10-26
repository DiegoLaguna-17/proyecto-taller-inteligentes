import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { FUENTE } from '../../../utils/medidas';

interface HistorialResumenCardsProps {
  periodo: string;
  promedio: number | null;
  desviacion: number | null;
  enRango: number | null;
  total: number;
}

export const HistorialResumenCards: React.FC<HistorialResumenCardsProps> = ({
  periodo,
  promedio,
  desviacion,
  enRango,
  total,
}) => {
  return (
    <View style={styles.container}>
      {/* Card 1: Promedio Semanal */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
          <Text style={styles.cardLabel}>Promedio {periodo}</Text>
        </View>
        <View style={styles.valueRow}>
          <Text style={styles.bigNumber} numberOfLines={1} adjustsFontSizeToFit testID="historial-promedio">{promedio ?? '--'}</Text>
          <Text style={styles.unitText}>mg/dL</Text>
        </View>
        <View style={styles.footerRow}>
          <Icon name="arrowRight" size={13} color={COLORS.primary} />
          <Text style={styles.footerPrimary}>
            {enRango === null ? 'Sin datos' : `${enRango}% en rango`}
          </Text>
        </View>
      </View>

      {/* Card 2: Desviación Estándar */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={[styles.dot, { backgroundColor: COLORS.textSecondary }]} />
          <Text style={styles.cardLabel}>Desviación Estándar</Text>
        </View>
        <View style={styles.valueRow}>
          <Text style={styles.bigNumber} testID="historial-desviacion">
            {desviacion === null ? '--' : `± ${desviacion}`}
          </Text>
          <Text style={styles.unitText}>mg/dL</Text>
        </View>
        <View style={styles.footerRow}>
          <Icon name="shieldCheck" size={13} color={COLORS.textSecondary} />
          <Text style={styles.footerMuted}>
            {total === 1 ? '1 registro' : `${total} registros`}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  bigNumber: {
    fontFamily: FONTS.bold,
    fontSize: FUENTE.tituloGrande,
    color: COLORS.textPrimary,
  },
  unitText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerPrimary: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  footerMuted: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});

