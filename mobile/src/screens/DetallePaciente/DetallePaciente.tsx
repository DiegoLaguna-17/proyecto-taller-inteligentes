import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { Icon } from '../../shared/Icon';
import { CustomButton } from '../../shared/CustomButton';
import { PacienteHeaderCard } from './components/PacienteHeaderCard';
import { UltimaTelemetriaCard } from './components/UltimaTelemetriaCard';
import { CurvaGlucemiaMedico } from './components/CurvaGlucemiaMedico';
import { RegistrosRecientesMedico } from './components/RegistrosRecientesMedico';
import { TratamientoVinculadoCard } from './components/TratamientoVinculadoCard';
import { PatientSummary } from '../../utils/mockData';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';

interface DetallePacienteProps {
  patient?: PatientSummary;
  onBack: () => void;
  onGenerateReport: (patientName: string) => void;
  onNavigatePerfil?: () => void;
}

export const DetallePaciente: React.FC<DetallePacienteProps> = ({
  patient,
  onBack,
  onGenerateReport,
  onNavigatePerfil,
}) => {
  const patientName = patient?.name || 'Elena Soto';

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
          name={patientName}
          idCode={patient?.code ? `ID: ${patient.code}` : 'ID: #4082'}
        />

        {/* Telemetry card */}
        <UltimaTelemetriaCard />

        {/* Glucose Curve */}
        <CurvaGlucemiaMedico />

        {/* Recent Readings */}
        <RegistrosRecientesMedico />

        {/* Treatment Linked */}
        <TratamientoVinculadoCard />

        {/* Action Button: Generar reporte clínico */}
        <CustomButton
          title="Generar reporte clínico"
          onPress={() => onGenerateReport(patientName)}
          iconLeft="fileText"
          size="lg"
          style={styles.actionBtn}
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

