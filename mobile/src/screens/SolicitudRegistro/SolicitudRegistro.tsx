import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Icon } from '../../shared/Icon';
import { InputField } from '../../shared/InputField';
import { CustomButton } from '../../shared/CustomButton';
import { SwitchPerfil } from './components/SwitchPerfil';
import { MatriculaCard } from './components/MatriculaCard';
import { SuccessModal } from './components/SuccessModal';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';

interface SolicitudRegistroProps {
  onBackToLogin: () => void;
}

export const SolicitudRegistro: React.FC<SolicitudRegistroProps> = ({
  onBackToLogin,
}) => {
  const [role, setRole] = useState<'Paciente' | 'Médico'>('Médico');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [license, setLicense] = useState('');
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'El nombre completo es requerido';
    if (!email.trim()) newErrors.email = 'El correo es requerido';
    if (!password.trim() || password.length < 8) {
      newErrors.password = 'Mínimo 8 caracteres alfanuméricos.';
    }
    if (role === 'Médico' && !license.trim()) {
      newErrors.license = 'La matrícula es obligatoria para médicos';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSuccessModalVisible(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Bar */}
        <View style={styles.brandRow}>
          <Icon name="logoDrop" size={20} color={COLORS.primary} />
          <Text style={styles.brandText}>GLUCOTRACKER</Text>
        </View>

        <Text style={styles.title}>Solicitud de registro</Text>
        <Text style={styles.subtitle}>
          Completa el formulario para solicitar tu acceso al sistema.
        </Text>

        {/* Role Switcher */}
        <SwitchPerfil selectedRole={role} onSelectRole={setRole} />

        {/* Inputs */}
        <InputField
          label="Nombre completo"
          placeholder="Ej. Dra. Carmen Silva o Carlos Ruiz"
          value={fullName}
          onChangeText={setFullName}
          leftIcon="idCard"
          error={errors.fullName}
        />

        <InputField
          label="Correo electrónico"
          placeholder="nombre@ejemplo.com"
          value={email}
          onChangeText={setEmail}
          leftIcon="mail"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
        />

        <InputField
          label="Contraseña"
          placeholder="••••••••••••"
          value={password}
          onChangeText={setPassword}
          leftIcon="lock"
          isPassword
          helperText="Mínimo 8 caracteres alfanuméricos."
          error={errors.password}
        />

        {/* Matricula card for Medico */}
        {role === 'Médico' && (
          <MatriculaCard
            license={license}
            setLicense={setLicense}
            error={errors.license}
          />
        )}

        {/* Submit button */}
        <CustomButton
          title="Enviar solicitud"
          onPress={handleSubmit}
          iconLeft="send"
          style={styles.submitBtn}
        />

        {/* Back Link */}
        <TouchableOpacity
          style={styles.backRow}
          onPress={onBackToLogin}
          activeOpacity={0.7}
        >
          <Icon name="arrowLeft" size={16} color={COLORS.primary} />
          <Text style={styles.backText}>Volver a Iniciar sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Success Modal */}
      <SuccessModal
        visible={isSuccessModalVisible}
        onClose={() => {
          setIsSuccessModalVisible(false);
          onBackToLogin();
        }}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: COLORS.backgroundWhite,
  },
  scrollContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  brandText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  submitBtn: {
    marginTop: 8,
    marginBottom: 20,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  backText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.primary,
  },
});

