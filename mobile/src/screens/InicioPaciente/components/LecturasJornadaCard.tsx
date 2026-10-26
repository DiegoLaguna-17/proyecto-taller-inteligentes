import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export const LecturasJornadaCard: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>ÚLTIMAS LECTURAS DE LA JORNADA</Text>
      <View style={styles.card}>
        {/* Item 1 */}
        <View style={styles.row}>
          <View style={styles.iconCircle}>
            <Icon name="moon" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.momentTitle}>Antes de dormir</Text>
            <Text style={styles.timeSubtitle}>Ayer, 11:15 PM</Text>
          </View>
          <View style={styles.valueCol}>
            <Text style={styles.valueText}>
              124 <Text style={styles.unitText}>mg/dL</Text>
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Item 2 */}
        <View style={styles.row}>
          <View style={styles.iconCircle}>
            <Icon name="utensils" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.momentTitle}>Post-cena</Text>
            <Text style={styles.timeSubtitle}>Ayer, 09:30 PM</Text>
          </View>
          <View style={styles.valueCol}>
            <Text style={styles.valueText}>
              138 <Text style={styles.unitText}>mg/dL</Text>
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
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  momentTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  timeSubtitle: {
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
    fontSize: 17,
    color: COLORS.textPrimary,
  },
  unitText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
});

