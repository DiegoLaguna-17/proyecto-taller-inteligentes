import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { InputField } from '../../../shared/InputField';
import { CustomButton } from '../../../shared/CustomButton';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface OtpFormProps {
  codigo: string;
  setCodigo: (val: string) => void;
  error?: string;
  loading?: boolean;
  onVerificar: () => void;
  onVolver: () => void;
}

// Paso 2 del login: código de 6 dígitos que el backend envió por correo.
export const OtpForm: React.FC<OtpFormProps> = ({
  codigo,
  setCodigo,
  error,
  loading = false,
  onVerificar,
  onVolver,
}) => {
  return (
    <View style={styles.card}>
      <Text style={styles.intro}>
        Enviamos un código de 6 dígitos a tu correo. Ingrésalo para continuar.
      </Text>

      <InputField
        label="Código de verificación"
        placeholder="000000"
        value={codigo}
        onChangeText={(texto) => setCodigo(texto.replace(/\D/g, ''))}
        leftIcon="lock"
        keyboardType="number-pad"
        maxLength={6}
        error={error}
        testID="login-otp"
        errorTestID="login-otp-error"
      />

      <CustomButton
        title="Verificar código"
        onPress={onVerificar}
        loading={loading}
        testID="login-verificar"
        iconRight="arrowRight"
        style={styles.btn}
      />
      <CustomButton
        title="Volver"
        onPress={onVolver}
        variant="ghost"
        disabled={loading}
        testID="login-volver"
        style={styles.btn}
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
  intro: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  btn: {
    marginTop: 8,
  },
});
