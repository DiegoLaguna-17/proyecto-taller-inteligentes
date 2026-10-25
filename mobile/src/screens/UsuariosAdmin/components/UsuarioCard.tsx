import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { AdminUser } from '../../../utils/mockData';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface UsuarioCardProps {
  user: AdminUser;
  onPress: () => void;
}

export const UsuarioCard: React.FC<UsuarioCardProps> = ({ user, onPress }) => {
  const isActive = user.status === 'Activo';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarCircle}>
        <Text style={styles.initialsText}>{user.initials}</Text>
      </View>

      <View style={styles.infoCol}>
        <View style={styles.nameRow}>
          <Text style={styles.nameText} numberOfLines={1}>
            {user.name}
          </Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{user.role}</Text>
          </View>
        </View>
        <Text style={styles.emailText} numberOfLines={1}>
          {user.email}
        </Text>
      </View>

      <View
        style={[
          styles.statusBadge,
          isActive ? styles.statusBadgeActive : styles.statusBadgeInactive,
        ]}
      >
        <View
          style={[
            styles.dot,
            { backgroundColor: isActive ? COLORS.normal : COLORS.textMuted },
          ]}
        />
        <Text
          style={[
            styles.statusText,
            { color: isActive ? COLORS.normalText : COLORS.textSecondary },
          ]}
        >
          {user.status}
        </Text>
      </View>

      <Icon name="chevronRight" size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  initialsText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.primary,
  },
  infoCol: {
    flex: 1,
    marginRight: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  nameText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
    maxWidth: '65%',
  },
  rolePill: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  roleText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  emailText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 5,
    marginRight: 6,
  },
  statusBadgeActive: {
    backgroundColor: COLORS.normalBg,
  },
  statusBadgeInactive: {
    backgroundColor: COLORS.surfaceLight,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
});

