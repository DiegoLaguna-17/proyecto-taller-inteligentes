import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { Tratamiento } from '../../../services/paciente';

interface TratamientoVinculadoCardProps {
  tratamientos: Tratamiento[];
}

// La vía de administración ("Oral", "Subcutánea") de la maqueta no existe en el backend y se retiró.
export const TratamientoVinculadoCard: React.FC<TratamientoVinculadoCardProps> = ({ tratamientos }) => {
  return (
    <View style={styles.card} testID="detalle-tratamientos">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Tratamiento Vinculado</Text>
        <Icon name="pill" size={16} color={COLORS.textSecondary} />
      </View>

      {tratamientos.length === 0 ? (
        <Text style={styles.medDose}>Sin tratamientos registrados.</Text>
      ) : (
        tratamientos.map((t, i) => (
          <View key={`${t.titulo}-${i}`} style={styles.medRow}>
            <View style={styles.medInfo}>
              <Text style={styles.medName}>{t.titulo}</Text>
              <Text style={styles.medDose}>
                {t.dosis ? `Dosis: ${t.dosis}` : t.descripcion || 'Sin dosis registrada'}
              </Text>
            </View>
          </View>
        ))
      )}
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

