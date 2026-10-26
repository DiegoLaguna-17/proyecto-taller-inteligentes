import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface SolicitudesHeaderBannerProps {
  pendingCount?: number;
}

export const SolicitudesHeaderBanner: React.FC<SolicitudesHeaderBannerProps> = ({
  pendingCount = 5,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.contentCol}>
        <View style={styles.titleRow}>
          <View style={styles.blueDot} />
          <Text style={styles.titleText}>Solicitudes de Registro</Text>
        </View>
        <Text style={styles.subtitleText}>
          {pendingCount} pendientes de validación clínica
        </Text>
      </View>

      <View style={styles.iconCircle}>
        <Icon name="userPlus" size={20} color={COLORS.primary} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  contentCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  blueDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.primary,
  },
  titleText: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  subtitleText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.primary,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.backgroundWhite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
});

