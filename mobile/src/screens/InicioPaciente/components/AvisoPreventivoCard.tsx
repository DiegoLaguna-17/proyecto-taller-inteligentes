import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface AvisoPreventivoCardProps {
  onPress?: () => void;
}

export const AvisoPreventivoCard: React.FC<AvisoPreventivoCardProps> = ({ onPress }) => {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
    >
      <View style={styles.iconCircle}>
        <Icon name="info" size={20} color={COLORS.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Aviso preventivo</Text>
        <Text style={styles.body}>
          Has presentado 2 valores cercanos al límite postprandial en los últimos 3
          días. Mantén tu hidratación y horario habitual de comidas.
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
});

