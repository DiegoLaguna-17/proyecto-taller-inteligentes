import React from 'react';
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
import { SolicitanteInfoCard } from './components/SolicitanteInfoCard';
import { AcreditacionMedicaCard } from './components/AcreditacionMedicaCard';
import { AlcancePermisosCard } from './components/AlcancePermisosCard';
import { AccionesSolicitud } from './components/AccionesSolicitud';
import { AdminRequest } from '../../utils/mockData';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';

interface DetalleSolicitudAdminProps {
  request?: AdminRequest;
  onBack: () => void;
  onFinishAction: () => void;
  onNavigatePerfil?: () => void;
}

export const DetalleSolicitudAdmin: React.FC<DetalleSolicitudAdminProps> = ({
  request,
  onBack,
  onFinishAction,
  onNavigatePerfil,
}) => {
  const req = request || {
    id: 'req1',
    name: 'Dr. Alejandro Morales',
    role: 'Médico',
    specialtyOrDiagnosis: 'Médico Endocrinólogo',
    licenseNumber: 'MN 142.890',
    institution: 'Hospital Central Metropolitano · Diabetología',
    email: 'alejandro.morales@hospitalcentral.org',
    date: '24 de Octubre, 2024 · 10:15 AM',
    timeAgo: 'Recibido hace 1 hora',
    initials: 'AM',
    status: 'Pendiente',
  };

  const handleAccept = () => {
    Alert.alert(
      'Solicitud Aprobada',
      `Se ha autorizado el acceso al sistema para ${req.name}. Se le ha enviado un correo con sus credenciales.`,
      [{ text: 'Entendido', onPress: onFinishAction }]
    );
  };

  const handleReject = () => {
    Alert.alert(
      'Rechazar Solicitud',
      `¿Confirmas el rechazo de la solicitud de ${req.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Rechazo',
          style: 'destructive',
          onPress: onFinishAction,
        },
      ]
    );
  };

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
            <Text style={styles.backPillText}>Solicitudes</Text>
          </TouchableOpacity>

          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>PENDIENTE DE REVISIÓN</Text>
          </View>
        </View>

        <Text style={styles.mainTitle}>Validación de Solicitud</Text>
        <Text style={styles.subtitle}>
          Revisa los datos profesionales antes de autorizar el acceso clínico.
        </Text>

        <SolicitanteInfoCard
          initials={req.initials}
          name={req.name}
          roleSubtitle={req.specialtyOrDiagnosis}
          email={req.email}
          date={req.date}
          institution={req.institution || 'Hospital Central Metropolitano'}
        />

        {req.role === 'Médico' && (
          <AcreditacionMedicaCard
            license={req.licenseNumber || 'MN 142.890'}
          />
        )}

        <AlcancePermisosCard />

        <AccionesSolicitud onAccept={handleAccept} onReject={handleReject} />
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
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusPillText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 0.5,
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
});

