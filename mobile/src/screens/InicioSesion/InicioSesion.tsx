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
import { LoginForm } from './components/LoginForm';
import { RoleQuickSelect } from './components/RoleQuickSelect';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { UserRole } from '../../utils/mockData';

interface InicioSesionProps {
  onLoginSuccess: (role: UserRole) => void;
  onNavigateRegister: () => void;
}

export const InicioSesion: React.FC<InicioSesionProps> = ({
  onLoginSuccess,
  onNavigateRegister,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = () => {
    setErrorMessage('');
    const cleanEmail = email.trim().toLowerCase();

    // Check credentials as per instructions
    if (cleanEmail === 'carlos@email.com' && password === '12345') {
      onLoginSuccess('paciente');
    } else if (
      (cleanEmail === 'doctor@email.com' || cleanEmail === 'carmen@email.com') &&
      password === '12345'
    ) {
      onLoginSuccess('medico');
    } else if (
      (cleanEmail === 'admin@email.com' || cleanEmail === 'mariana@email.com') &&
      password === '12345'
    ) {
      onLoginSuccess('admin');
    } else {
      // Generic message without revealing field
      setErrorMessage('Credenciales inválidas. Por favor verifique sus datos.');
    }
  };

  const handleQuickSelect = (role: UserRole) => {
    if (role === 'paciente') {
      setEmail('carlos@email.com');
      setPassword('12345');
      onLoginSuccess('paciente');
    } else if (role === 'medico') {
      setEmail('doctor@email.com');
      setPassword('12345');
      onLoginSuccess('medico');
    } else if (role === 'admin') {
      setEmail('admin@email.com');
      setPassword('12345');
      onLoginSuccess('admin');
    }
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
        {/* Logo and Brand */}
        <View style={styles.headerSection}>
          <View style={styles.logoBadge}>
            <Icon name="logoDrop" size={44} color={COLORS.primary} />
          </View>
          <Text style={styles.brandTitle}>GlucoTracker</Text>
          <Text style={styles.brandSubtitle}>Monitoreo clínico de glucosa</Text>
        </View>

        {/* Card Form */}
        <LoginForm
          email={email}
          setEmail={setEmail}
          pass={password}
          setPass={setPassword}
          error={errorMessage}
          onLogin={handleLogin}
        />

        {/* Clinical Grade Encryption Badge */}
        <View style={styles.securityRow}>
          <Icon name="shieldCheck" size={16} color={COLORS.textSecondary} />
          <Text style={styles.securityText}>Conexión cifrada de grado clínico</Text>
        </View>

        {/* Link to Register */}
        <View style={styles.registerRow}>
          <Text style={styles.noAccountText}>¿No tienes cuenta? </Text>
          <TouchableOpacity onPress={onNavigateRegister} activeOpacity={0.7}>
            <Text style={styles.registerLink}>Solicitar registro</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Test Helper for Expo Go */}
        <RoleQuickSelect onSelectRole={handleQuickSelect} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  brandTitle: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 6,
  },
  securityText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  noAccountText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  registerLink: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.primary,
  },
});

