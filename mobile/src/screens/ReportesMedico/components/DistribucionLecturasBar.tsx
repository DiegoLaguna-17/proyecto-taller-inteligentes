import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export const DistribucionLecturasBar: React.FC = () => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Distribución de lecturas</Text>
        <Text style={styles.countText}>864 mediciones</Text>
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barSegment, { width: '4%', backgroundColor: COLORS.riesgoHipo }]} />
        <View style={[styles.barSegment, { width: '74%', backgroundColor: COLORS.primary }]} />
        <View style={[styles.barSegment, { width: '22%', backgroundColor: '#94A3B8' }]} />
      </View>

      <View style={styles.labelsRow}>
        <Text style={styles.segmentLabel}>Bajo 4%</Text>
        <Text style={[styles.segmentLabel, styles.boldLabel]}>Rango 74%</Text>
        <Text style={styles.segmentLabel}>Alto 22%</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  countText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  barTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceLight,
    marginBottom: 10,
  },
  barSegment: {
    height: '100%',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  segmentLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  boldLabel: {
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
});

