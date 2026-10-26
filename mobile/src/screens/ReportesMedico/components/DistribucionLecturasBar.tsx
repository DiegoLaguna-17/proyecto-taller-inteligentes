import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { MetricasReporte } from '../../../services/medicoVista';

interface DistribucionLecturasBarProps {
  metricas: MetricasReporte;
}

export const DistribucionLecturasBar: React.FC<DistribucionLecturasBarProps> = ({ metricas }) => {
  return (
    <View style={styles.card} testID="reportes-distribucion">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Distribución de lecturas</Text>
        <Text style={styles.countText}>{metricas.total} mediciones</Text>
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barSegment, { width: `${metricas.pctBajo}%`, backgroundColor: COLORS.riesgoHipo }]} />
        <View style={[styles.barSegment, { width: `${metricas.pctRango}%`, backgroundColor: COLORS.primary }]} />
        <View style={[styles.barSegment, { width: `${metricas.pctAlto}%`, backgroundColor: '#94A3B8' }]} />
      </View>

      <View style={styles.labelsRow}>
        <Text style={styles.segmentLabel}>Bajo {metricas.pctBajo}%</Text>
        <Text style={[styles.segmentLabel, styles.boldLabel]}>Rango {metricas.pctRango}%</Text>
        <Text style={styles.segmentLabel}>Alto {metricas.pctAlto}%</Text>
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

