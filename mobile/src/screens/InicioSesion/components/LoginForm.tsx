import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { InputField } from '../../../shared/InputField';
import { CustomButton } from '../../../shared/CustomButton';
import { COLORS } from '../../../utils/colors';

interface LoginFormProps {
  email: string;
  setEmail: (val: string) => void;
  pass: string;
  setPass: (val: string) => void;
  error?: string;
  onLogin: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  email,
  setEmail,
  pass,
  setPass,
  error,
  onLogin,
}) => {
  return (
    <View style={styles.card}>
      <InputField
        label="Correo electrónico"
        placeholder="ejemplo@correo.com"
        value={email}
        onChangeText={setEmail}
        leftIcon="mail"
        keyboardType="email-address"
        autoCapitalize="none"
        error={error}
      />

      <InputField
        label="Contraseña"
        placeholder="••••••••"
        value={pass}
        onChangeText={setPass}
        leftIcon="lock"
        isPassword
        rightLabelText="¿Olvidaste tu contraseña?"
        onRightLabelPress={() => {
          Alert.alert(
            'Recuperar contraseña',
            'Por favor contacta al administrador del sistema para restablecer tu contraseña.'
          );
        }}
      />

      <CustomButton
        title="Iniciar sesión"
        onPress={onLogin}
        iconRight="arrowRight"
        style={styles.loginBtn}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
  },
  loginBtn: {
    marginTop: 8,
  },
});

