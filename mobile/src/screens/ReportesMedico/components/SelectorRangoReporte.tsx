import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface SelectorRangoReporteProps {
  rangeName: string;
  rangeDates: string;
  /** Alterna entre los últimos 7 y 30 días. */
  onPress?: () => void;
}

export const SelectorRangoReporte: React.FC<SelectorRangoReporteProps> = ({
  rangeName,
  rangeDates,
  onPress,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>RANGO TEMPORAL</Text>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.7}
        testID="reportes-rango"
      >
        <View style={styles.calendarCircle}>
          <Icon name="calendar" size={18} color={COLORS.primary} />
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.rangeNameText}>{rangeName}</Text>
          <Text style={styles.rangeDatesText}>{rangeDates}</Text>
        </View>

        <Icon name="chevronDown" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
  },
  calendarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  rangeNameText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  rangeDatesText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});

