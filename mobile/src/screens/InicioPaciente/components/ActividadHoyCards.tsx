import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { FUENTE } from '../../../utils/medidas';

interface ActividadHoyCardsProps {
  /** Tomas registradas hoy. */
  tomas: number;
  /** Meta diaria: un registro por momento del día del catálogo (ayunas, después de comer, antes de dormir). */
  meta: number;
  promedio: number | null;
  /** null = sin tomas hoy. */
  enRango: boolean | null;
  onPressDesglose?: () => void;
}

export const ActividadHoyCards: React.FC<ActividadHoyCardsProps> = ({
  tomas,
  meta,
  promedio,
  enRango,
  onPressDesglose,
}) => {
  const avance = Math.min(100, Math.round((tomas / meta) * 100));
  return (
    <View style={styles.container} testID="inicio-actividad">
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>ACTIVIDAD DE HOY</Text>
        <TouchableOpacity onPress={onPressDesglose} activeOpacity={0.7} testID="inicio-ver-desglose">
          <Text style={styles.desgloseLink}>Ver desglose</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardsRow}>
        {/* Card 1: Tomas registradas */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Tomas registradas</Text>
            <Icon name="doubleCheck" size={16} color={COLORS.primary} />
          </View>
          <View style={styles.valueRow}>
            <Text style={styles.bigNumber} numberOfLines={1} adjustsFontSizeToFit testID="inicio-tomas-hoy">{tomas}</Text>
            <Text style={styles.subNumber}>/ {meta} meta</Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${avance}%` }]} />
          </View>
        </View>

        {/* Card 2: Promedio hoy */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Promedio hoy</Text>
            <Icon name="chart" size={16} color={COLORS.primary} />
          </View>
          <View style={styles.valueRow}>
            <Text style={styles.bigNumber} testID="inicio-promedio-hoy">{promedio ?? '--'}</Text>
            <Text style={styles.subUnit}>mg/dL</Text>
          </View>
          <View style={styles.statusRow}>
            <Icon name="check" size={13} color={enRango === false ? COLORS.riesgoHiper : COLORS.normal} />
            <Text style={styles.statusText}>
              {enRango === null ? 'Sin tomas hoy' : enRango ? 'Dentro de meta' : 'Fuera de meta'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
  },
  desgloseLink: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  bigNumber: {
    fontFamily: FONTS.bold,
    fontSize: FUENTE.tituloGrande,
    color: COLORS.textPrimary,
  },
  subNumber: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    marginLeft: 6,
  },
  subUnit: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.normalText,
  },
});

