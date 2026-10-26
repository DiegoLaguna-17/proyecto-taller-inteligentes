import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { InputField } from '../../../shared/InputField';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface MatriculaCardProps {
  license: string;
  setLicense: (val: string) => void;
  error?: string;
}

export const MatriculaCard: React.FC<MatriculaCardProps> = ({
  license,
  setLicense,
  error,
}) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        Matrícula profesional{' '}
        <Text style={styles.badgeText}>(Obligatorio para médicos)</Text>
      </Text>

      <InputField
        placeholder="Ej. MN 148.920 / MP 45.102"
        value={license}
        onChangeText={setLicense}
        leftIcon="shieldCheck"
        error={error}
      />

      <View style={styles.infoRow}>
        <View style={styles.infoIcon}>
          <Icon name="info" size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.infoText}>
          Tu número de matrícula será contrastado con el registro oficial de
          profesionales de la salud antes de autorizar la emisión de recetas y
          seguimiento de pacientes.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  badgeText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.primary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: -6,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },
});

