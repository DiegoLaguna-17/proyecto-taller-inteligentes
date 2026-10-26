import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface IndicadorEscribiendoProps {
  /** Con «reducir movimiento» los puntos quedan fijos. */
  sinMovimiento?: boolean;
}

// Tres puntos que laten en cascada mientras llega la respuesta del asistente.
export const IndicadorEscribiendo: React.FC<IndicadorEscribiendoProps> = ({ sinMovimiento = false }) => {
  const puntos = useRef([0, 1, 2].map(() => new Animated.Value(0.35))).current;

  useEffect(() => {
    if (sinMovimiento) return;
    const animaciones = puntos.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.35, duration: 320, useNativeDriver: true }),
          Animated.delay(Math.max(0, (2 - i) * 160)),
        ]),
      ),
    );
    animaciones.forEach((a) => a.start());
    return () => animaciones.forEach((a) => a.stop());
  }, [puntos, sinMovimiento]);

  return (
    <View
      style={styles.fila}
      testID="chat-escribiendo"
      accessibilityRole="progressbar"
      accessibilityLabel="El asistente está escribiendo"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.avatar}>
        <Icon name="bot" size={16} color={COLORS.primary} />
      </View>
      <View style={styles.burbuja}>
        {puntos.map((v, i) => (
          <Animated.View key={i} style={[styles.punto, { opacity: sinMovimiento ? 0.7 : v }]} />
        ))}
      </View>
      <Text style={styles.texto}>escribiendo…</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  burbuja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  punto: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary },
  texto: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
});
