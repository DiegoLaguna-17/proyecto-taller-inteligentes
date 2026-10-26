import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';
import { COLORS } from '../utils/colors';
import { FONTS } from '../utils/typography';

export interface OpcionChip {
  id: number | string;
  etiqueta: string;
}

interface OpcionesChipsProps {
  label: string;
  opciones: OpcionChip[];
  seleccionado: number | string | null;
  onSelect: (id: number | string) => void;
  error?: string;
  /** Prefijo de los testID: `${testIDPrefix}-${id}`; el error usa `${testIDPrefix}-error`. */
  testIDPrefix: string;
  /** Texto de ayuda bajo las opciones (p. ej. descripción del tratamiento elegido). */
  ayuda?: string;
}

// Selección única con el mismo estilo que el selector de momento de la toma.
export const OpcionesChips: React.FC<OpcionesChipsProps> = ({
  label,
  opciones,
  seleccionado,
  onSelect,
  error,
  testIDPrefix,
  ayuda,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} <Text style={styles.requiredStar}>*</Text>
      </Text>
      {opciones.length === 0 ? (
        <Text style={styles.vacio}>No hay opciones disponibles.</Text>
      ) : (
        <View style={styles.grid}>
          {opciones.map((o) => {
            const activa = seleccionado === o.id;
            return (
              <TouchableOpacity
                key={o.id}
                style={[styles.chip, activa && styles.chipActivo]}
                onPress={() => onSelect(o.id)}
                activeOpacity={0.8}
                testID={`${testIDPrefix}-${o.id}`}
              >
                {activa && <Icon name="check" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />}
                <Text style={[styles.chipText, activa && styles.chipTextActivo]}>{o.etiqueta}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {ayuda ? <Text style={styles.ayuda}>{ayuda}</Text> : null}
      {error ? (
        <Text style={styles.error} testID={`${testIDPrefix}-error`}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  requiredStar: {
    color: COLORS.riesgoHiperText,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  chipActivo: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  chipTextActivo: {
    color: '#FFFFFF',
  },
  vacio: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  ayuda: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  error: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.riesgoHiperText,
    marginTop: 6,
  },
});
