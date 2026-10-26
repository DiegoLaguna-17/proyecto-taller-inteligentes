import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface SelectorPacienteReporteProps {
  patientName: string;
  patientInfo: string;
  onChangePress?: () => void;
}

export const SelectorPacienteReporte: React.FC<SelectorPacienteReporteProps> = ({
  patientName,
  patientInfo,
  onChangePress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>PACIENTE ASIGNADO</Text>
        <TouchableOpacity onPress={onChangePress} activeOpacity={0.7} testID="reportes-cambiar-paciente">
          <Text style={styles.changeLink}>Cambiar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.avatarCircle}>
          <Icon name="user" size={18} color={COLORS.primary} />
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.nameText} testID="reportes-paciente">{patientName}</Text>
          <Text style={styles.infoText}>{patientInfo}</Text>
        </View>

        <View style={styles.chevronsCol}>
          <Icon name="chevronUp" size={12} color={COLORS.textMuted} />
          <Icon name="chevronDown" size={12} color={COLORS.textMuted} />
        </View>
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
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
  },
  changeLink: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
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
  avatarCircle: {
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
  nameText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  infoText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  chevronsCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

