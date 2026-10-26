import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { ClassificationBadge } from '../../../shared/ClassificationBadge';
import { CustomButton } from '../../../shared/CustomButton';
import { COLORS, ClassificationType } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface ResultadoClasificacionModalProps {
  visible: boolean;
  value: number;
  moment: string;
  onGoHome: () => void;
}

export const ResultadoClasificacionModal: React.FC<ResultadoClasificacionModalProps> = ({
  visible,
  value,
  moment,
  onGoHome,
}) => {
  let classification: ClassificationType = 'Normal';
  let message =
    'Tu nivel de glucemia se encuentra dentro de los parámetros esperados para este momento.';

  if (value < 70) {
    classification = 'Riesgo Hipo';
    message =
      'Se ha detectado un nivel bajo de glucosa. Consume 15g de carbohidratos rápidos y vuelve a medirte en 15 minutos.';
  } else if (value > 140) {
    classification = 'Riesgo Hiper';
    message =
      'Se ha detectado un nivel elevado de glucosa. Hidrátate con agua y sigue las indicaciones de tu médico tratante.';
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>Paso 2 de 2 · Resultado</Text>
          </View>

          <Text style={styles.title}>Resultado de la clasificación</Text>

          <View style={styles.valueContainer}>
            <Text style={styles.valueNumber}>{value}</Text>
            <Text style={styles.valueUnit}>mg/dL</Text>
          </View>

          <View style={styles.momentRow}>
            <Text style={styles.momentLabel}>Momento:</Text>
            <Text style={styles.momentValue}>{moment}</Text>
          </View>

          <View style={styles.badgeRow}>
            <ClassificationBadge classification={classification} size="lg" />
          </View>

          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{message}</Text>
          </View>

          <CustomButton
            title="Volver al inicio"
            onPress={onGoHome}
            style={styles.btn}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  stepBadge: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  stepBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  valueNumber: {
    fontFamily: FONTS.bold,
    fontSize: 56,
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  valueUnit: {
    fontFamily: FONTS.medium,
    fontSize: 18,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  momentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  momentLabel: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  momentValue: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  badgeRow: {
    marginBottom: 18,
  },
  messageBox: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  messageText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  btn: {
    width: '100%',
  },
});

