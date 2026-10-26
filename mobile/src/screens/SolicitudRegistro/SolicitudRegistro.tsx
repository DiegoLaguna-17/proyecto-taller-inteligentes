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
import { SolicitudPacienteForm } from './components/SolicitudPacienteForm';
import { SolicitudMedicoForm } from './components/SolicitudMedicoForm';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { FUENTE } from '../../utils/medidas';

interface SolicitudRegistroProps {
  onBackToLogin: () => void;
}

export const SolicitudRegistro: React.FC<SolicitudRegistroProps> = ({
  onBackToLogin,
}) => {
  const [role, setRole] = useState<'Paciente' | 'Médico'>('Paciente');
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

        {role === 'Paciente' ? (
          <SolicitudPacienteForm onSuccess={() => setIsSuccessModalVisible(true)} />
        ) : (
          <SolicitudMedicoForm onSuccess={() => setIsSuccessModalVisible(true)} />
        )}

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
        descripcion={
          role === 'Paciente'
            ? 'Tu solicitud fue registrada correctamente. Si no puedes iniciar sesión todavía, tu cuenta puede estar pendiente de aprobación.'
            : 'Tu solicitud fue registrada correctamente. Si aún no puedes iniciar sesión, tu cuenta puede estar pendiente de aprobación de un administrador.'
        }
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
    fontSize: FUENTE.tituloGrande,
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

