import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export const AuditoriaKpiCards: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.number}>6</Text>
        <Text style={styles.label}>Registros Hoy</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.number}>1</Text>
        <Text style={styles.label}>Alerta Crítica</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.number}>100%</Text>
        <Text style={styles.label}>Integridad</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderCard,
  },
  number: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: COLORS.primary,
    marginBottom: 4,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

