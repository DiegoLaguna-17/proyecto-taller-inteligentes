import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export const MetricasResumenMedico: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Metric 1 */}
      <View style={styles.card}>
        <View style={styles.iconBox}>
          <Icon name="chart" size={18} color={COLORS.primary} />
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.label}>Tasa en Rango</Text>
          <Text style={styles.value}>88.4%</Text>
        </View>
      </View>

      {/* Metric 2 */}
      <View style={styles.card}>
        <View style={[styles.iconBox, { backgroundColor: COLORS.riesgoHiperBg }]}>
          <Icon name="alertTriangle" size={18} color={COLORS.riesgoHiper} />
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.label}>Atención Urge...</Text>
          <Text style={[styles.value, { color: COLORS.riesgoHiper }]}>2 Casos</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  infoCol: {
    flex: 1,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  value: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
});

