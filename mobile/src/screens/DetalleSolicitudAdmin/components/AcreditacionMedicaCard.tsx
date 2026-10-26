import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface AcreditacionMedicaCardProps {
  license?: string;
  college?: string;
}

export const AcreditacionMedicaCard: React.FC<AcreditacionMedicaCardProps> = ({
  license = 'MN 142.890',
  college = 'Colegio Médico Nacional',
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>ACREDITACIÓN MÉDICA</Text>
        <View style={styles.officialBadge}>
          <Text style={styles.officialText}>Oficial</Text>
        </View>
      </View>

      <Text style={styles.licenseLabel}>Matrícula profesional</Text>
      <Text style={styles.licenseNumber}>{license}</Text>
      <Text style={styles.collegeText}>{college}</Text>

      <View style={styles.verifiedBox}>
        <Icon name="checkBadge" size={20} color={COLORS.primary} />
        <View style={styles.verifiedTextCol}>
          <Text style={styles.verifiedTitle}>
            Registro oficial verificado en padrón nacional
          </Text>
          <Text style={styles.verifiedDesc}>
            Última conciliación automática de identidad completada hoy.
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
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
  },
  officialBadge: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  officialText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  licenseLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  licenseNumber: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  collegeText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 14,
  },
  verifiedBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    padding: 12,
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  verifiedTextCol: {
    flex: 1,
  },
  verifiedTitle: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  verifiedDesc: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.textSecondary,
  },
});

