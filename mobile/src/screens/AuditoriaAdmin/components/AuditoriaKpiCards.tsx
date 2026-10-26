import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { FUENTE } from '../../../utils/medidas';

interface AuditoriaKpiCardsProps {
  hoy: number;
  erroresHoy: number;
  total: number;
}

// Cifras calculadas con los registros reales (la "integridad 100 %" de la maqueta no tiene fuente).
export const AuditoriaKpiCards: React.FC<AuditoriaKpiCardsProps> = ({ hoy, erroresHoy, total }) => {
  return (
    <View style={styles.container} testID="auditoria-kpis">
      <View style={styles.card}>
        <Text style={styles.number} numberOfLines={1} adjustsFontSizeToFit testID="auditoria-kpi-hoy">{hoy}</Text>
        <Text style={styles.label}>Registros Hoy</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.number} testID="auditoria-kpi-errores">{erroresHoy}</Text>
        <Text style={styles.label}>Con Error Hoy</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.number} testID="auditoria-kpi-total">{total}</Text>
        <Text style={styles.label}>Total</Text>
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
    fontSize: FUENTE.tituloGrande,
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

