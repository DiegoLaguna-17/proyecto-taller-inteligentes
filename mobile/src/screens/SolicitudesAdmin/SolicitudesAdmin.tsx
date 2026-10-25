import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { Icon } from '../../shared/Icon';
import { SolicitudesHeaderBanner } from './components/SolicitudesHeaderBanner';
import {
  FiltroSolicitudes,
  SolicitudFilter,
} from './components/FiltroSolicitudes';
import { SolicitudCard } from './components/SolicitudCard';
import {
  MOCK_ADMIN_REQUESTS,
  AdminRequest,
} from '../../utils/mockData';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';

interface SolicitudesAdminProps {
  onSelectRequest: (req: AdminRequest) => void;
  onNavigatePerfil?: () => void;
}

export const SolicitudesAdmin: React.FC<SolicitudesAdminProps> = ({
  onSelectRequest,
  onNavigatePerfil,
}) => {
  const [filter, setFilter] = useState<SolicitudFilter>('todos');

  const filtered = MOCK_ADMIN_REQUESTS.filter((req) => {
    if (filter === 'pacientes') return req.role === 'Paciente';
    if (filter === 'medicos') return req.role === 'Médico';
    return true;
  });

  const counts = {
    todos: MOCK_ADMIN_REQUESTS.length,
    pacientes: MOCK_ADMIN_REQUESTS.filter((r) => r.role === 'Paciente').length,
    medicos: MOCK_ADMIN_REQUESTS.filter((r) => r.role === 'Médico').length,
  };

  return (
    <View style={styles.container}>
      <TopHeader
        title="Solicitudes"
        onProfilePress={onNavigatePerfil}
        hasUnreadNotifications
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SolicitudesHeaderBanner pendingCount={counts.todos} />

        <FiltroSolicitudes
          filter={filter}
          onSelectFilter={setFilter}
          counts={counts}
        />

        {filtered.map((req) => (
          <SolicitudCard
            key={req.id}
            request={req}
            onPress={() => onSelectRequest(req)}
          />
        ))}

        {/* Bottom verification badge */}
        <View style={styles.infoBanner}>
          <Icon name="shieldCheck" size={18} color={COLORS.primary} />
          <Text style={styles.infoBannerText}>
            Las matrículas médicas se contrastan automáticamente con el
            Registro Nacional de Profesionales de la Salud.
          </Text>
        </View>
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    padding: 14,
    borderRadius: 16,
    gap: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  infoBannerText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },
});

