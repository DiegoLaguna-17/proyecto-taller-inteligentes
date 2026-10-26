import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface SwitchPerfilProps {
  selectedRole: 'Paciente' | 'Médico';
  onSelectRole: (role: 'Paciente' | 'Médico') => void;
}

export const SwitchPerfil: React.FC<SwitchPerfilProps> = ({
  selectedRole,
  onSelectRole,
}) => {
  const isPaciente = selectedRole === 'Paciente';
  const isMedico = selectedRole === 'Médico';

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Selecciona tu perfil</Text>
      <View style={styles.segmentedBox}>
        <TouchableOpacity
          style={[styles.segmentBtn, isPaciente && styles.segmentBtnActive]}
          onPress={() => onSelectRole('Paciente')}
          activeOpacity={0.8}
        >
          <Icon
            name="user"
            size={18}
            color={isPaciente ? COLORS.primary : COLORS.textSecondary}
          />
          <Text
            style={[
              styles.segmentText,
              { color: isPaciente ? COLORS.primary : COLORS.textSecondary },
              isPaciente && styles.segmentTextActive,
            ]}
          >
            Paciente
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, isMedico && styles.segmentBtnActive]}
          onPress={() => onSelectRole('Médico')}
          activeOpacity={0.8}
        >
          <Icon
            name="stethoscope"
            size={18}
            color={isMedico ? COLORS.primary : COLORS.textSecondary}
          />
          <Text
            style={[
              styles.segmentText,
              { color: isMedico ? COLORS.primary : COLORS.textSecondary },
              isMedico && styles.segmentTextActive,
            ]}
          >
            Médico
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    width: '100%',
  },
  sectionLabel: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  segmentedBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.backgroundWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
  },
  segmentTextActive: {
    fontFamily: FONTS.bold,
  },
});

