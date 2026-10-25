import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { UserRole } from '../../../utils/mockData';

interface RoleQuickSelectProps {
  onSelectRole: (role: UserRole) => void;
}

export const RoleQuickSelect: React.FC<RoleQuickSelectProps> = ({ onSelectRole }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Accesos de prueba rápidos:</Text>
      <View style={styles.pillsRow}>
        <TouchableOpacity
          style={styles.pill}
          onPress={() => onSelectRole('paciente')}
          activeOpacity={0.7}
        >
          <Text style={styles.pillText}>👤 Paciente (Carlos)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pill}
          onPress={() => onSelectRole('medico')}
          activeOpacity={0.7}
        >
          <Text style={styles.pillText}>🩺 Médico (Dra. Carmen)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pill}
          onPress={() => onSelectRole('admin')}
          activeOpacity={0.7}
        >
          <Text style={styles.pillText}>⚙️ Admin (Mariana)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  pill: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  pillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
});

