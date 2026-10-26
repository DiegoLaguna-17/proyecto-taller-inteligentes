import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { AlertaMedico } from '../../../services/medico';
import { clasificacionDeAlerta } from '../../../services/medicoVista';
import { haceCuanto } from '../../../services/historial';

interface AlertaPushBannerProps {
  /** Alerta activa más reciente; sin alertas activas no se muestra. */
  alerta: AlertaMedico | null;
  hoy: Date;
  onPress?: () => void;
}

export const AlertaPushBanner: React.FC<AlertaPushBannerProps> = ({ alerta, hoy, onPress }) => {
  const [oculta, setOculta] = useState<number | null>(null);

  if (!alerta || oculta === alerta.id) return null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      testID="alertas-banner"
    >
      <View style={styles.iconCircle}>
        <Icon name="bell" size={18} color={COLORS.primary} />
      </View>

      <View style={styles.textCol}>
        <View style={styles.headerRow}>
          <Text style={styles.categoryText}>
            ALERTA ACTIVA • {haceCuanto(alerta.fecha, alerta.hora, hoy)}
          </Text>
        </View>
        <Text style={styles.bodyText}>
          <Text style={styles.boldText}>{alerta.paciente}</Text> registró{' '}
          {alerta.glucosa !== null ? (
            <>
              <Text style={styles.criticalText}>{alerta.glucosa} mg/dL</Text> ·{' '}
            </>
          ) : null}
          {clasificacionDeAlerta(alerta)}.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => setOculta(alerta.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        testID="alertas-banner-cerrar"
      >
        <Icon name="close" size={14} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textCol: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  categoryText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 0.4,
  },
  bodyText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textPrimary,
  },
  boldText: {
    fontFamily: FONTS.bold,
  },
  criticalText: {
    fontFamily: FONTS.bold,
    color: COLORS.riesgoHiperText,
  },
  closeBtn: {
    padding: 4,
  },
});

