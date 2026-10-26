import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export const ConsejoClinicoCard: React.FC = () => {
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Icon name="info" size={18} color={COLORS.primary} />
      </View>
      <View style={styles.contentCol}>
        <Text style={styles.title}>Consejo Clínico</Text>
        <Text style={styles.body}>
          Los valores postprandiales se estabilizan dentro de los 90 min con
          caminatas de 10 min.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },
});

