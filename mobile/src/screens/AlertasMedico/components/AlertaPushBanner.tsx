import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface AlertaPushBannerProps {
  onPress?: () => void;
}

export const AlertaPushBanner: React.FC<AlertaPushBannerProps> = ({ onPress }) => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.iconCircle}>
        <Icon name="bell" size={18} color={COLORS.primary} />
      </View>

      <View style={styles.textCol}>
        <View style={styles.headerRow}>
          <Text style={styles.categoryText}>ALERTA DEL SISTEMA • Hace 15 min</Text>
        </View>
        <Text style={styles.bodyText}>
          <Text style={styles.boldText}>Elena Soto</Text> registró un nivel
          crítico (
          <Text style={styles.criticalText}>62 mg/dL</Text> · Riesgo Hipo).
        </Text>
      </View>

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => setVisible(false)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
    color: COLORS.riesgoHiper,
  },
  closeBtn: {
    padding: 4,
  },
});

