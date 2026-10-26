import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { CustomButton } from '../../shared/CustomButton';
import { UltimaTomaCard } from './components/UltimaTomaCard';
import { AvisoPreventivoCard } from './components/AvisoPreventivoCard';
import { ActividadHoyCards } from './components/ActividadHoyCards';
import { LecturasJornadaCard } from './components/LecturasJornadaCard';
import { ContactoClinicoFooter } from './components/ContactoClinicoFooter';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';

interface InicioPacienteProps {
  userName?: string;
  onNavigateRegistrarToma: () => void;
  onNavigateHistorial: () => void;
  onNavigateChatBot: () => void;
  onNavigatePerfil: () => void;
}

export const InicioPaciente: React.FC<InicioPacienteProps> = ({
  userName = 'Carlos',
  onNavigateRegistrarToma,
  onNavigateHistorial,
  onNavigatePerfil,
}) => {
  return (
    <View style={styles.container}>
      <TopHeader
        title="Inicio"
        onProfilePress={onNavigatePerfil}
        hasUnreadNotifications
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Date and Greeting Header */}
        <View style={styles.greetingHeader}>
          <View>
            <Text style={styles.dateText}>Jueves, 24 de Octubre</Text>
            <Text style={styles.greetingText}>Hola, {userName}</Text>
          </View>
          <View style={styles.inRangeBadge}>
            <View style={styles.blueDot} />
            <Text style={styles.inRangeText}>En rango hoy</Text>
          </View>
        </View>

        {/* Big Action Button: Registrar toma */}
        <CustomButton
          title="Registrar toma"
          onPress={onNavigateRegistrarToma}
          iconLeft="drop"
          size="lg"
          style={styles.actionBtn}
        />

        {/* Cards */}
        <UltimaTomaCard />
        <AvisoPreventivoCard onPress={onNavigateHistorial} />
        <ActividadHoyCards onPressDesglose={onNavigateHistorial} />
        <LecturasJornadaCard />
        <ContactoClinicoFooter doctorName="Dra. Morales" />
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
  greetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dateText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  greetingText: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  inRangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  blueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  inRangeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  actionBtn: {
    marginBottom: 20,
  },
});

