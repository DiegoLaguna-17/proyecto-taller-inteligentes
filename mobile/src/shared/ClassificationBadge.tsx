import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, ClassificationType } from '../utils/colors';
import { FONTS } from '../utils/typography';

interface ClassificationBadgeProps {
  classification: ClassificationType | string;
  showDot?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ClassificationBadge: React.FC<ClassificationBadgeProps> = ({
  classification,
  showDot = true,
  size = 'md',
}) => {
  let bgColor = COLORS.normalBg;
  let textColor = COLORS.normalText;
  let dotColor = COLORS.normal;

  if (classification === 'Riesgo Hipo') {
    bgColor = COLORS.riesgoHipoBg;
    textColor = COLORS.riesgoHipoText;
    dotColor = COLORS.riesgoHipo;
  } else if (classification === 'Riesgo Hiper') {
    bgColor = COLORS.riesgoHiperBg;
    textColor = COLORS.riesgoHiperText;
    dotColor = COLORS.riesgoHiper;
  }

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          paddingVertical: isSmall ? 3 : isLarge ? 6 : 4,
          paddingHorizontal: isSmall ? 8 : isLarge ? 12 : 10,
        },
      ]}
    >
      {showDot && (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: dotColor,
              width: isSmall ? 5 : 6,
              height: isSmall ? 5 : 6,
            },
          ]}
        />
      )}
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: isSmall ? 11 : isLarge ? 13 : 12,
          },
        ]}
      >
        {classification}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  dot: {
    borderRadius: 999,
    marginRight: 6,
  },
  text: {
    fontFamily: FONTS.semiBold,
    letterSpacing: -0.2,
  },
});

