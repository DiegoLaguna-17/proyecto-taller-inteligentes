import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardTypeOptions,
} from 'react-native';
import { COLORS } from '../utils/colors';
import { FONTS } from '../utils/typography';
import { Icon } from './Icon';
import { IconName } from './icons';

interface InputFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  leftIcon?: IconName | string;
  isPassword?: boolean;
  rightLabelText?: string;
  onRightLabelPress?: () => void;
  helperText?: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  maxLength?: number;
  /** Identificador de prueba del campo; el mensaje de error usa `${testID}-error`. */
  testID?: string;
  /** Identificador del mensaje de error (por defecto `${testID}-error`). */
  errorTestID?: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  leftIcon,
  isPassword = false,
  rightLabelText,
  onRightLabelPress,
  helperText,
  error,
  keyboardType = 'default',
  autoCapitalize = 'none',
  editable = true,
  maxLength,
  testID,
  errorTestID,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      {(label || rightLabelText) && (
        <View style={styles.labelRow}>
          {label ? <Text style={styles.label}>{label}</Text> : <View />}
          {rightLabelText && (
            <TouchableOpacity onPress={onRightLabelPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={rightLabelText}>
              <Text style={styles.rightLabel}>{rightLabelText}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View
        style={[
          styles.inputContainer,
          error ? styles.inputError : null,
          !editable ? styles.inputDisabled : null,
        ]}
      >
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <Icon name={leftIcon} size={20} color={COLORS.textSecondary} />
          </View>
        )}

        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={isPassword && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          maxLength={maxLength}
          testID={testID}
          accessibilityLabel={label || placeholder}
        />

        {isPassword && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <Icon
              name={showPassword ? 'eyeOff' : 'eye'}
              size={20}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text style={styles.errorText} testID={errorTestID ?? (testID ? `${testID}-error` : undefined)}>
          {error}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  rightLabel: {
    flexShrink: 1,
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    height: 52,
  },
  inputError: {
    borderColor: COLORS.riesgoHiper,
    backgroundColor: COLORS.riesgoHiperBg,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  leftIconContainer: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  rightIconContainer: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.riesgoHiperText,
    marginTop: 4,
    marginLeft: 4,
  },
  helperText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    marginLeft: 4,
  },
});

