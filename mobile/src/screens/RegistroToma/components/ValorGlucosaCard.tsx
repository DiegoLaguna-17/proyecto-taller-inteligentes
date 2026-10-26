import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { FUENTE } from '../../../utils/medidas';
import { GLUCOSA_CAPTURA_MAX, GLUCOSA_CAPTURA_MIN, textoRangoMeta } from '../../../services/umbrales';

interface ValorGlucosaCardProps {
  /** Texto del campo (solo dígitos); vacío si aún no se ingresó. */
  value: string;
  onChangeValue: (val: string) => void;
}

/** Rango aceptado al guardar (validado también en RegistroToma). */
export const VALOR_MIN = GLUCOSA_CAPTURA_MIN;
export const VALOR_MAX = GLUCOSA_CAPTURA_MAX;
const LIMITE_INFERIOR = VALOR_MIN;
const LIMITE_SUPERIOR = VALOR_MAX;

export const ValorGlucosaCard: React.FC<ValorGlucosaCardProps> = ({
  value,
  onChangeValue,
}) => {
  const numero = parseInt(value, 10);
  const paso = (delta: number) => {
    const base = Number.isNaN(numero) ? 100 : numero;
    onChangeValue(String(Math.min(LIMITE_SUPERIOR, Math.max(LIMITE_INFERIOR, base + delta))));
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>
        Nivel de glucosa actual <Text style={styles.requiredStar}>*</Text>
      </Text>

      <View style={styles.valueRow}>
        <TextInput
          style={styles.bigNumber}
          value={value}
          onChangeText={(texto) => onChangeValue(texto.replace(/\D/g, '').slice(0, 3))}
          keyboardType="number-pad"
          placeholder="---"
          placeholderTextColor={COLORS.textMuted}
          maxLength={3}
          testID="registro-valor"
        />
        <Text style={styles.unitText}>mg/dL</Text>
      </View>

      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => paso(-1)}
          activeOpacity={0.7}
          testID="registro-menos"
          accessibilityRole="button"
          accessibilityLabel="Disminuir el valor"
        >
          <Icon name="minus" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.rangePill}>
          <Text style={styles.rangeText}>Rango óptimo: {textoRangoMeta(' - ')} mg/dL</Text>
        </View>

        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => paso(1)}
          activeOpacity={0.7}
          testID="registro-mas"
          accessibilityRole="button"
          accessibilityLabel="Aumentar el valor"
        >
          <Icon name="plus" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  requiredStar: {
    color: COLORS.riesgoHiperText,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  bigNumber: {
    fontFamily: FONTS.bold,
    fontSize: FUENTE.cifraGrande,
    color: COLORS.textPrimary,
    letterSpacing: -1,
    padding: 0,
    minWidth: 90,
    flexShrink: 1,
    maxWidth: 140,
    textAlign: 'right',
  },
  unitText: {
    fontFamily: FONTS.medium,
    fontSize: 18,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  rangePill: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  rangeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

