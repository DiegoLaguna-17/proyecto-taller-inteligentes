import React, { useState } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

// Shared
import { BottomNavBar, NavTabId } from './src/shared/BottomNavBar';
import {
  CURRENT_USERS,
  UserRole,
  UserProfile,
  PatientSummary,
  AdminRequest,
  MOCK_DOCTOR_PATIENTS,
  MOCK_ADMIN_REQUESTS,
} from './src/utils/mockData';
import { COLORS } from './src/utils/colors';

// Screens
import { InicioSesion } from './src/screens/InicioSesion/InicioSesion';
import { SolicitudRegistro } from './src/screens/SolicitudRegistro/SolicitudRegistro';
import { InicioPaciente } from './src/screens/InicioPaciente/InicioPaciente';
import { RegistroToma } from './src/screens/RegistroToma/RegistroToma';
import { HistorialPaciente } from './src/screens/HistorialPaciente/HistorialPaciente';
import { ChatBot } from './src/screens/ChatBot/ChatBot';
import { PacientesMedico } from './src/screens/PacientesMedico/PacientesMedico';
import { DetallePaciente } from './src/screens/DetallePaciente/DetallePaciente';
import { ReportesMedico } from './src/screens/ReportesMedico/ReportesMedico';
import { AlertasMedico } from './src/screens/AlertasMedico/AlertasMedico';
import { SolicitudesAdmin } from './src/screens/SolicitudesAdmin/SolicitudesAdmin';
import { DetalleSolicitudAdmin } from './src/screens/DetalleSolicitudAdmin/DetalleSolicitudAdmin';
import { UsuariosAdmin } from './src/screens/UsuariosAdmin/UsuariosAdmin';
import { AuditoriaAdmin } from './src/screens/AuditoriaAdmin/AuditoriaAdmin';
import { PerfilUsuario } from './src/screens/PerfilUsuario/PerfilUsuario';

type AuthScreen = 'login' | 'register';

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // Current session state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');

  // Navigation tab state per role
  const [activeTab, setActiveTab] = useState<NavTabId>('Inicio');

  // Subscreen navigation state
  const [isRegistrarTomaOpen, setIsRegistrarTomaOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);
  const [selectedAdminRequest, setSelectedAdminRequest] = useState<AdminRequest | null>(null);
  const [reportPatientName, setReportPatientName] = useState<string>('Elena Soto');

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // --- Handlers ---
  const handleLoginSuccess = (role: UserRole) => {
    const user = CURRENT_USERS[role];
    setCurrentUser(user);
    if (role === 'paciente') {
      setActiveTab('Inicio');
    } else if (role === 'medico') {
      setActiveTab('Pacientes');
    } else if (role === 'admin') {
      setActiveTab('Solicitudes');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthScreen('login');
    setIsRegistrarTomaOpen(false);
    setSelectedPatient(null);
    setSelectedAdminRequest(null);
  };

  // --- Unauthenticated Flow ---
  if (!currentUser) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <StatusBar style="dark" />
          {authScreen === 'login' ? (
            <InicioSesion
              onLoginSuccess={handleLoginSuccess}
              onNavigateRegister={() => setAuthScreen('register')}
            />
          ) : (
            <SolicitudRegistro
              onBackToLogin={() => setAuthScreen('login')}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // --- Authenticated Flow per Role ---
  const renderScreen = () => {
    const role = currentUser.role;

    // PACIENTE FLOW
    if (role === 'paciente') {
      if (isRegistrarTomaOpen) {
        return (
          <RegistroToma
            onBack={() => setIsRegistrarTomaOpen(false)}
            onSaveSuccess={() => setIsRegistrarTomaOpen(false)}
          />
        );
      }

      switch (activeTab) {
        case 'Inicio':
          return (
            <InicioPaciente
              userName="Carlos"
              onNavigateRegistrarToma={() => setIsRegistrarTomaOpen(true)}
              onNavigateHistorial={() => setActiveTab('Historial')}
              onNavigateChatBot={() => setActiveTab('ChatBot')}
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
        case 'Historial':
          return (
            <HistorialPaciente
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
        case 'ChatBot':
          return (
            <ChatBot
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
        case 'Perfil':
          return (
            <PerfilUsuario
              user={currentUser}
              onLogout={handleLogout}
            />
          );
        default:
          return (
            <InicioPaciente
              userName="Carlos"
              onNavigateRegistrarToma={() => setIsRegistrarTomaOpen(true)}
              onNavigateHistorial={() => setActiveTab('Historial')}
              onNavigateChatBot={() => setActiveTab('ChatBot')}
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
      }
    }

    // MÉDICO FLOW
    if (role === 'medico') {
      if (selectedPatient) {
        return (
          <DetallePaciente
            patient={selectedPatient}
            onBack={() => setSelectedPatient(null)}
            onGenerateReport={(name) => {
              setReportPatientName(name);
              setSelectedPatient(null);
              setActiveTab('Reportes');
            }}
            onNavigatePerfil={() => setActiveTab('Perfil')}
          />
        );
      }

      switch (activeTab) {
        case 'Pacientes':
          return (
            <PacientesMedico
              onSelectPatient={(p) => setSelectedPatient(p)}
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
        case 'Alertas':
          return (
            <AlertasMedico
              onSelectPatient={(p) => setSelectedPatient(p)}
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
        case 'Reportes':
          return (
            <ReportesMedico
              initialPatientName={reportPatientName}
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
        case 'Perfil':
          return (
            <PerfilUsuario
              user={currentUser}
              onLogout={handleLogout}
            />
          );
        default:
          return (
            <PacientesMedico
              onSelectPatient={(p) => setSelectedPatient(p)}
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
      }
    }

    // ADMINISTRADOR FLOW
    if (role === 'admin') {
      if (selectedAdminRequest) {
        return (
          <DetalleSolicitudAdmin
            request={selectedAdminRequest}
            onBack={() => setSelectedAdminRequest(null)}
            onFinishAction={() => setSelectedAdminRequest(null)}
            onNavigatePerfil={() => setActiveTab('Perfil')}
          />
        );
      }

      switch (activeTab) {
        case 'Solicitudes':
          return (
            <SolicitudesAdmin
              onSelectRequest={(req) => setSelectedAdminRequest(req)}
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
        case 'Usuarios':
          return (
            <UsuariosAdmin
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
        case 'Auditoria':
          return (
            <AuditoriaAdmin
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
        case 'Perfil':
          return (
            <PerfilUsuario
              user={currentUser}
              onLogout={handleLogout}
            />
          );
        default:
          return (
            <SolicitudesAdmin
              onSelectRequest={(req) => setSelectedAdminRequest(req)}
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
      }
    }

    return null;
  };

  // Hide bottom navbar when viewing full sub-screens (e.g., RegistrarToma, DetallePaciente, DetalleSolicitud)
  const isViewingSubscreen =
    isRegistrarTomaOpen || Boolean(selectedPatient) || Boolean(selectedAdminRequest);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <View style={styles.mainContainer}>
          {renderScreen()}
        </View>

        {!isViewingSubscreen && (
          <BottomNavBar
            role={currentUser.role}
            activeTab={activeTab}
            onSelectTab={(tabId) => setActiveTab(tabId)}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.backgroundWhite,
  },
  mainContainer: {
    flex: 1,
  },
});
