import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { Icon } from '../../shared/Icon';
import { CustomButton } from '../../shared/CustomButton';
import { SolicitudesHeaderBanner } from './components/SolicitudesHeaderBanner';
import {
  FiltroSolicitudes,
  SolicitudFilter,
} from './components/FiltroSolicitudes';
import { SolicitudCard } from './components/SolicitudCard';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { USE_MOCK } from '../../services/config';
import {
  UsuarioAdmin,
  obtenerMedicosSolicitantes,
  obtenerPacientesSolicitantes,
} from '../../services/administrador';
import { conteoSolicitudes, filtrarSolicitudes, unificarSolicitudes } from '../../services/administradorVista';
import { mensajeDeError } from '../../services/http';

interface SolicitudesAdminProps {
  onSelectRequest: (req: UsuarioAdmin) => void;
  onNavigatePerfil?: () => void;
}

export const SolicitudesAdmin: React.FC<SolicitudesAdminProps> = ({
  onSelectRequest,
  onNavigatePerfil,
}) => {
  const [filter, setFilter] = useState<SolicitudFilter>('todos');
  const [solicitudes, setSolicitudes] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [pacientes, medicos] = await Promise.all([obtenerPacientesSolicitantes(), obtenerMedicosSolicitantes()]);
      setSolicitudes(unificarSolicitudes(pacientes, medicos));
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const counts = useMemo(() => conteoSolicitudes(solicitudes), [solicitudes]);
  const filtered = useMemo(() => filtrarSolicitudes(solicitudes, filter), [solicitudes, filter]);

  return (
    <View style={styles.container}>
      <TopHeader
        title="Solicitudes"
        onProfilePress={onNavigatePerfil}
        hasUnreadNotifications={USE_MOCK}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SolicitudesHeaderBanner pendingCount={counts.todos} />

        <FiltroSolicitudes
          filter={filter}
          onSelectFilter={setFilter}
          counts={counts}
        />

        {cargando ? (
          <View style={styles.estadoBox} testID="solicitud-cargando">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="solicitud-error">{error}</Text>
            <CustomButton title="Reintentar" onPress={cargar} testID="solicitud-reintentar" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="solicitud-vacio">No hay solicitudes pendientes.</Text>
          </View>
        ) : (
          filtered.map((req) => (
            <SolicitudCard
              key={req.clave}
              request={req}
              onPress={() => onSelectRequest(req)}
            />
          ))
        )}

        {/* Aviso: la activación no tiene autenticación real en el backend (RB-01) */}
        <View style={styles.infoBanner}>
          <Icon name="shieldCheck" size={18} color={COLORS.primary} />
          <Text style={styles.infoBannerText}>
            Revisa los datos y los documentos antes de activar una cuenta. El backend aún no
            autentica a quien activa (solo para una red local de desarrollo).
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  estadoBox: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  estadoText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    padding: 14,
    borderRadius: 16,
    gap: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  infoBannerText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },
});

