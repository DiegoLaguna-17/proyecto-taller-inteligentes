import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { UserProfile } from '../../../utils/tipos';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { FUENTE } from '../../../utils/medidas';

interface PerfilHeaderCardProps {
  user: UserProfile;
}

export const PerfilHeaderCard: React.FC<PerfilHeaderCardProps> = ({ user }) => {
  return (
    <View style={styles.container}>
      {/* Avatar with verified badge */}
      <View style={styles.avatarWrapper}>
        <View style={styles.avatarCircle}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} testID="perfil-foto" />
          ) : (
            <Text style={styles.initialsText}>{user.initials}</Text>
          )}
        </View>
        <View style={styles.verifiedBadge}>
          <Icon name="checkBadge" size={16} color={COLORS.primary} />
        </View>
      </View>

      <Text style={styles.nameText} testID="perfil-nombre">{user.name}</Text>

      <View style={styles.rolePill}>
        <Icon
          name={
            user.role === 'medico'
              ? 'stethoscope'
              : user.role === 'admin'
              ? 'settings'
              : 'idCard'
          }
          size={14}
          color={COLORS.primary}
        />
        <Text style={styles.rolePillText}>
          {user.badge || (user.role === 'paciente' ? 'Paciente' : user.role === 'medico' ? 'Médico' : 'Administrador')}
        </Text>
      </View>

      <View style={styles.contactInfo}>
        <View style={styles.contactRow}>
          <Icon name="mail" size={14} color={COLORS.textSecondary} />
          <Text style={styles.contactText} testID="perfil-correo">{user.email}</Text>
        </View>
        {user.phone && (
          <View style={styles.contactRow}>
            <Icon name="phone" size={14} color={COLORS.textSecondary} />
            <Text style={styles.contactText} testID="perfil-telefono">{user.phone}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  initialsText: {
    fontFamily: FONTS.bold,
    fontSize: FUENTE.tituloGrande,
    color: COLORS.primary,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  nameText: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  rolePillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  contactInfo: {
    alignItems: 'center',
    gap: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});

