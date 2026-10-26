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
import { Icon } from '../../shared/Icon';
import { CustomButton } from '../../shared/CustomButton';
import { PacienteHeaderCard } from './components/PacienteHeaderCard';
import { UltimaTelemetriaCard } from './components/UltimaTelemetriaCard';
import { CurvaGlucemiaMedico } from './components/CurvaGlucemiaMedico';
import { RegistrosRecientesMedico } from './components/RegistrosRecientesMedico';
import { TratamientoVinculadoCard } from './components/TratamientoVinculadoCard';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { PacienteMedico } from '../../services/medico';
import { RegistroHistorial, obtenerRegistros } from '../../services/glucosa';
import { etiquetaFechaHora, filtrarPorPeriodo } from '../../services/historial';
import { edadDesdeFechaNac, iniciales } from '../../services/medicoVista';
import { mensajeDeError } from '../../services/http';

interface DetallePacienteProps {
  paciente: PacienteMedico;
  onBack: () => void;
  onGenerateReport: (idPaciente: number) => void;
  /** Abre el registro de una toma por el paciente; solo se pasa si el paciente es de `misPacientes`. */
  onRegistrarToma?: () => void;
  onNavigatePerfil?: () => void;
}

export const DetallePaciente: React.FC<DetallePacienteProps> = ({
  paciente,
  onBack,
  onGenerateReport,
  onRegistrarToma,
  onNavigatePerfil,
}) => {
  const [registros, setRegistros] = useState<RegistroHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setRegistros(await obtenerRegistros(paciente.id));
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [paciente.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const hoy = useMemo(() => new Date(), []);
  const validos = useMemo(() => registros.filter((r) => r.nivelGlucosa !== null), [registros]);
  const ultimo = validos[0] ?? null;
  const tomasHoy = useMemo(() => filtrarPorPeriodo(validos, 'Diario', hoy).length, [validos, hoy]);

  const edad = edadDesdeFechaNac(paciente.fechaNac, hoy);
  const partes = [
    edad !== null ? `${edad} años` : null,
    paciente.afecciones.length > 0 ? paciente.afecciones.join(', ') : null,
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <TopHeader
        title="Detalle De Paciente"
        showBack
        onBack={onBack}
        onProfilePress={onNavigatePerfil}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation pill & Status */}
        <View style={styles.topStatusRow}>
          <TouchableOpacity
            style={styles.backPill}
            onPress={onBack}
            activeOpacity={0.7}
            testID="detalle-volver"
          >
            <Icon name="arrowLeft" size={14} color={COLORS.primary} />
            <Text style={styles.backPillText}>Pacientes</Text>
          </TouchableOpacity>

          <View style={styles.statusPill}>
            <View style={styles.orangeDot} />
            <Text style={styles.statusPillText}>Seguimiento Activo</Text>
          </View>
        </View>

        {/* Patient card */}
        <PacienteHeaderCard
          name={paciente.nombre}
          initials={iniciales(paciente.nombre)}
          idCode={`ID: #${paciente.id}`}
          ageAndCondition={partes.length > 0 ? partes.join(' · ') : 'Sin datos clínicos'}
          phone={paciente.telefono ?? 'No registrado'}
          lastReading={ultimo ? etiquetaFechaHora(ultimo.fecha, ultimo.hora, hoy) : 'Sin tomas'}
        />

        {cargando ? (
          <View style={styles.estadoBox} testID="detalle-cargando">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="detalle-error">{error}</Text>
            <CustomButton title="Reintentar" onPress={cargar} testID="detalle-reintentar" />
          </View>
        ) : !ultimo ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="detalle-vacio">Este paciente aún no tiene lecturas registradas.</Text>
          </View>
        ) : (
          <>
            {/* Telemetry card */}
            <UltimaTelemetriaCard registro={ultimo} hoy={hoy} />

            {/* Glucose Curve */}
            <CurvaGlucemiaMedico registros={validos} hoy={hoy} />

            {/* Recent Readings */}
            <RegistrosRecientesMedico registros={validos} hoy={hoy} tomasHoy={tomasHoy} />
          </>
        )}

        {/* Treatment Linked */}
        <TratamientoVinculadoCard tratamientos={paciente.tratamientos} />

        {onRegistrarToma ? (
          <CustomButton
            title="Registrar toma"
            onPress={onRegistrarToma}
            iconLeft="drop"
            size="lg"
            style={styles.actionBtn}
            testID="detalle-registrar-toma"
          />
        ) : null}

        {/* Action Button: Generar reporte clínico */}
        <CustomButton
          title="Generar reporte clínico"
          onPress={() => onGenerateReport(paciente.id)}
          iconLeft="fileText"
          size="lg"
          style={styles.actionBtn}
          testID="detalle-reporte"
        />
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
    paddingBottom: 36,
  },
  topStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  backPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orangeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.riesgoHipo,
  },
  statusPillText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  actionBtn: {
    marginTop: 4,
  },
});

