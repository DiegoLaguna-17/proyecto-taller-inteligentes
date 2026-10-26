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
import { SelectorPacienteReporte } from './components/SelectorPacienteReporte';
import { SelectorRangoReporte } from './components/SelectorRangoReporte';
import { MetricasReportePreview } from './components/MetricasReportePreview';
import { DistribucionLecturasBar } from './components/DistribucionLecturasBar';
import { ModalSeleccionPaciente } from './components/ModalSeleccionPaciente';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { USE_MOCK } from '../../services/config';
import { PacienteMedico } from '../../services/medico';
import { RegistroHistorial, obtenerRegistros } from '../../services/glucosa';
import { etiquetaRango, Periodo } from '../../services/historial';
import { edadDesdeFechaNac, metricasReporte } from '../../services/medicoVista';
import { mensajeDeError } from '../../services/http';
import { construirHtmlReporte } from '../../services/reportePdf';
import { ErrorPdf, generarYCompartirPdf } from '../../shared/compartirPdf';

interface ReportesMedicoProps {
  /** Pacientes del médico (compartidos desde App). */
  pacientes: PacienteMedico[];
  /** Paciente preseleccionado (al llegar desde el detalle). */
  initialPatientId?: number | null;
  onNavigatePerfil?: () => void;
}

export const ReportesMedico: React.FC<ReportesMedicoProps> = ({
  pacientes,
  initialPatientId = null,
  onNavigatePerfil,
}) => {
  const [seleccionId, setSeleccionId] = useState<number | null>(initialPatientId ?? pacientes[0]?.id ?? null);
  const [dias, setDias] = useState<7 | 30>(30);
  const [eligiendo, setEligiendo] = useState(false);
  const [registros, setRegistros] = useState<RegistroHistorial[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState('');

  // Si cambia la lista o llega un paciente preseleccionado
  useEffect(() => {
    if (initialPatientId !== null && initialPatientId !== undefined) setSeleccionId(initialPatientId);
    else if (seleccionId === null && pacientes.length > 0) setSeleccionId(pacientes[0].id);
  }, [initialPatientId, pacientes]);

  const paciente = pacientes.find((p) => p.id === seleccionId) ?? null;

  const cargar = useCallback(async () => {
    if (seleccionId === null) return;
    setCargando(true);
    setError('');
    try {
      setRegistros(await obtenerRegistros(seleccionId));
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [seleccionId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const hoy = useMemo(() => new Date(), [registros]);
  const metricas = useMemo(() => metricasReporte(registros, hoy, dias), [registros, hoy, dias]);
  const periodo: Periodo = dias === 7 ? 'Semanal' : 'Mensual';

  // PDF: se genera en el dispositivo con las lecturas ya cargadas (design.md § Fase Móvil 5). Sin lecturas no hay PDF.
  const puedePdf = !!paciente && !cargando && !error && metricas.total > 0;
  const descargarPdf = async () => {
    if (!paciente || !puedePdf || generandoPdf) return; // guarda contra el doble toque
    setGenerandoPdf(true);
    setErrorPdf('');
    try {
      const ahora = new Date();
      const html = construirHtmlReporte({
        paciente: {
          nombre: paciente.nombre,
          edad: edadDesdeFechaNac(paciente.fechaNac, ahora),
          condicion: paciente.afecciones[0] ?? null,
        },
        registros,
        dias,
        hoy: ahora,
      });
      if (!html) {
        setErrorPdf('No hay lecturas en el periodo para generar el PDF.');
        return;
      }
      await generarYCompartirPdf(html, 'Reporte de glucosa');
    } catch (e) {
      setErrorPdf(e instanceof ErrorPdf ? e.message : 'No se pudo generar el PDF. Intenta de nuevo.');
    } finally {
      setGenerandoPdf(false);
    }
  };

  const info = paciente
    ? [`ID: #${paciente.id}`, edadDesdeFechaNac(paciente.fechaNac, hoy) !== null ? `${edadDesdeFechaNac(paciente.fechaNac, hoy)} años` : null, paciente.afecciones[0] ?? null]
        .filter(Boolean)
        .join(' • ')
    : '';

  return (
    <View style={styles.container}>
      <TopHeader
        title="Reportes"
        onProfilePress={onNavigatePerfil}
        hasUnreadNotifications={USE_MOCK}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Module Subtitle */}
        <View style={styles.moduleRow}>
          <Icon name="fileText" size={16} color={COLORS.primary} />
          <Text style={styles.moduleText}>MÓDULO CLÍNICO</Text>
        </View>

        <Text style={styles.mainTitle}>Generar Reporte Clínico</Text>
        <Text style={styles.subtitle}>
          Exportación de datos de glucemia para seguimiento médico
        </Text>

        {!paciente ? (
          <Text style={styles.estadoText} testID="reportes-sin-pacientes">
            Aún no tienes pacientes asignados para generar reportes.
          </Text>
        ) : (
          <>
            {/* Form Selectors */}
            <SelectorPacienteReporte
              patientName={paciente.nombre}
              patientInfo={info}
              onChangePress={() => setEligiendo(true)}
            />

            <SelectorRangoReporte
              rangeName={`Últimos ${dias} días`}
              rangeDates={etiquetaRango(periodo, hoy)}
              onPress={() => setDias(dias === 30 ? 7 : 30)}
            />

            {cargando ? (
              <View style={styles.estadoBox} testID="reportes-cargando">
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : error ? (
              <View style={styles.estadoBox}>
                <Text style={styles.estadoText} testID="reportes-error">{error}</Text>
                <CustomButton title="Reintentar" onPress={cargar} testID="reportes-reintentar" />
              </View>
            ) : metricas.total === 0 ? (
              <Text style={styles.estadoText} testID="reportes-vacio">
                Este paciente no tiene lecturas en los últimos {dias} días.
              </Text>
            ) : (
              <>
                {/* Metrics Preview */}
                <MetricasReportePreview patientName={paciente.nombre} metricas={metricas} dias={dias} />

                {/* Distribution bar */}
                <DistribucionLecturasBar metricas={metricas} />
              </>
            )}
          </>
        )}

        <CustomButton
          title={errorPdf ? 'Reintentar PDF' : 'Descargar PDF'}
          onPress={descargarPdf}
          iconLeft="download"
          size="lg"
          disabled={!puedePdf}
          loading={generandoPdf}
          style={styles.downloadBtn}
          testID="reportes-pdf"
        />
        {errorPdf ? (
          <Text style={[styles.nota, styles.notaError]} testID="reportes-pdf-error" accessibilityRole="alert">
            {errorPdf}
          </Text>
        ) : (
          <Text style={styles.nota} testID="reportes-pdf-aviso">
            {puedePdf
              ? 'Se genera en tu dispositivo y se abre la hoja para compartirlo o guardarlo.'
              : 'El PDF se habilita cuando el paciente tiene lecturas en el periodo.'}
          </Text>
        )}
      </ScrollView>

      <ModalSeleccionPaciente
        visible={eligiendo}
        pacientes={pacientes}
        seleccionado={seleccionId}
        onSelect={(id) => {
          setSeleccionId(id);
          setEligiendo(false);
        }}
        onClose={() => setEligiendo(false)}
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
    marginVertical: 16,
  },
  nota: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  notaError: {
    color: COLORS.riesgoHiperText,
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
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  moduleText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 0.8,
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
    marginBottom: 20,
  },
  downloadBtn: {
    marginTop: 4,
  },
});

