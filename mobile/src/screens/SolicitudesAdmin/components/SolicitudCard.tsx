import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { AdminRequest } from '../../../utils/mockData';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface SolicitudCardProps {
  request: AdminRequest;
  onPress: () => void;
}

export const SolicitudCard: React.FC<SolicitudCardProps> = ({
  request,
  onPress,
}) => {
  const isMedico = request.role === 'Médico';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarCircle}>
        <Text style={styles.initialsText}>{request.initials}</Text>
        <View style={styles.roleSubIcon}>
          <Icon
            name={isMedico ? 'stethoscope' : 'user'}
            size={10}
            color="#FFFFFF"
          />
        </View>
      </View>

      <View style={styles.infoCol}>
        <View style={styles.nameRow}>
          <Text style={styles.nameText}>{request.name}</Text>
          <View
            style={[
              styles.rolePill,
              {
                backgroundColor: isMedico
                  ? COLORS.surfaceLight
                  : COLORS.grayPillBg,
              },
            ]}
          >
            <Text
              style={[
                styles.roleText,
                { color: isMedico ? COLORS.primary : COLORS.textSecondary },
              ]}
            >
              {request.role}
            </Text>
          </View>
        </View>

        <Text style={styles.specialtyText} numberOfLines={1}>
          {request.specialtyOrDiagnosis}
          {request.licenseNumber ? ` • ${request.licenseNumber}` : ''}
        </Text>

        <View style={styles.timeRow}>
          <Icon name="clock" size={12} color={COLORS.textMuted} />
          <Text style={styles.timeText}>{request.timeAgo}</Text>
        </View>
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  initialsText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.primary,
  },
  roleSubIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  infoCol: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  nameText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  rolePill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  roleText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  specialtyText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
  },
});

