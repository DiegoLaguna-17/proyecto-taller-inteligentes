import React, { useEffect, useState } from 'react';
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
import type { UserRole, UserProfile } from './src/utils/tipos';
import { COLORS } from './src/utils/colors';
import { ANCHO_MAXIMO_CONTENIDO } from './src/utils/medidas';

// Servicios (sesión real contra el backend; ver design.md § App móvil: integración)
import { USE_MOCK } from './src/services/config';
import { SesionUsuario } from './src/services/auth';
import { guardarSesion, leerSesion, borrarSesion } from './src/services/sesion';
import { PerfilPaciente, obtenerPerfil } from './src/services/paciente';
import { PerfilMedico, PacienteMedico, obtenerPerfilMedico, obtenerPacientesMedico } from './src/services/medico';
import { iniciales as inicialesDe } from './src/services/medicoVista';
import { PerfilAdmin, UsuarioAdmin, obtenerPerfilAdmin } from './src/services/administrador';
import { esRecursoInexistente, mensajeDeError } from './src/services/http';

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
import { EditarPaciente } from './src/screens/EditarPaciente/EditarPaciente';
import { EditarMedico } from './src/screens/EditarMedico/EditarMedico';
import { RegistroTomaMedico } from './src/screens/RegistroTomaMedico/RegistroTomaMedico';

type AuthScreen = 'login' | 'register';

const tabInicial = (rol: UserRole): NavTabId =>
  rol === 'paciente' ? 'Inicio' : rol === 'medico' ? 'Pacientes' : 'Solicitudes';

// El login solo devuelve ids y rol: cada rol carga su perfil real tras entrar; si falla, queda un perfil genérico.
// En modo simulado se usan los perfiles de ejemplo de mockData.
const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || 'P';

