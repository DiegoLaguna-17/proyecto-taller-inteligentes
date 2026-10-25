import React, { useState } from 'react';
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
import { SelectorPacienteReporte } from './components/SelectorPacienteReporte';
import { SelectorRangoReporte } from './components/SelectorRangoReporte';
import { MetricasReportePreview } from './components/MetricasReportePreview';
import { DistribucionLecturasBar } from './components/DistribucionLecturasBar';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';

interface ReportesMedicoProps {
  initialPatientName?: string;
  onNavigatePerfil?: () => void;
}

export const ReportesMedico: React.FC<ReportesMedicoProps> = ({
  initialPatientName = 'Elena Soto',
  onNavigatePerfil,
}) => {
  const [patientName, setPatientName] = useState(initialPatientName);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      Alert.alert(
        'Reporte Generado',
        `El informe clínico de ${patientName} ha sido exportado exitosamente en formato PDF.`
      );
    }, 900);
  };

  return (
    <View style={styles.container}>
      <TopHeader
        title="Reportes"
        onProfilePress={onNavigatePerfil}
        hasUnreadNotifications
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

        {/* Form Selectors */}
        <SelectorPacienteReporte
          patientName={patientName}
          onChangePress={() => {
            Alert.alert(
              'Seleccionar Paciente',
              'Puedes cambiar entre pacientes asignados en la lista de Pacientes.'
            );
          }}
        />

        <SelectorRangoReporte
          onPress={() => {
            Alert.alert('Rango temporal', 'Filtrando los últimos 30 días.');
          }}
        />

        {/* Metrics Preview */}
        <MetricasReportePreview patientName={patientName} />

        {/* Distribution bar */}
        <DistribucionLecturasBar />

        {/* Download PDF button */}
        <CustomButton
          title="Descargar PDF"
          onPress={handleDownload}
          iconLeft="download"
          size="lg"
          loading={downloading}
          style={styles.downloadBtn}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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

