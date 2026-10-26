import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { Icon } from '../../shared/Icon';
import { CustomButton } from '../../shared/CustomButton';
import { PerfilHeaderCard } from './components/PerfilHeaderCard';
import { FichaClinicaCard } from './components/FichaClinicaCard';
import { UserProfile } from '../../utils/tipos';
import appConfig from '../../../app.json';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { PerfilPaciente, obtenerSemanasEmbarazo } from '../../services/paciente';
import { PerfilMedico } from '../../services/medico';
import { PerfilAdmin } from '../../services/administrador';
import { obtenerRegistros } from '../../services/glucosa';
import { filtrarPorPeriodo, porcentajeEnRango } from '../../services/historial';

interface PerfilUsuarioProps {
  user: UserProfile;
  /** Solo paciente: id_paciente de la sesión. */
  idPaciente?: number;
  /** Solo paciente: perfil real; null si no se pudo cargar. */
  perfil?: PerfilPaciente | null;
  /** Solo paciente: abre la edición de datos. */
  onEditar?: () => void;
  /** Solo médico: perfil real; null si no se pudo cargar. */
  perfilMedico?: PerfilMedico | null;
  /** Solo médico: abre la edición de sus datos. */
  onEditarMedico?: () => void;
  /** Solo administrador: perfil real; null si no se pudo cargar. */
  perfilAdmin?: PerfilAdmin | null;
  /** true mientras App pide el perfil del rol. */
  cargandoPerfil?: boolean;
  /** Reintenta la carga del perfil del rol. */
  onReintentarPerfil?: () => void;
  onLogout: () => void;
}

export const PerfilUsuario: React.FC<PerfilUsuarioProps> = ({
  user,
  idPaciente,
  perfil = null,
  onEditar,
  perfilMedico = null,
  onEditarMedico,
  perfilAdmin = null,
  cargandoPerfil = false,
  onReintentarPerfil,
  onLogout,
}) => {
  const [semanas, setSemanas] = useState<number | null>(null);
  const [enRangoSemana, setEnRangoSemana] = useState<number | null>(null);

  // Datos complementarios de la ficha (si fallan, la ficha se muestra sin ellos)
  useEffect(() => {
    if (user.role !== 'paciente' || idPaciente === undefined) return;
    let activo = true;
    obtenerRegistros(idPaciente)
      .then((r) => activo && setEnRangoSemana(porcentajeEnRango(filtrarPorPeriodo(r, 'Semanal', new Date()))))
      .catch(() => {});
    if (perfil?.embarazo) {
      obtenerSemanasEmbarazo(idPaciente)
        .then((s) => activo && setSemanas(s))
        .catch(() => {});
    }
    return () => {
      activo = false;
    };
  }, [user.role, idPaciente, perfil?.embarazo]);

  const handleConfirmLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que deseas salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <TopHeader title="Perfil" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PerfilHeaderCard user={user} />

        <FichaClinicaCard
          user={user}
          perfil={perfil}
          semanas={semanas}
          enRangoSemana={enRangoSemana}
          perfilMedico={perfilMedico}
          perfilAdmin={perfilAdmin}
          cargandoPerfil={cargandoPerfil}
          onReintentar={onReintentarPerfil}
        />

        {user.role === 'medico' && perfilMedico && onEditarMedico && (
          <CustomButton
            title="Editar mis datos"
            onPress={onEditarMedico}
            iconLeft="settings"
            variant="secondary"
            style={styles.editBtn}
            testID="medico-editar"
          />
        )}

        {user.role === 'paciente' && perfil && onEditar && (
          <CustomButton
            title="Editar mis datos"
            onPress={onEditar}
            iconLeft="settings"
            variant="secondary"
            style={styles.editBtn}
            testID="perfil-editar"
          />
        )}

        {/* Logout Button */}
        <CustomButton
          title="Cerrar sesión"
          onPress={handleConfirmLogout}
          iconLeft="logout"
          variant="outline"
          size="lg"
          style={styles.logoutBtn}
          textStyle={styles.logoutText}
          testID="perfil-cerrar-sesion"
        />

        {/* Legal Footnote */}
        <View style={styles.legalSection}>
          <View style={styles.versionRow}>
            <Icon name="shieldCheck" size={14} color={COLORS.textSecondary} />
            <Text style={styles.versionText}>GlucoTracker v{appConfig.expo.version}</Text>
          </View>
          <Text style={styles.legalText}>
            Tus datos de salud son confidenciales: comparte la información solo con tu equipo de atención.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  editBtn: {
    marginBottom: 20,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  logoutBtn: {
    backgroundColor: COLORS.backgroundWhite,
    borderColor: COLORS.borderCard,
    marginBottom: 24,
  },
  logoutText: {
    color: COLORS.riesgoHiper,
  },
  legalSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  versionText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  legalText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

