import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface ContactoClinicoFooterProps {
  doctorName?: string;
}

export const ContactoClinicoFooter: React.FC<ContactoClinicoFooterProps> = ({
  doctorName = 'Dra. Morales',
}) => {
  return (
    <View style={styles.container}>
      <Icon name="phone" size={14} color={COLORS.textSecondary} />
      <Text style={styles.text}>
        Contacto clínico rápido asignado: {doctorName}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 20,
  },
  text: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

