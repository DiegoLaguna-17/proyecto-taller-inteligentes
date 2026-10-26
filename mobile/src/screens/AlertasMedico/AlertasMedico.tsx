import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { AlertaPushBanner } from './components/AlertaPushBanner';
import { FiltroAlertas, AlertFilter } from './components/FiltroAlertas';
import { AlertaCard } from './components/AlertaCard';
import {
  MOCK_DOCTOR_ALERTS,
  DoctorAlert,
  PatientSummary,
  MOCK_DOCTOR_PATIENTS,
} from '../../utils/mockData';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';

interface AlertasMedicoProps {
  onSelectPatient: (patient: PatientSummary) => void;
  onNavigatePerfil?: () => void;
}

export const AlertasMedico: React.FC<AlertasMedicoProps> = ({
  onSelectPatient,
  onNavigatePerfil,
}) => {
  const [filter, setFilter] = useState<AlertFilter>('all');

  const filteredAlerts = MOCK_DOCTOR_ALERTS.filter((item) => {
    if (filter === 'hipo') return item.classification === 'Riesgo Hipo';
    if (filter === 'hiper') return item.classification === 'Riesgo Hiper';
    return true;
  });

  const handleAlertPress = (alert: DoctorAlert) => {
    const patient = MOCK_DOCTOR_PATIENTS.find(
      (p) => p.name.toLowerCase() === alert.patientName.toLowerCase()
    ) || {
      id: alert.id,
      code: '#P-0089',
      name: alert.patientName,
      initials: 'ES',
      lastReading: alert.value,
      classification: alert.classification,
      lastReadingTime: alert.time,
    };

    onSelectPatient(patient);
  };

  return (
    <View style={styles.container}>
      <TopHeader
        title="Alertas"
        onProfilePress={onNavigatePerfil}
        hasUnreadNotifications
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Push Notification Banner */}
        <AlertaPushBanner
          onPress={() => {
            const elena = MOCK_DOCTOR_PATIENTS.find((p) => p.name === 'Elena Soto');
            if (elena) onSelectPatient(elena);
          }}
        />

        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.mainTitle}>Alertas Clínicas</Text>
          <View style={styles.redDot} />
        </View>
        <Text style={styles.subtitle}>
          Pacientes con valores fuera de rango o cambios bruscos que requieren
          seguimiento.
        </Text>

        {/* Filters */}
        <FiltroAlertas filter={filter} onSelectFilter={setFilter} />

        {/* Alert Cards */}
        {filteredAlerts.map((alert) => (
          <AlertaCard
            key={alert.id}
            alert={alert}
            onPress={() => handleAlertPress(alert)}
          />
        ))}
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

