import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface ValorGlucosaCardProps {
  value: number;
  onChangeValue: (val: number) => void;
}

export const ValorGlucosaCard: React.FC<ValorGlucosaCardProps> = ({
  value,
  onChangeValue,
}) => {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>
        Nivel de glucosa actual <Text style={styles.requiredStar}>*</Text>
      </Text>

      <View style={styles.valueRow}>
        <Text style={styles.bigNumber}>{value}</Text>
        <Text style={styles.unitText}>mg/dL</Text>
      </View>

      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => onChangeValue(Math.max(40, value - 1))}
          activeOpacity={0.7}
        >
          <Icon name="minus" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.rangePill}>
          <Text style={styles.rangeText}>Rango óptimo: 70 - 140 mg/dL</Text>
        </View>

        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => onChangeValue(Math.min(400, value + 1))}
          activeOpacity={0.7}
        >
          <Icon name="plus" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  requiredStar: {
    color: COLORS.riesgoHiper,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  bigNumber: {
    fontFamily: FONTS.bold,
    fontSize: 56,
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  unitText: {
    fontFamily: FONTS.medium,
    fontSize: 18,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  rangePill: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  rangeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

