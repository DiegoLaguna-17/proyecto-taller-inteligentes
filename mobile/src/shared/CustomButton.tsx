import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { COLORS } from '../utils/colors';
import { FONTS } from '../utils/typography';
import { Icon } from './Icon';
import { IconName } from './icons';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  iconLeft?: IconName | string;
  iconRight?: IconName | string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  let buttonBg = COLORS.primary;
  let textColor = '#FFFFFF';
  let borderColor = 'transparent';
  let borderWidth = 0;

  if (variant === 'secondary') {
    buttonBg = COLORS.primaryLight;
    textColor = COLORS.primary;
  } else if (variant === 'outline') {
    buttonBg = 'transparent';
    textColor = COLORS.textPrimary;
    borderColor = COLORS.border;
    borderWidth = 1.5;
  } else if (variant === 'ghost') {
    buttonBg = 'transparent';
    textColor = COLORS.primary;
  } else if (variant === 'danger') {
    buttonBg = COLORS.riesgoHiper;
    textColor = '#FFFFFF';
  }

  const height = size === 'sm' ? 40 : size === 'lg' ? 56 : 48;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 15;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: buttonBg,
          height,
          borderColor,
          borderWidth,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {iconLeft && (
            <Icon
              name={iconLeft}
              size={18}
              color={textColor}
              style={{ marginRight: 8 }}
            />
          )}
          <Text
            style={[
              styles.text,
              {
                color: textColor,
                fontSize,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {iconRight && (
            <Icon
              name={iconRight}
              size={18}
              color={textColor}
              style={{ marginLeft: 8 }}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: FONTS.bold,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});

