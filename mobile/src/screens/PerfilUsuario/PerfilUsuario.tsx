import React from 'react';
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
import { PerfilHeaderCard } from './components/PerfilHeaderCard';
import { FichaClinicaCard } from './components/FichaClinicaCard';
import { ConfiguracionMenu } from './components/ConfiguracionMenu';
import { UserProfile } from '../../utils/mockData';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';

interface PerfilUsuarioProps {
  user: UserProfile;
  onLogout: () => void;
}

export const PerfilUsuario: React.FC<PerfilUsuarioProps> = ({
  user,
  onLogout,
}) => {
  const handleConfirmLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que deseas salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <TopHeader title="Perfil" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PerfilHeaderCard user={user} />

        <FichaClinicaCard user={user} />

        <ConfiguracionMenu />

        {/* Logout Button */}
        <CustomButton
          title="Cerrar sesión"
          onPress={handleConfirmLogout}
          iconLeft="logout"
          variant="outline"
          size="lg"
          style={styles.logoutBtn}
          textStyle={styles.logoutText}
        />

        {/* Legal Footnote */}
        <View style={styles.legalSection}>
          <View style={styles.versionRow}>
            <Icon name="shieldCheck" size={14} color={COLORS.textSecondary} />
            <Text style={styles.versionText}>GlucoTracker v1.0.4</Text>
          </View>
          <Text style={styles.legalText}>
            Cumplimiento estricto con normativas de protección de datos de salud y
            consentimiento informado.
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
    paddingBottom: 32,
  },
  logoutBtn: {
    backgroundColor: COLORS.backgroundWhite,
    borderColor: COLORS.borderCard,
    marginBottom: 24,
  },
  logoutText: {
    color: COLORS.riesgoHiper,
  },
  legalSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  versionText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  legalText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

