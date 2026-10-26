import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { CustomButton } from '../../shared/CustomButton';
import { AlertaPushBanner } from './components/AlertaPushBanner';
import { FiltroAlertas, AlertFilter } from './components/FiltroAlertas';
import { AlertaCard } from './components/AlertaCard';
import { PestanasAlertas, PestanaAlertas } from './components/PestanasAlertas';
import { ResponderAlertaModal } from './components/ResponderAlertaModal';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { USE_MOCK } from '../../services/config';
import {
  AlertaMedico,
  PacienteMedico,
  obtenerAlertasActivas,
  obtenerAlertasResueltas,
  responderAlerta,
} from '../../services/medico';
import { filtrarAlertas, ordenarAlertas } from '../../services/medicoVista';
import { mensajeDeError } from '../../services/http';

interface AlertasMedicoProps {
  /** id_medico de la sesión (id_rol). */
  idMedico: number;
  /** Pacientes del médico, para abrir el detalle desde una alerta. */
  pacientes: PacienteMedico[];
  onSelectPatient: (patient: PacienteMedico) => void;
  onNavigatePerfil?: () => void;
}

export const AlertasMedico: React.FC<AlertasMedicoProps> = ({
  idMedico,
  pacientes,
  onSelectPatient,
  onNavigatePerfil,
}) => {
  const [pestana, setPestana] = useState<PestanaAlertas>('activas');
  const [filter, setFilter] = useState<AlertFilter>('todas');
  const [activas, setActivas] = useState<AlertaMedico[]>([]);
  const [resueltas, setResueltas] = useState<AlertaMedico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seleccionada, setSeleccionada] = useState<AlertaMedico | null>(null);
  const [exito, setExito] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [a, r] = await Promise.all([obtenerAlertasActivas(idMedico), obtenerAlertasResueltas(idMedico)]);
      setActivas(ordenarAlertas(a));
      setResueltas(ordenarAlertas(r));
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [idMedico]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const hoy = useMemo(() => new Date(), [activas, resueltas]);
  const lista = pestana === 'activas' ? activas : resueltas;
  const visibles = useMemo(() => filtrarAlertas(lista, filter), [lista, filter]);
  const conteos = useMemo(
    () => ({
      todas: lista.length,
      hipo: filtrarAlertas(lista, 'hipo').length,
      hiper: filtrarAlertas(lista, 'hiper').length,
    }),
    [lista],
  );

  const enviarRespuesta = async (mensaje: string) => {
    if (!seleccionada) return;
    try {
      await responderAlerta({ idMedico, idAlerta: seleccionada.id, mensaje });
    } catch (e) {
      cargar(); // refleja el estado real aunque el servidor haya fallado a medias
      throw e;
    }
    setSeleccionada(null);
    setExito('Respuesta enviada. La alerta pasó a resueltas.');
    setPestana('activas');
    await cargar();
  };

  const verPaciente = () => {
    const p = pacientes.find((x) => x.id === seleccionada?.idPaciente);
    if (p) {
      setSeleccionada(null);
      onSelectPatient(p);
    }
  };

  return (
    <View style={styles.container}>
      <TopHeader
        title="Alertas"
        onProfilePress={onNavigatePerfil}
        hasUnreadNotifications={USE_MOCK}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Aviso de la alerta activa más reciente (solo si existe) */}
        <AlertaPushBanner alerta={activas[0] ?? null} hoy={hoy} onPress={() => activas[0] && setSeleccionada(activas[0])} />

        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.mainTitle}>Alertas Clínicas</Text>
          {activas.length > 0 && <View style={styles.redDot} />}
        </View>
        <Text style={styles.subtitle}>
          Pacientes con valores fuera de rango o cambios bruscos que requieren
          seguimiento.
        </Text>

        {exito ? (
          <TouchableOpacity onPress={() => setExito('')} activeOpacity={0.8}>
            <Text style={styles.exito} testID="alertas-exito">{exito}</Text>
          </TouchableOpacity>
        ) : null}

        <PestanasAlertas seleccionada={pestana} onSelect={setPestana} activas={activas.length} resueltas={resueltas.length} />

        {/* Filters */}
        <FiltroAlertas filter={filter} onSelectFilter={setFilter} conteos={conteos} />

        {/* Alert Cards */}
        {cargando ? (
          <View style={styles.estadoBox} testID="alertas-cargando">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="alertas-error-carga">{error}</Text>
            <CustomButton title="Reintentar" onPress={() => { setCargando(true); cargar(); }} testID="alertas-reintentar" />
          </View>
        ) : visibles.length === 0 ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="alertas-vacio">
              {pestana === 'activas' ? 'No tienes alertas activas.' : 'Aún no has resuelto alertas.'}
            </Text>
          </View>
        ) : (
          visibles.map((alert) => (
            <AlertaCard key={alert.id} alert={alert} hoy={hoy} onPress={() => setSeleccionada(alert)} />
          ))
        )}
      </ScrollView>

      <ResponderAlertaModal
        alerta={seleccionada}
        activa={pestana === 'activas'}
        hoy={hoy}
        onEnviar={enviarRespuesta}
        onVerPaciente={pacientes.some((p) => p.id === seleccionada?.idPaciente) ? verPaciente : undefined}
        onClose={() => setSeleccionada(null)}
      />
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
  exito: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.normalText,
    backgroundColor: COLORS.normalBg,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  mainTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.riesgoHiper,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
});

