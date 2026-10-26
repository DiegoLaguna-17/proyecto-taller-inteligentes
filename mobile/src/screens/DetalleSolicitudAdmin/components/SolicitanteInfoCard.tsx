import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface SolicitanteInfoCardProps {
  initials?: string;
  name?: string;
  roleSubtitle?: string;
  email?: string;
  date?: string;
  institution?: string;
}

export const SolicitanteInfoCard: React.FC<SolicitanteInfoCardProps> = ({
  initials = 'AM',
  name = 'Dr. Alejandro Morales',
  roleSubtitle = 'Médico Especialista',
  email = 'alejandro.morales@hospitalcentral.org',
  date = '24 de Octubre, 2024 · 10:15 AM',
  institution = 'Hospital Central Metropolitano · Diabetología',
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.initialsText}>{initials}</Text>
        </View>
        <View style={styles.nameCol}>
          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.roleText}>{roleSubtitle}</Text>
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>CORREO ELECTRÓNICO</Text>
        <Text style={styles.fieldValue}>{email}</Text>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>FECHA Y HORA DE SOLICITUD</Text>
        <View style={styles.timeRow}>
          <Icon name="clock" size={13} color={COLORS.textSecondary} />
          <Text style={styles.fieldValue}>{date}</Text>
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>INSTITUCIÓN DE PROCEDENCIA</Text>
        <Text style={styles.fieldValue}>{institution}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  initialsText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.primary,
  },
  nameCol: {
    flex: 1,
  },
  nameText: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.textPrimary,
  },
  roleText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 2,
  },
  fieldBlock: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  fieldValue: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});

