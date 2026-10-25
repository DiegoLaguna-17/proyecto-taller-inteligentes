import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { Icon } from '../../shared/Icon';
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

interface HistorialPacienteProps {
  onNavigatePerfil?: () => void;
}

export const HistorialPaciente: React.FC<HistorialPacienteProps> = ({
  onNavigatePerfil,
}) => {
  const [periodo, setPeriodo] = useState<PeriodoType>('Semanal');
  const [viewMode, setViewMode] = useState<ViewMode>('grafico');

  const handleExport = () => {
    Alert.alert('Exportar registros', 'Generando exportación de datos clínicos...');
  };

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

          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExport}
            activeOpacity={0.7}
          >
            <Icon name="download" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Resumen Cards */}
        <HistorialResumenCards />

        {/* Period Selector & Mode Switch */}
        <PeriodoSelector
          periodo={periodo}
          onSelectPeriodo={setPeriodo}
          viewMode={viewMode}
          onToggleViewMode={setViewMode}
        />

        {/* Chart or List */}
        {viewMode === 'grafico' && <GraficoTendencia />}

        <TomasList />

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
  exportBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
});

