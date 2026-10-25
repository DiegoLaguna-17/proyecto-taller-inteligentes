import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ICONS, IconName } from './icons';

interface IconProps {
  name: IconName | string;
  size?: number;
  color?: string;
  style?: any;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = '#0F172A',
  style,
}) => {
  const rawSvg = (ICONS as Record<string, string>)[name];

  if (!rawSvg || rawSvg.trim() === '') {
    return (
      <View
        style={[
          styles.placeholder,
          { width: size, height: size, borderColor: color },
          style,
        ]}
      />
    );
  }

  // Replace currentColor with specified color
  const coloredSvg = rawSvg.replace(/currentColor/g, color);

  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <SvgXml xml={coloredSvg} width={size} height={size} />
    </View>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 4,
    opacity: 0.35,
  },
});

