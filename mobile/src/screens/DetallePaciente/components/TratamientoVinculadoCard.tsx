import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export const TratamientoVinculadoCard: React.FC = () => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Tratamiento Vinculado</Text>
        <Icon name="pill" size={16} color={COLORS.textSecondary} />
      </View>

      {/* Pill 1 */}
      <View style={styles.medRow}>
        <View style={styles.medInfo}>
          <Text style={styles.medName}>Metformina</Text>
          <Text style={styles.medDose}>850 mg · Comida y Cena</Text>
        </View>
        <View style={styles.routeTag}>
          <Text style={styles.routeTagText}>Oral</Text>
        </View>
      </View>

      {/* Pill 2 */}
      <View style={styles.medRow}>
        <View style={styles.medInfo}>
          <Text style={styles.medName}>Insulina Glargina</Text>
          <Text style={styles.medDose}>14 UI · Noche (22:00)</Text>
        </View>
        <View style={styles.routeTag}>
          <Text style={styles.routeTagText}>Subcutánea</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  medRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  medInfo: {
    flex: 1,
  },
  medName: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  medDose: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  routeTag: {
    backgroundColor: COLORS.backgroundWhite,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  routeTagText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});

