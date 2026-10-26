import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export const ChatDisclaimer: React.FC = () => {
  return (
    <View style={styles.banner} testID="chat-aviso">
      <Icon name="info" size={16} color={COLORS.primary} style={styles.icon} />
      <Text style={styles.text}>
        Este asistente no reemplaza el consejo médico directo. En emergencias, llama a
        tu especialista.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },
});

