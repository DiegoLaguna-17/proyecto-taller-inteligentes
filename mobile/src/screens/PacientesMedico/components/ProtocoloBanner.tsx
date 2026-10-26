import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface ProtocoloBannerProps {
  onPressGuide?: () => void;
}

export const ProtocoloBanner: React.FC<ProtocoloBannerProps> = ({
  onPressGuide,
}) => {
  return (
    <View style={styles.banner}>
      <View style={styles.left}>
        <Icon name="firstAidKit" size={18} color={COLORS.primary} />
        <Text style={styles.title}>Protocolo de Glucemia Activo</Text>
      </View>
      <TouchableOpacity onPress={onPressGuide} activeOpacity={0.7}>
        <Text style={styles.guideText}>Ver Guía</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  guideText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
});

