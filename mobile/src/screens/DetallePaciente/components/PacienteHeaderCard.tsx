import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface PacienteHeaderCardProps {
  name?: string;
  idCode?: string;
  ageAndCondition?: string;
  phone?: string;
  lastVisit?: string;
}

export const PacienteHeaderCard: React.FC<PacienteHeaderCardProps> = ({
  name = 'Elena Soto',
  idCode = 'ID: #4082',
  ageAndCondition = '48 años · Diabetes Tipo 2',
  phone = '+34 600 293 ...',
  lastVisit = '18 Abr, 2024',
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>ES</Text>
        </View>

        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={styles.nameText}>{name}</Text>
            <View style={styles.idPill}>
              <Text style={styles.idPillText}>{idCode}</Text>
            </View>
          </View>
          <Text style={styles.conditionText}>{ageAndCondition}</Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.subBox}>
          <View style={styles.iconCircle}>
            <Icon name="phone" size={14} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.subLabel}>Teléfono</Text>
            <Text style={styles.subValue}>{phone}</Text>
          </View>
        </View>

        <View style={styles.subBox}>
          <View style={styles.iconCircle}>
            <Icon name="calendar" size={14} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.subLabel}>Última Visita</Text>
            <Text style={styles.subValue}>{lastVisit}</Text>
          </View>
        </View>
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
    marginBottom: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  avatarInitials: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
  },
  infoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  nameText: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  idPill: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  idPillText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  conditionText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  subBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.backgroundWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  subValue: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textPrimary,
  },
});

