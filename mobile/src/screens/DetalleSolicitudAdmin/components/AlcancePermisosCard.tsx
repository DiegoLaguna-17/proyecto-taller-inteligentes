import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

// Lo único que hace "activar" en el backend es poner la cuenta en estado activo (usuario.estado = true).
const EFECTOS = [
  'La cuenta quedará activa.',
  'La persona podrá iniciar sesión con su correo y su contraseña.',
];

export const AlcancePermisosCard: React.FC = () => {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>AL ACTIVAR LA CUENTA</Text>
      {EFECTOS.map((texto, index) => (
        <View key={index} style={styles.itemRow}>
          <View style={styles.iconCircle}>
            <Icon name="check" size={14} color={COLORS.primary} />
          </View>
          <Text style={styles.itemText}>{texto}</Text>
        </View>
      ))}
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
  sectionLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  itemText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textPrimary,
  },
});

