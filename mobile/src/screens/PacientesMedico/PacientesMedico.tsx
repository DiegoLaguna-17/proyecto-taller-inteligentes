import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import {
  PacientesFiltros,
  PacientesFiltroType,
} from './components/PacientesFiltros';
import { MetricasResumenMedico } from './components/MetricasResumenMedico';
import { PacienteCard } from './components/PacienteCard';
import { ProtocoloBanner } from './components/ProtocoloBanner';
import {
  MOCK_DOCTOR_PATIENTS,
  PatientSummary,
} from '../../utils/mockData';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';

interface PacientesMedicoProps {
  onSelectPatient: (patient: PatientSummary) => void;
  onNavigatePerfil?: () => void;
}

export const PacientesMedico: React.FC<PacientesMedicoProps> = ({
  onSelectPatient,
  onNavigatePerfil,
}) => {
  const [searchText, setSearchText] = useState('');
  const [filtro, setFiltro] = useState<PacientesFiltroType>('todos');

  const filteredPatients = MOCK_DOCTOR_PATIENTS.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchText.toLowerCase()) ||
      p.code.toLowerCase().includes(searchText.toLowerCase());

    if (!matchesSearch) return false;

    if (filtro === 'riesgo') {
      return p.classification !== 'Normal';
    }
    if (filtro === 'estables') {
      return p.classification === 'Normal';
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <TopHeader
        title="Pacientes"
        onProfilePress={onNavigatePerfil}
        hasUnreadNotifications
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.mainTitle}>Pacientes Asignados</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>En vivo</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          18 pacientes en seguimiento clínico activo
        </Text>

        {/* Filters & Search */}
        <PacientesFiltros
          searchText={searchText}
          onChangeSearch={setSearchText}
          selectedFiltro={filtro}
          onSelectFiltro={setFiltro}
        />

        {/* Top metrics summary */}
        <MetricasResumenMedico />

        {/* Patient cards list */}
        {filteredPatients.map((patient) => (
          <PacienteCard
            key={patient.id}
            patient={patient}
            onPress={() => onSelectPatient(patient)}
          />
        ))}

        {/* Clinical protocol banner */}
        <ProtocoloBanner
          onPressGuide={() => {
            Alert.alert(
              'Protocolo de Glucemia',
              'Visualizando pautas de intervención rápida para hipo e hiperglucemia.'
            );
          }}
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

