import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface FechaHoraCardProps {
  timeText?: string;
  onPressCambiar?: () => void;
}

export const FechaHoraCard: React.FC<FechaHoraCardProps> = ({
  timeText = 'Hoy, 14:35',
  onPressCambiar,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>
          Fecha y hora <Text style={styles.requiredStar}>*</Text>
        </Text>
        <Text style={styles.detectedBadge}>Detectado</Text>
      </View>

      <View style={styles.contentRow}>
        <View style={styles.iconBox}>
          <Icon name="clock" size={20} color={COLORS.primary} />
        </View>

        <View style={styles.timeInfo}>
          <Text style={styles.timeMain}>{timeText}</Text>
          <Text style={styles.timeSub}>Hora actual del dispositivo</Text>
        </View>

        {onPressCambiar ? (
          <TouchableOpacity
            style={styles.changeBtn}
            onPress={onPressCambiar}
            activeOpacity={0.7}
          >
            <Text style={styles.changeBtnText}>Cambiar</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  requiredStar: {
    color: COLORS.riesgoHiperText,
  },
  detectedBadge: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  timeInfo: {
    flex: 1,
  },
  timeMain: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  timeSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  changeBtn: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  changeBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
});

