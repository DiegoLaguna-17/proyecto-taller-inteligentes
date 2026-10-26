import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { CustomButton } from '../../shared/CustomButton';
import { HistorialResumenCards } from './components/HistorialResumenCards';
import {
  PeriodoSelector,
  PeriodoType,
  ViewMode,
} from './components/PeriodoSelector';
import { GraficoTendencia } from './components/GraficoTendencia';
import { TomasList } from './components/TomasList';
import { ConsejoClinicoCard } from './components/ConsejoClinicoCard';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { obtenerRegistros, RegistroHistorial } from '../../services/glucosa';
import {
  desviacion,
  etiquetaRango,
  filtrarPorPeriodo,
  porcentajeEnRango,
  promedio,
} from '../../services/historial';
import { mensajeDeError } from '../../services/http';

interface HistorialPacienteProps {
  /** id_paciente de la sesión (id_rol devuelto por POST /api/verify-otp). */
  idPaciente: number;
  onNavigatePerfil?: () => void;
}

export const HistorialPaciente: React.FC<HistorialPacienteProps> = ({
  idPaciente,
  onNavigatePerfil,
}) => {
  const [periodo, setPeriodo] = useState<PeriodoType>('Semanal');
  const [viewMode, setViewMode] = useState<ViewMode>('grafico');
  const [registros, setRegistros] = useState<RegistroHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setRegistros(await obtenerRegistros(idPaciente));
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [idPaciente]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const hoy = useMemo(() => new Date(), []);
  const delPeriodo = useMemo(() => filtrarPorPeriodo(registros, periodo, hoy), [registros, periodo, hoy]);
  // El gráfico va en orden cronológico y muestra, como máximo, las últimas 7 lecturas
  const puntos = useMemo(
    () => delPeriodo.filter((r) => r.nivelGlucosa !== null).slice(0, 7).reverse(),
    [delPeriodo],
  );

  return (
    <View style={styles.container}>
      <TopHeader
        title="Historial"
        onProfilePress={onNavigatePerfil}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title and Export button */}
        <View style={styles.titleRow}>
          <View style={styles.titleCol}>
            <Text style={styles.mainTitle}>Historial de glucosa</Text>
            <Text style={styles.subtitle}>
              Registro clínico continuo y variabilidad glucémica
            </Text>
          </View>

        </View>

        {/* Resumen Cards */}
        <HistorialResumenCards
          periodo={periodo}
          promedio={promedio(delPeriodo)}
          desviacion={desviacion(delPeriodo)}
          enRango={porcentajeEnRango(delPeriodo)}
          total={delPeriodo.length}
        />

        {/* Period Selector & Mode Switch */}
        <PeriodoSelector
          periodo={periodo}
          onSelectPeriodo={setPeriodo}
          viewMode={viewMode}
          onToggleViewMode={setViewMode}
          rangoTexto={etiquetaRango(periodo, hoy)}
        />

        {cargando ? (
          <View style={styles.estadoBox} testID="historial-cargando">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="historial-error">{error}</Text>
            <CustomButton title="Reintentar" onPress={cargar} testID="historial-reintentar" />
          </View>
        ) : delPeriodo.length === 0 ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="historial-vacio">
              No hay registros en este periodo.
            </Text>
          </View>
        ) : (
          <>
            {/* Chart or List */}
            {viewMode === 'grafico' && puntos.length > 0 && (
              <GraficoTendencia puntos={puntos} tir={porcentajeEnRango(delPeriodo)} />
            )}

            <TomasList tomas={delPeriodo} />
          </>
        )}

        <ConsejoClinicoCard />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleCol: {
    flex: 1,
    paddingRight: 12,
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
  },
});

