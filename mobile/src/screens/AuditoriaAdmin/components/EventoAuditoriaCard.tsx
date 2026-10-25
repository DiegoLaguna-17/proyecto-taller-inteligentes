import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { AuditEvent } from '../../../utils/mockData';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface EventoAuditoriaCardProps {
  event: AuditEvent;
}

export const EventoAuditoriaCard: React.FC<EventoAuditoriaCardProps> = ({
  event,
}) => {
  const isAlert = event.statusBadge === 'Prioridad Alta';
  const isNormal = event.statusBadge === 'Normal';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.metaRow}>
          <View style={styles.timePill}>
            <Text style={styles.timeText}>{event.time}</Text>
          </View>
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>{event.badge}</Text>
          </View>
        </View>

        <Icon
          name={
            isAlert
              ? 'alertTriangle'
              : event.type === 'clinical'
              ? 'chart'
              : event.type === 'access'
              ? 'shieldCheck'
              : 'fileText'
          }
          size={16}
          color={isAlert ? COLORS.riesgoHiper : COLORS.textMuted}
        />
      </View>

      <Text style={styles.titleText}>{event.title}</Text>
      <Text style={styles.descriptionText}>{event.description}</Text>

      <View style={styles.footerRow}>
        <Text style={styles.detailText}>{event.detail}</Text>
        <View
          style={[
            styles.statusPill,
            isAlert
              ? styles.statusAlert
              : isNormal
              ? styles.statusNormal
              : styles.statusDefault,
          ]}
        >
          {isNormal && <View style={styles.greenDot} />}
          <Text
            style={[
              styles.statusText,
              isAlert
                ? styles.statusTextAlert
                : isNormal
                ? styles.statusTextNormal
                : styles.statusTextDefault,
            ]}
          >
            {event.statusBadge}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timePill: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  timeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textPrimary,
  },
  badgePill: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  titleText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  descriptionText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 8,
  },
  detailText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  statusAlert: {
    backgroundColor: COLORS.riesgoHiperBg,
  },
  statusNormal: {
    backgroundColor: COLORS.normalBg,
  },
  statusDefault: {
    backgroundColor: COLORS.surfaceLight,
  },
  greenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.normal,
  },
  statusText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  statusTextAlert: {
    color: COLORS.riesgoHiperText,
  },
  statusTextNormal: {
    color: COLORS.normalText,
  },
  statusTextDefault: {
    color: COLORS.primary,
  },
});

