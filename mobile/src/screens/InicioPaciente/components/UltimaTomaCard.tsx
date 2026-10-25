import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ClassificationBadge } from '../../../shared/ClassificationBadge';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface UltimaTomaCardProps {
  value?: number;
  timeAgo?: string;
  moment?: string;
  targetRange?: string;
  classification?: 'Normal' | 'Riesgo Hipo' | 'Riesgo Hiper';
}

export const UltimaTomaCard: React.FC<UltimaTomaCardProps> = ({
  value = 112,
  timeAgo = 'Hace 2 horas (08:30 AM)',
  moment = 'Ayunas',
  targetRange = 'Objetivo 70-130',
  classification = 'Normal',
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.titleLabel}>ÚLTIMA TOMA REGISTRADA</Text>
          <Text style={styles.timeText}>{timeAgo}</Text>
        </View>
        <ClassificationBadge classification={classification} />
      </View>

      <View style={styles.readingRow}>
        <Text style={styles.readingValue}>{value}</Text>
        <Text style={styles.readingUnit}>mg/dL</Text>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.momentBox}>
          <Icon name="sun" size={16} color={COLORS.primary} />
          <Text style={styles.momentText}>
            Momento: <Text style={styles.boldText}>{moment}</Text>
          </Text>
        </View>

        <View style={styles.targetBox}>
          <Icon name="arrowRight" size={14} color={COLORS.normal} />
          <Text style={styles.targetText}>{targetRange}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4,
  },
  titleLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  timeText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  readingValue: {
    fontFamily: FONTS.bold,
    fontSize: 54,
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  readingUnit: {
    fontFamily: FONTS.medium,
    fontSize: 18,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  momentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  momentText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  boldText: {
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  targetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  targetText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

