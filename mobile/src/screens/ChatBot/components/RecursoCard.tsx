import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface RecursoCardProps {
  onPress?: () => void;
}

export const RecursoCard: React.FC<RecursoCardProps> = ({ onPress }) => {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.iconCircle}>
        <Icon name="book" size={20} color={COLORS.primary} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>Guía rápida de carbohidratos</Text>
        <Text style={styles.subtitle}>Aprende a contar raciones diarias</Text>
      </View>
      <View style={styles.arrowCircle}>
        <Icon name="arrowRight" size={16} color={COLORS.primary} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
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
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

