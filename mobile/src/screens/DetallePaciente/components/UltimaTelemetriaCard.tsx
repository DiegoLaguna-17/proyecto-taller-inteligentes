import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ClassificationBadge } from '../../../shared/ClassificationBadge';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export const UltimaTelemetriaCard: React.FC = () => {
  return (
    <View style={styles.card}>
      <View style={styles.topAccentBar} />

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.label}>ÚLTIMA TELEMETRÍA</Text>
            <Text style={styles.timeText}>Antes de comer · Hoy 13:10</Text>
          </View>
          <ClassificationBadge classification="Riesgo Hipo" />
        </View>

        <View style={styles.readingRow}>
          <Text style={styles.readingValue}>62</Text>
          <Text style={styles.readingUnit}>mg/dL</Text>
        </View>

        <View style={styles.warningBox}>
          <Icon
            name="alertTriangle"
            size={18}
            color={COLORS.riesgoHipo}
            style={styles.warningIcon}
          />
          <Text style={styles.warningText}>
            Umbral inferior a 70 mg/dL registrado. Se notificó al paciente ingerir 15g de
            carbohidratos simples.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  topAccentBar: {
    height: 4,
    backgroundColor: COLORS.riesgoHipo,
  },
  content: {
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  label: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
  },
  timeText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  readingValue: {
    fontFamily: FONTS.bold,
    fontSize: 48,
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  readingUnit: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.riesgoHipoBg,
    borderRadius: 14,
    padding: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.riesgoHipoBorder,
  },
  warningIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  warningText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.riesgoHipoText,
  },
});

