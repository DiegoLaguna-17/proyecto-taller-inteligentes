import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { CustomButton } from '../../shared/CustomButton';
import { AuditoriaKpiCards } from './components/AuditoriaKpiCards';
import { FiltroEventos, EventFilterType } from './components/FiltroEventos';
import { EventoAuditoriaCard } from './components/EventoAuditoriaCard';
import {
  MOCK_AUDIT_EVENTS,
} from '../../utils/mockData';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';

interface AuditoriaAdminProps {
  onNavigatePerfil?: () => void;
}

export const AuditoriaAdmin: React.FC<AuditoriaAdminProps> = ({
  onNavigatePerfil,
}) => {
  const [filter, setFilter] = useState<EventFilterType>('todos');

  const filteredEvents = MOCK_AUDIT_EVENTS.filter((ev) => {
    if (filter === 'accesos') return ev.type === 'access';
    if (filter === 'modificaciones') return ev.type === 'change';
    return true;
  });

  const handleExportLog = () => {
    Alert.alert(
      'Exportar Auditoría',
      'El registro criptográfico consolidado ha sido generado y descargado en formato CSV y PDF.'
    );
  };

  return (
    <View style={styles.container}>
      <TopHeader
        title="Auditoría"
        onProfilePress={onNavigatePerfil}
        hasUnreadNotifications
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badgeRow}>
          <View style={styles.complianceBadge}>
            <View style={styles.blueDot} />
            <Text style={styles.complianceText}>CUMPLIMIENTO HIPAA / GDPR</Text>
          </View>
          <View style={styles.liveBadge}>
            <Text style={styles.liveText}>En vivo</Text>
          </View>
        </View>

        <Text style={styles.mainTitle}>Registro de Auditoría</Text>
        <Text style={styles.subtitle}>
          Trazabilidad cronológica de eventos y seguridad del sistema.
        </Text>

        <FiltroEventos
          filter={filter}
          onSelectFilter={setFilter}
          onPressDate={() => {
            Alert.alert('Filtro por fecha', 'Seleccionando registros del día de hoy.');
          }}
        />

        <AuditoriaKpiCards />

        <View style={styles.sequenceHeader}>
          <Text style={styles.sequenceTitle}>Secuencia de Eventos</Text>
          <View style={styles.cryptoRow}>
            <View style={styles.blueDot} />
            <Text style={styles.cryptoText}>Cifrado SHA-256</Text>
          </View>
        </View>

        {filteredEvents.map((event) => (
          <EventoAuditoriaCard key={event.id} event={event} />
        ))}

        <CustomButton
          title="Exportar Log Completo (CSV / PDF)"
          onPress={handleExportLog}
          iconLeft="download"
          size="lg"
          variant="secondary"
          style={styles.exportBtn}
        />

        <Text style={styles.footerNote}>
          Registros firmados criptográficamente. Bloque de auditoría #84920
        </Text>
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