const perfilDeSesion = (
  s: SesionUsuario,
  perfil: PerfilPaciente | null,
  perfilMedico: PerfilMedico | null,
  perfilAdmin: PerfilAdmin | null,
): UserProfile => {
  // Administrador con perfil cargado: nombre, correo, teléfono y cargo reales
  if (s.rol === 'admin' && perfilAdmin && perfilAdmin.nombre) {
    return {
      id: String(s.id_rol),
      name: perfilAdmin.nombre,
      email: perfilAdmin.correo ?? '',
      phone: perfilAdmin.telefono ?? undefined,
      role: 'admin',
      initials: inicialesDe(perfilAdmin.nombre),
      badge: 'Administrador',
      subtitle: perfilAdmin.cargo ?? undefined,
    };
  }
  // Médico con perfil cargado: nombre, correo, teléfono y especialidad reales
  if (s.rol === 'medico' && perfilMedico && perfilMedico.nombre) {
    return {
      id: String(s.id_rol),
      name: perfilMedico.nombre,
      email: perfilMedico.correo ?? '',
      phone: perfilMedico.telefono ?? undefined,
      role: 'medico',
      initials: inicialesDe(perfilMedico.nombre),
      badge: 'Médico',
      subtitle: perfilMedico.especialidad ?? undefined,
    };
  }
  // Paciente con perfil cargado: nombre, correo, teléfono y foto reales
  if (s.rol === 'paciente' && perfil && perfil.nombre) {
    return {
      id: String(s.id_rol),
      name: perfil.nombre,
      email: perfil.correo ?? '',
      phone: perfil.telefono ?? undefined,
      role: 'paciente',
      initials: iniciales(perfil.nombre),
      avatarUrl: perfil.fotoPerfil ?? undefined,
      badge: 'Paciente',
    };
  }
  // Los perfiles de ejemplo se cargan solo en modo simulado (con el modo apagado el módulo no se evalúa)
  if (USE_MOCK) return (require('./src/utils/mockData') as typeof import('./src/utils/mockData')).CURRENT_USERS[s.rol];
  const etiqueta = s.rol === 'paciente' ? 'Paciente' : s.rol === 'medico' ? 'Médico' : 'Administrador';
  return {
    id: String(s.id_rol),
    name: etiqueta,
    email: '',
    role: s.rol,
    initials: etiqueta.slice(0, 2).toUpperCase(),
    badge: etiqueta,
  };
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // Current session state (ids y rol que devuelve POST /api/verify-otp; no hay token)
  const [sesion, setSesion] = useState<SesionUsuario | null>(null);
  const [restaurando, setRestaurando] = useState(!USE_MOCK);
  // Perfil real del paciente (solo en memoria; el almacenamiento seguro guarda únicamente ids y rol)
  const [perfil, setPerfil] = useState<PerfilPaciente | null>(null);
  const [isEditarPerfilOpen, setIsEditarPerfilOpen] = useState(false);
  // Médico: perfil real y pacientes (compartidos por Pacientes, Alertas y Reportes)
  const [perfilMedico, setPerfilMedico] = useState<PerfilMedico | null>(null);
  const [pacientesMedico, setPacientesMedico] = useState<PacienteMedico[] | null>(null);
  const [cargandoPacientes, setCargandoPacientes] = useState(false);
  const [errorPacientes, setErrorPacientes] = useState('');
  const [isEditarMedicoOpen, setIsEditarMedicoOpen] = useState(false);
  // Administrador: perfil real
  const [perfilAdmin, setPerfilAdmin] = useState<PerfilAdmin | null>(null);
  const currentUser: UserProfile | null = sesion ? perfilDeSesion(sesion, perfil, perfilMedico, perfilAdmin) : null;
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  // Aviso en el login cuando se cierra la sesión por una causa que no eligió el usuario
  const [avisoLogin, setAvisoLogin] = useState('');
  // true mientras se pide el perfil del rol (el perfil muestra «cargando» y, si falla, un botón de reintento)
  const [cargandoPerfil, setCargandoPerfil] = useState(false);

  // Navigation tab state per role
  const [activeTab, setActiveTab] = useState<NavTabId>('Inicio');

  // Subscreen navigation state
  const [isRegistrarTomaOpen, setIsRegistrarTomaOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PacienteMedico | null>(null);
  const [selectedAdminRequest, setSelectedAdminRequest] = useState<UsuarioAdmin | null>(null);
  const [reportPatientId, setReportPatientId] = useState<number | null>(null);
  // Médico: paciente por quien se registra una toma (solo pacientes de misPacientes)
  const [registrandoPaciente, setRegistrandoPaciente] = useState<PacienteMedico | null>(null);

  // Restaura la sesión guardada al abrir la app (no aplica en modo simulado)
  useEffect(() => {
    if (USE_MOCK) return;
    leerSesion().then((guardada) => {
      if (guardada) {
        setSesion(guardada);
        setActiveTab(tabInicial(guardada.rol));
      }
      setRestaurando(false);
    });
  }, []);

  // Carga el perfil del paciente tras el login (o al restaurar la sesión). Si falla, queda el nombre genérico.
  const cargarPerfil = (s: SesionUsuario) => {
    setCargandoPerfil(true);
    obtenerPerfil(s.id_rol)
      .then(setPerfil)
      .catch((e) => {
        setPerfil(null);
        if (esRecursoInexistente(e)) cerrarPorSesionInvalida();
      })
      .finally(() => setCargandoPerfil(false));
  };

  // Médico: perfil (por id_usuario) y pacientes (por id_medico = id_rol). Si fallan, texto genérico / lista con error.
  const cargarPerfilMedico = (s: SesionUsuario) => {
    setCargandoPerfil(true);
    obtenerPerfilMedico(s.id_usuario)
      .then(setPerfilMedico)
      .catch((e) => {
        setPerfilMedico(null);
        if (esRecursoInexistente(e)) cerrarPorSesionInvalida();
      })
      .finally(() => setCargandoPerfil(false));
  };

  const cargarPacientesMedico = (s: SesionUsuario) => {
    setCargandoPacientes(true);
    setErrorPacientes('');
    obtenerPacientesMedico(s.id_rol)
      .then(setPacientesMedico)
      .catch((e) => setErrorPacientes(mensajeDeError(e)))
      .finally(() => setCargandoPacientes(false));
  };

  const cargarPerfilAdmin = (s: SesionUsuario) => {
    setCargandoPerfil(true);
    obtenerPerfilAdmin(s.id_usuario)
      .then(setPerfilAdmin)
      .catch((e) => {
        setPerfilAdmin(null);
        if (esRecursoInexistente(e)) cerrarPorSesionInvalida();
      })
      .finally(() => setCargandoPerfil(false));
  };

  useEffect(() => {
    if (sesion && sesion.rol === 'admin') {
      cargarPerfilAdmin(sesion);
    } else {
      setPerfilAdmin(null);
    }
    if (sesion && sesion.rol === 'paciente') {
      cargarPerfil(sesion);
    } else {
      setPerfil(null);
    }
    if (sesion && sesion.rol === 'medico') {
      cargarPerfilMedico(sesion);
      cargarPacientesMedico(sesion);
    } else {
      setPerfilMedico(null);
      setPacientesMedico(null);
    }
  }, [sesion]);

  const handleLogout = () => {
    setSesion(null);
    setPerfil(null);
    setIsEditarPerfilOpen(false);
    setPerfilMedico(null);
    setPacientesMedico(null);
    setIsEditarMedicoOpen(false);
    setReportPatientId(null);
    setRegistrandoPaciente(null);
    setPerfilAdmin(null);
    borrarSesion();
    setAuthScreen('login');
    setActiveTab('Inicio');
    setIsRegistrarTomaOpen(false);
    setSelectedPatient(null);
    setSelectedAdminRequest(null);
  };

  // El servidor ya no reconoce el rol o el id guardados (404 al cargar el perfil): se cierra la sesión y se avisa.
  // Un error de red NO cierra la sesión.
  const cerrarPorSesionInvalida = () => {
    handleLogout();
    setAvisoLogin('Tu sesión ya no es válida. Inicia sesión de nuevo.');
  };

  if (!fontsLoaded || restaurando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // --- Handlers ---
  const handleLoginSuccess = (nueva: SesionUsuario) => {
    setAvisoLogin('');
    setSesion(nueva);
    setActiveTab(tabInicial(nueva.rol));
    if (!USE_MOCK) guardarSesion(nueva);
  };


  // --- Unauthenticated Flow ---
  if (!currentUser || !sesion) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <StatusBar style="dark" />
          <View style={styles.contenido}>
            {authScreen === 'login' ? (
              <InicioSesion
                onLoginSuccess={handleLoginSuccess}
                onNavigateRegister={() => setAuthScreen('register')}
                aviso={avisoLogin}
              />
            ) : (
              <SolicitudRegistro
                onBackToLogin={() => setAuthScreen('login')}
              />
            )}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // --- Authenticated Flow per Role ---
  const renderScreen = () => {
    const role = currentUser.role;

    // PACIENTE FLOW
    if (role === 'paciente') {
      if (isEditarPerfilOpen && perfil) {
        return (
          <EditarPaciente
            perfil={perfil}
            onBack={() => setIsEditarPerfilOpen(false)}
            onGuardado={() => {
              setIsEditarPerfilOpen(false);
              cargarPerfil(sesion);
            }}
          />
        );
      }

      if (isRegistrarTomaOpen) {
        return (
          <RegistroToma
            idPaciente={sesion.id_rol}
            onBack={() => setIsRegistrarTomaOpen(false)}
            onSaveSuccess={() => setIsRegistrarTomaOpen(false)}
          />
        );
      }

      switch (activeTab) {
        case 'Inicio':
          return (
            <InicioPaciente
              idPaciente={sesion.id_rol}
              nombre={perfil?.nombre ? perfil.nombre.split(/\s+/)[0] : null}
              nombreMedico={perfil?.nombreMedico ?? null}
              onNavigateRegistrarToma={() => setIsRegistrarTomaOpen(true)}
              onNavigateHistorial={() => setActiveTab('Historial')}
              onNavigateChatBot={() => setActiveTab('ChatBot')}
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
        case 'Historial':
          return (
            <HistorialPaciente
              idPaciente={sesion.id_rol}
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
              idPaciente={sesion.id_rol}
              perfil={perfil}
              onEditar={() => setIsEditarPerfilOpen(true)}
              cargandoPerfil={cargandoPerfil}
              onReintentarPerfil={() => cargarPerfil(sesion)}
              onLogout={handleLogout}
            />
          );
        default:
          return (
            <InicioPaciente
              idPaciente={sesion.id_rol}
              nombre={perfil?.nombre ? perfil.nombre.split(/\s+/)[0] : null}
              nombreMedico={perfil?.nombreMedico ?? null}
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
      if (isEditarMedicoOpen && perfilMedico) {
        return (
          <EditarMedico
            idMedico={sesion.id_rol}
            perfil={perfilMedico}
            onBack={() => setIsEditarMedicoOpen(false)}
            onGuardado={() => {
              setIsEditarMedicoOpen(false);
              cargarPerfilMedico(sesion);
            }}
          />
        );
      }

      if (registrandoPaciente) {
        return (
          <RegistroTomaMedico
            paciente={registrandoPaciente}
            idMedico={sesion.id_rol}
            onBack={() => setRegistrandoPaciente(null)}
            // Al volver, DetallePaciente se monta de nuevo y recarga el historial
            onGuardado={() => setRegistrandoPaciente(null)}
          />
        );
      }

      if (selectedPatient) {
        return (
          <DetallePaciente
            paciente={selectedPatient}
            onBack={() => setSelectedPatient(null)}
            onGenerateReport={(idPaciente) => {
              setReportPatientId(idPaciente);
              setSelectedPatient(null);
              setActiveTab('Reportes');
            }}
            onRegistrarToma={
              pacientesMedico?.some((p) => p.id === selectedPatient.id) ? () => setRegistrandoPaciente(selectedPatient) : undefined
            }
            onNavigatePerfil={() => setActiveTab('Perfil')}
          />
        );
      }

      const pantallaPacientes = (
        <PacientesMedico
          idMedico={sesion.id_rol}
          pacientes={pacientesMedico}
          cargandoPacientes={cargandoPacientes}
          errorPacientes={errorPacientes}
          onRecargarPacientes={() => cargarPacientesMedico(sesion)}
          onSelectPatient={(p) => setSelectedPatient(p)}
          onNavigatePerfil={() => setActiveTab('Perfil')}
        />
      );

      switch (activeTab) {
        case 'Pacientes':
          return pantallaPacientes;
        case 'Alertas':
          return (
            <AlertasMedico
              idMedico={sesion.id_rol}
              pacientes={pacientesMedico ?? []}
              onSelectPatient={(p) => setSelectedPatient(p)}
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
        case 'Reportes':
          return (
            <ReportesMedico
              pacientes={pacientesMedico ?? []}
              initialPatientId={reportPatientId}
              onNavigatePerfil={() => setActiveTab('Perfil')}
            />
          );
        case 'Perfil':
          return (
            <PerfilUsuario
              user={currentUser}
              perfilMedico={perfilMedico}
              onEditarMedico={() => setIsEditarMedicoOpen(true)}
              cargandoPerfil={cargandoPerfil}
              onReintentarPerfil={() => cargarPerfilMedico(sesion)}
              onLogout={handleLogout}
            />
          );
        default:
          return pantallaPacientes;
      }
    }

    // ADMINISTRADOR FLOW
    if (role === 'admin') {
      if (selectedAdminRequest) {
        return (
          <DetalleSolicitudAdmin
            request={selectedAdminRequest}
            idAdmin={sesion.id_rol}
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
              idAdmin={sesion.id_rol}
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
              perfilAdmin={perfilAdmin}
              cargandoPerfil={cargandoPerfil}
              onReintentarPerfil={() => cargarPerfilAdmin(sesion)}
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
    isRegistrarTomaOpen ||
    isEditarPerfilOpen ||
    isEditarMedicoOpen ||
    Boolean(registrandoPaciente) ||
    Boolean(selectedPatient) ||
    Boolean(selectedAdminRequest);

  return (
    <SafeAreaProvider>
      {/* Sin barra inferior (subpantallas) la zona segura de abajo la cubre el propio SafeAreaView; con barra, la cubre BottomNavBar */}
      <SafeAreaView
        style={styles.safeArea}
        edges={isViewingSubscreen ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}
      >
        <StatusBar style="dark" />
        {/* El contenido se centra y no pasa de ANCHO_MAXIMO_CONTENIDO: en tablets no se estira */}
        <View style={styles.contenido}>
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
        </View>
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
  contenido: {
    flex: 1,
    width: '100%',
    maxWidth: ANCHO_MAXIMO_CONTENIDO,
    alignSelf: 'center',
  },
});
