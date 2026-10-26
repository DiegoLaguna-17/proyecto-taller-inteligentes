import React, { useState, useRef } from 'react';
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
import { OtpForm } from './components/OtpForm';
import { RoleQuickSelect } from './components/RoleQuickSelect';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { tomarTurno, liberarTurno } from '../../utils/turno';
import { FUENTE } from '../../utils/medidas';
import { UserRole } from '../../utils/tipos';
import { USE_MOCK } from '../../services/config';
import { iniciarSesion, verificarOtp, SesionUsuario } from '../../services/auth';
import { mensajeDeError } from '../../services/http';

interface InicioSesionProps {
  onLoginSuccess: (sesion: SesionUsuario) => void;
  onNavigateRegister: () => void;
  /** Mensaje informativo al abrir el login (p. ej. la sesión guardada ya no era válida). */
  aviso?: string;
}

// Sesión de ejemplo del modo simulado (EXPO_PUBLIC_USE_MOCK=true): no hay backend ni ids reales.
const sesionSimulada = (rol: UserRole): SesionUsuario => ({ id_usuario: 1, id_rol: 1, rol });

export const InicioSesion: React.FC<InicioSesionProps> = ({
  onLoginSuccess,
  onNavigateRegister,
  aviso,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [paso, setPaso] = useState<'credenciales' | 'otp'>('credenciales');
  const [idUsuario, setIdUsuario] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const turno = useRef(false); // guarda síncrona contra el doble toque
  const [errorMessage, setErrorMessage] = useState('');

  // Paso 1: correo y contraseña -> el backend envía un OTP por correo
  const handleLogin = async () => {
    setErrorMessage('');
    const cleanEmail = email.trim().toLowerCase();

    if (USE_MOCK) {
      // Modo simulado: credenciales fijas, solo con EXPO_PUBLIC_USE_MOCK=true
      if (cleanEmail === 'carlos@email.com' && password === '12345') {
        onLoginSuccess(sesionSimulada('paciente'));
      } else if (
        (cleanEmail === 'doctor@email.com' || cleanEmail === 'carmen@email.com') &&
        password === '12345'
      ) {
        onLoginSuccess(sesionSimulada('medico'));
      } else if (
        (cleanEmail === 'admin@email.com' || cleanEmail === 'mariana@email.com') &&
        password === '12345'
      ) {
        onLoginSuccess(sesionSimulada('admin'));
      } else {
        setErrorMessage('Credenciales inválidas. Por favor verifique sus datos.');
      }
      return;
    }

    if (!cleanEmail || !password) {
      setErrorMessage('Ingresa tu correo y tu contraseña.');
      return;
    }
    if (!tomarTurno(turno)) return;
    setCargando(true);
    try {
      const { id_usuario } = await iniciarSesion(cleanEmail, password);
      setIdUsuario(id_usuario);
      setCodigo('');
      setPaso('otp');
    } catch (e) {
      setErrorMessage(mensajeDeError(e));
    } finally {
      setCargando(false);
      liberarTurno(turno);
    }
  };

  // Paso 2: código de 6 dígitos -> sesión
  const handleVerificar = async () => {
    setErrorMessage('');
    if (!/^\d{6}$/.test(codigo.trim()) || idUsuario === null) {
      setErrorMessage('Ingresa el código de 6 dígitos que enviamos a tu correo.');
      return;
    }
    if (!tomarTurno(turno)) return;
    setCargando(true);
    try {
      const sesion = await verificarOtp(idUsuario, codigo);
      setPassword('');
      onLoginSuccess(sesion);
    } catch (e) {
      setErrorMessage(mensajeDeError(e));
    } finally {
      setCargando(false);
      liberarTurno(turno);
    }
  };

  const handleVolver = () => {
    setPaso('credenciales');
    setCodigo('');
    setPassword('');
    setIdUsuario(null);
    setErrorMessage('');
  };

  const handleQuickSelect = (role: UserRole) => {
    // Modo simulado: acceso rápido por rol (solo con EXPO_PUBLIC_USE_MOCK=true)
    onLoginSuccess(sesionSimulada(role));
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

        {aviso ? (
          <View style={styles.avisoBox} accessibilityRole="alert">
            <Text style={styles.avisoText} testID="login-aviso">{aviso}</Text>
          </View>
        ) : null}

        {/* Card Form */}
        {paso === 'credenciales' ? (
          <LoginForm
            email={email}
            setEmail={setEmail}
            pass={password}
            setPass={setPassword}
            error={errorMessage}
            loading={cargando}
            onLogin={handleLogin}
          />
        ) : (
          <OtpForm
            codigo={codigo}
            setCodigo={setCodigo}
            error={errorMessage}
            loading={cargando}
            onVerificar={handleVerificar}
            onVolver={handleVolver}
          />
        )}

        {/* Link to Register */}
        <View style={styles.registerRow}>
          <Text style={styles.noAccountText}>¿No tienes cuenta? </Text>
          <TouchableOpacity
            onPress={onNavigateRegister}
            activeOpacity={0.7}
            testID="login-solicitar-registro"
          >
            <Text style={styles.registerLink}>Solicitar registro</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Test Helper for Expo Go: solo en modo simulado */}
        {USE_MOCK && <RoleQuickSelect onSelectRole={handleQuickSelect} />}
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
    fontSize: FUENTE.tituloGrande,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  avisoBox: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    padding: 12,
    marginBottom: 16,
  },
  avisoText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textPrimary,
    textAlign: 'center',
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

