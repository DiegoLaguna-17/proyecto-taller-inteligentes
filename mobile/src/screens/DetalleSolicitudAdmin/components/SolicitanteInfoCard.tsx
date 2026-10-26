import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export interface CampoSolicitante {
  etiqueta: string;
  valor: string;
}

interface SolicitanteInfoCardProps {
  initials: string;
  name: string;
  roleSubtitle: string;
  campos: CampoSolicitante[];
}

export const SolicitanteInfoCard: React.FC<SolicitanteInfoCardProps> = ({
  initials,
  name,
  roleSubtitle,
  campos,
}) => {
  return (
    <View style={styles.card} testID="solicitud-datos">
      <View style={styles.topRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.initialsText}>{initials}</Text>
        </View>
        <View style={styles.nameCol}>
          <Text style={styles.nameText} testID="solicitud-nombre">{name}</Text>
          <Text style={styles.roleText}>{roleSubtitle}</Text>
        </View>
      </View>

      {campos.map((c) => (
        <View key={c.etiqueta} style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{c.etiqueta.toUpperCase()}</Text>
          <Text style={styles.fieldValue}>{c.valor}</Text>
        </View>
      ))}
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

