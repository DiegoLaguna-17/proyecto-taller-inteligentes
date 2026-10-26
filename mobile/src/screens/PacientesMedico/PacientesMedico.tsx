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
import {
  PacientesFiltros,
  PacientesFiltroType,
} from './components/PacientesFiltros';
import { MetricasResumenMedico } from './components/MetricasResumenMedico';
import { PacienteCard } from './components/PacienteCard';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { USE_MOCK } from '../../services/config';
import { AlertaMedico, PacienteMedico, obtenerAlertasActivas } from '../../services/medico';
import { estadoPacientes, filtrarPacientes, resumenPacientes } from '../../services/medicoVista';
import { mensajeDeError } from '../../services/http';

const dos = (n: number) => String(n).padStart(2, '0');

interface PacientesMedicoProps {
  /** id_medico de la sesión (id_rol). */
  idMedico: number;
  /** Pacientes del médico (se cargan una vez en App y se comparten con Alertas y Reportes). */
  pacientes: PacienteMedico[] | null;
  cargandoPacientes: boolean;
  errorPacientes: string;
  onRecargarPacientes: () => void;
  onSelectPatient: (patient: PacienteMedico) => void;
  onNavigatePerfil?: () => void;
}

export const PacientesMedico: React.FC<PacientesMedicoProps> = ({
  idMedico,
  pacientes,
  cargandoPacientes,
  errorPacientes,
  onRecargarPacientes,
  onSelectPatient,
  onNavigatePerfil,
}) => {
  const [searchText, setSearchText] = useState('');
  const [filtro, setFiltro] = useState<PacientesFiltroType>('todos');
  const [alertas, setAlertas] = useState<AlertaMedico[]>([]);
  const [errorAlertas, setErrorAlertas] = useState('');
  const [actualizado, setActualizado] = useState<Date | null>(null);

  const cargarAlertas = useCallback(async () => {
    setErrorAlertas('');
    try {
      setAlertas(await obtenerAlertasActivas(idMedico));
      setActualizado(new Date());
    } catch (e) {
      setErrorAlertas(mensajeDeError(e));
    }
  }, [idMedico]);

  useEffect(() => {
    cargarAlertas();
  }, [cargarAlertas]);

  const hoy = useMemo(() => new Date(), [alertas]);
  const items = useMemo(() => estadoPacientes(pacientes ?? [], alertas), [pacientes, alertas]);
  const resumen = useMemo(() => resumenPacientes(items), [items]);
  const visibles = useMemo(() => filtrarPacientes(items, searchText, filtro), [items, searchText, filtro]);

  const recargar = () => {
    onRecargarPacientes();
    cargarAlertas();
  };

  return (
    <View style={styles.container}>
      {/* El punto de notificaciones sin leer no tiene fuente real: solo en modo simulado */}
      <TopHeader
        title="Pacientes"
        onProfilePress={onNavigatePerfil}
        hasUnreadNotifications={USE_MOCK}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.mainTitle}>Pacientes Asignados</Text>
          <TouchableOpacity style={styles.liveBadge} onPress={recargar} activeOpacity={0.7} testID="medico-actualizar">
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>
              {actualizado ? `Actualizado ${dos(actualizado.getHours())}:${dos(actualizado.getMinutes())}` : 'Actualizar'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle} testID="medico-subtitulo">
          {resumen.total === 1 ? '1 paciente' : `${resumen.total} pacientes`} en seguimiento clínico activo
        </Text>

        {/* Filters & Search */}
        <PacientesFiltros
          searchText={searchText}
          onChangeSearch={setSearchText}
          selectedFiltro={filtro}
          onSelectFiltro={setFiltro}
          conteos={{ todos: resumen.total, riesgo: resumen.enRiesgo, estables: resumen.estables }}
        />

        {/* Top metrics summary */}
        <MetricasResumenMedico total={resumen.total} casosUrgentes={resumen.enRiesgo} />

        {errorAlertas ? (
          <Text style={styles.estadoText} testID="medico-error-alertas">
            No se pudieron cargar las alertas: el estado de los pacientes puede estar incompleto. {errorAlertas}
          </Text>
        ) : null}

        {/* Patient cards list */}
        {cargandoPacientes ? (
          <View style={styles.estadoBox} testID="medico-cargando">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : errorPacientes ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="medico-error">{errorPacientes}</Text>
            <CustomButton title="Reintentar" onPress={recargar} testID="medico-reintentar" />
          </View>
        ) : resumen.total === 0 ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="medico-vacio">Aún no tienes pacientes asignados.</Text>
          </View>
        ) : visibles.length === 0 ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="medico-sin-resultados">Ningún paciente coincide con la búsqueda.</Text>
          </View>
        ) : (
          visibles.map((item) => (
            <PacienteCard
              key={item.paciente.id}
              item={item}
              hoy={hoy}
              onPress={() => onSelectPatient(item.paciente)}
            />
          ))
        )}

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
    marginBottom: 12,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mainTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  liveText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
});

