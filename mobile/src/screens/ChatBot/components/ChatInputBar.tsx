import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface ChatInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  maxLength?: number;
  /** Bloquea el envío mientras llega la respuesta. */
  disabled?: boolean;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  value,
  onChangeText,
  onSend,
  maxLength,
  disabled = false,
}) => {
  // Enviar solo con texto y sin otro envío en curso
  const puedeEnviar = !disabled && value.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.inputBox}>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          placeholder="Escribe tu consulta aquí..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={maxLength}
          testID="chat-entrada"
          accessibilityLabel="Escribe tu consulta"
        />
      </View>

      <TouchableOpacity
        style={[styles.sendBtn, { opacity: puedeEnviar ? 1 : 0.5 }]}
        onPress={onSend}
        activeOpacity={0.8}
        disabled={!puedeEnviar}
        testID="chat-enviar"
        accessibilityRole="button"
        accessibilityLabel="Enviar consulta"
        accessibilityState={{ disabled: !puedeEnviar, busy: disabled }}
      >
        <Icon name="send" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.backgroundWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: 10,
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceInput,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 6,
    minHeight: 46,
  },
  textInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    maxHeight: 90,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
