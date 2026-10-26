import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ClassificationBadge } from '../../../shared/ClassificationBadge';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

const TOMAS = [
  {
    id: '1',
    value: 124,
    detail: 'Postprandial · Hoy, 14:30',
    classification: 'Normal',
    icon: 'utensils',
    circleBg: COLORS.surfaceLight,
    iconColor: COLORS.primary,
  },
  {
    id: '2',
    value: 112,
    detail: 'Ayunas · Hoy, 08:30',
    classification: 'Normal',
    icon: 'sun',
    circleBg: COLORS.surfaceLight,
    iconColor: COLORS.primary,
  },
  {
    id: '3',
    value: 68,
    detail: 'Antes de dormir · Ayer, 23:15',
    classification: 'Riesgo Hipo',
    icon: 'moon',
    circleBg: COLORS.riesgoHipoBg,
    iconColor: COLORS.riesgoHipo,
  },
  {
    id: '4',
    value: 195,
    detail: 'Postprandial · Ayer, 15:00',
    classification: 'Riesgo Hiper',
    icon: 'fastFood',
    circleBg: COLORS.riesgoHiperBg,
    iconColor: COLORS.riesgoHiper,
  },
];

export const TomasList: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Tomas registradas</Text>
        <Text style={styles.countText}>4 registros recientes</Text>
      </View>

      <View style={styles.list}>
        {TOMAS.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: item.circleBg }]}>
              <Icon name={item.icon} size={18} color={item.iconColor} />
            </View>

            <View style={styles.infoCol}>
              <View style={styles.readingRow}>
                <Text style={styles.readingValue}>{item.value}</Text>
                <Text style={styles.readingUnit}>mg/dL</Text>
              </View>
              <Text style={styles.detailText}>{item.detail}</Text>
            </View>

            <ClassificationBadge classification={item.classification} />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  countText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  readingValue: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  readingUnit: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  detailText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});

