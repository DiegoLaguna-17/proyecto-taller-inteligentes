import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface RecomendacionCardProps {
  text?: string;
}

export const RecomendacionCard: React.FC<RecomendacionCardProps> = ({
  text = 'Una lectura postprandial debe realizarse 2 horas exactas tras iniciar la primera ingesta.',
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Icon name="pill" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.contentCol}>
        <Text style={styles.title}>RECOMENDACIÓN CLÍNICA</Text>
        <Text style={styles.body}>{text}</Text>
      </View>
    </View>
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
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentCol: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },
});

