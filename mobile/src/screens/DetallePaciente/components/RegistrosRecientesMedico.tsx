import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

const REGISTROS = [
  {
    id: '1',
    title: 'Antes del almuerzo',
    subtitle: 'Hoy · 13:10',
    value: 62,
    badgeText: 'Riesgo Hipo',
    badgeBg: COLORS.riesgoHipoBg,
    badgeColor: COLORS.riesgoHipoText,
    icon: 'arrowTrendingDown',
    iconBg: COLORS.riesgoHipoBg,
    iconColor: COLORS.riesgoHipo,
  },
  {
    id: '2',
    title: 'En ayunas',
    subtitle: 'Hoy · 08:05',
    value: 104,
    badgeText: 'Objetivo',
    badgeBg: COLORS.normalBg,
    badgeColor: COLORS.normalText,
    icon: 'check',
    iconBg: COLORS.normalBg,
    iconColor: COLORS.normal,
  },
  {
    id: '3',
    title: '2h Post-cena',
    subtitle: 'Ayer · 22:45',
    value: 132,
    badgeText: 'Objetivo',
    badgeBg: COLORS.normalBg,
    badgeColor: COLORS.normalText,
    icon: 'check',
    iconBg: COLORS.normalBg,
    iconColor: COLORS.normal,
  },
  {
    id: '4',
    title: 'Post-almuerzo',
    subtitle: 'Ayer · 15:30',
    value: 168,
    badgeText: 'Elevado',
    badgeBg: COLORS.riesgoHiperBg,
    badgeColor: COLORS.riesgoHiperText,
    icon: 'arrowTrendingUp',
    iconBg: COLORS.riesgoHiperBg,
    iconColor: COLORS.riesgoHiper,
  },
];

export const RegistrosRecientesMedico: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Registros Recientes</Text>
        <Text style={styles.countText}>3 tomas hoy</Text>
      </View>

      <View style={styles.list}>
        {REGISTROS.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
              <Icon name={item.icon} size={16} color={item.iconColor} />
            </View>

            <View style={styles.infoCol}>
              <Text style={styles.titleText}>{item.title}</Text>
              <Text style={styles.subtitleText}>{item.subtitle}</Text>
            </View>

            <View style={styles.valueCol}>
              <Text style={styles.valueText}>
                {item.value} <Text style={styles.unitText}>mg/dL</Text>
              </Text>
              <View style={[styles.badge, { backgroundColor: item.badgeBg }]}>
                <Text style={[styles.badgeText, { color: item.badgeColor }]}>
                  {item.badgeText}
                </Text>
              </View>
            </View>
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
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  titleText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  subtitleText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  valueCol: {
    alignItems: 'flex-end',
  },
  valueText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  unitText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  badgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
});

