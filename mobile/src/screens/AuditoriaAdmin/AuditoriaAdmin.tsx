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
import { AuditoriaKpiCards } from './components/AuditoriaKpiCards';
import { FiltroEventos, EventFilterType } from './components/FiltroEventos';
import { EventoAuditoriaCard } from './components/EventoAuditoriaCard';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { USE_MOCK } from '../../services/config';
import { EventoAuditoria, obtenerAuditoria } from '../../services/administrador';
import { filtrarEventos, kpisAuditoria, ordenarEventos, paginar } from '../../services/administradorVista';
import { mensajeDeError } from '../../services/http';

// Supabase corta las consultas sin paginar en 1000 filas; /general/auditoria no ordena ni pagina.
const LIMITE_SERVIDOR = 1000;

interface AuditoriaAdminProps {
  onNavigatePerfil?: () => void;
}

export const AuditoriaAdmin: React.FC<AuditoriaAdminProps> = ({
  onNavigatePerfil,
}) => {
  const [filter, setFilter] = useState<EventFilterType>('todos');
  const [soloHoy, setSoloHoy] = useState(true);
  const [paginas, setPaginas] = useState(1);
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setEventos(ordenarEventos(await obtenerAuditoria()));
      setPaginas(1);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const hoy = useMemo(() => new Date(), [eventos]);
  const filtrados = useMemo(() => filtrarEventos(eventos, filter, soloHoy, hoy), [eventos, filter, soloHoy, hoy]);
  const { visibles, hayMas } = useMemo(() => paginar(filtrados, paginas), [filtrados, paginas]);
  const kpis = useMemo(() => kpisAuditoria(eventos, hoy), [eventos, hoy]);

  return (
    <View style={styles.container}>
      <TopHeader
        title="Auditoría"
        onProfilePress={onNavigatePerfil}
        hasUnreadNotifications={USE_MOCK}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badgeRow}>
          <View style={styles.complianceBadge}>
            <View style={styles.blueDot} />
            <Text style={styles.complianceText}>REGISTRO DE ACTIVIDAD</Text>
          </View>
          <TouchableOpacity style={styles.liveBadge} onPress={cargar} activeOpacity={0.7} testID="auditoria-actualizar">
            <Text style={styles.liveText}>Actualizar</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.mainTitle}>Registro de Auditoría</Text>
        <Text style={styles.subtitle}>
          Trazabilidad cronológica de las operaciones del sistema (sin nombres; IP enmascarada).
        </Text>

        <FiltroEventos
          filter={filter}
          onSelectFilter={(f) => {
            setFilter(f);
            setPaginas(1);
          }}
          soloHoy={soloHoy}
          onToggleHoy={() => {
            setSoloHoy((v) => !v);
            setPaginas(1);
          }}
        />

        <AuditoriaKpiCards hoy={kpis.hoy} erroresHoy={kpis.erroresHoy} total={kpis.total} />

        {eventos.length >= LIMITE_SERVIDOR ? (
          <Text style={styles.truncado} testID="auditoria-truncado">
            El servidor devuelve como máximo {LIMITE_SERVIDOR} registros y sin ordenar: puede faltar actividad reciente.
          </Text>
        ) : null}

        <View style={styles.sequenceHeader}>
          <Text style={styles.sequenceTitle}>Secuencia de Eventos</Text>
          <View style={styles.cryptoRow}>
            <View style={styles.blueDot} />
            <Text style={styles.cryptoText} testID="auditoria-cantidad">
              {filtrados.length === 1 ? '1 evento' : `${filtrados.length} eventos`}
            </Text>
          </View>
        </View>

        {cargando ? (
          <View style={styles.estadoBox} testID="auditoria-cargando">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="auditoria-error">{error}</Text>
            <CustomButton title="Reintentar" onPress={cargar} testID="auditoria-reintentar" />
          </View>
        ) : filtrados.length === 0 ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="auditoria-vacio">No hay eventos para este filtro.</Text>
          </View>
        ) : (
          <>
            {visibles.map((event) => (
              <EventoAuditoriaCard key={event.id} event={event} hoy={hoy} />
            ))}
            {hayMas && (
              <CustomButton
                title="Ver más eventos"
                onPress={() => setPaginas((p) => p + 1)}
                variant="secondary"
                style={styles.masBtn}
                testID="auditoria-ver-mas"
              />
            )}
          </>
        )}

        <CustomButton
          title="Exportar Log Completo (CSV / PDF)"
          onPress={() => {}}
          iconLeft="download"
          size="lg"
          variant="secondary"
          disabled
          style={styles.exportBtn}
          testID="auditoria-exportar"
        />

        <Text style={styles.footerNote} testID="auditoria-exportar-aviso">
          La exportación no está disponible: el backend no ofrece un endpoint para ella.
        </Text>
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
  truncado: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  masBtn: {
    marginVertical: 8,
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
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  complianceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  complianceText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 0.6,
  },
  liveBadge: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  liveText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  mainTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  sequenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sequenceTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  cryptoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cryptoText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  exportBtn: {
    marginTop: 10,
    marginBottom: 12,
  },
  footerNote: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 10,
  },
});

