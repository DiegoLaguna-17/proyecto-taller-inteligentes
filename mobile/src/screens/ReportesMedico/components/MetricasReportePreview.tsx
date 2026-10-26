import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { MetricasReporte, REPORTE_MAX, REPORTE_MIN } from '../../../services/medicoVista';
import { TIR_OBJETIVO_PORCENTAJE } from '../../../services/umbrales';

interface MetricasReportePreviewProps {
  patientName: string;
  metricas: MetricasReporte;
  dias: 7 | 30;
}

export const MetricasReportePreview: React.FC<MetricasReportePreviewProps> = ({
  patientName,
  metricas,
  dias,
}) => {
  const cumpleMeta = metricas.tir !== null && metricas.tir >= TIR_OBJETIVO_PORCENTAJE;
  return (
    <View style={styles.container} testID="reportes-metricas">
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>PREVISUALIZACIÓN DE MÉTRICAS</Text>
        <View style={styles.syncBadge}>
          <View style={styles.blueDot} />
          <Text style={styles.syncText}>
            {metricas.total === 1 ? '1 lectura' : `${metricas.total} lecturas`}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        {/* Header inside card */}
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.patientName}>{patientName}</Text>
            <Text style={styles.calcText}>Resumen de los últimos {dias} días</Text>
          </View>
        </View>

        {/* 2x2 Grid */}
        <View style={styles.grid}>
          {/* Item 1 */}
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Promedio general</Text>
            <View style={styles.valueRow}>
              <Text style={styles.gridBigNum} testID="reportes-promedio">{metricas.promedio ?? '--'}</Text>
              <Text style={styles.gridUnit}>mg/dL</Text>
            </View>
            <View style={styles.indicatorRow}>
              <Icon name="arrowRight" size={12} color={COLORS.primary} />
              <Text style={styles.indicatorPrimary}>Promedio de lecturas</Text>
            </View>
          </View>

          {/* Item 2 */}
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Tiempo en rango (TIR)</Text>
            <View style={styles.valueRow}>
              <Text style={styles.gridBigNum} testID="reportes-tir">{metricas.tir === null ? '--' : `${metricas.tir}%`}</Text>
              <Text style={styles.gridUnit}>{REPORTE_MIN}-{REPORTE_MAX}</Text>
            </View>
            <View style={styles.indicatorRow}>
              <Icon name="check" size={12} color={cumpleMeta ? COLORS.normal : COLORS.textMuted} />
              <Text style={cumpleMeta ? styles.indicatorSuccess : styles.indicatorPrimary}>
                {cumpleMeta ? `Meta >${TIR_OBJETIVO_PORCENTAJE}% cumplida` : `Meta >${TIR_OBJETIVO_PORCENTAJE}%`}
              </Text>
            </View>
          </View>

          {/* Item 3 */}
          <View style={styles.gridItem}>
            <View style={styles.labelWithDot}>
              <Text style={styles.gridLabel}>Hipoglucemias</Text>
              <View style={[styles.grayDot, { backgroundColor: COLORS.textMuted }]} />
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.gridBigNum} testID="reportes-hipo">{metricas.hipo}</Text>
              <Text style={styles.gridSubLabel}>{metricas.hipo === 1 ? 'episodio' : 'episodios'}</Text>
            </View>
            <Text style={styles.rangeSubtext}>&lt; {REPORTE_MIN} mg/dL ({metricas.pctBajo}%)</Text>
          </View>

          {/* Item 4 */}
          <View style={styles.gridItem}>
            <View style={styles.labelWithDot}>
              <Text style={styles.gridLabel}>Hiperglucemias</Text>
              <View style={[styles.grayDot, { backgroundColor: COLORS.textMuted }]} />
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.gridBigNum} testID="reportes-hiper">{metricas.hiper}</Text>
              <Text style={styles.gridSubLabel}>{metricas.hiper === 1 ? 'episodio' : 'episodios'}</Text>
            </View>
            <Text style={styles.rangeSubtext}>&gt; {REPORTE_MAX} mg/dL ({metricas.pctAlto}%)</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  blueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  syncText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  patientName: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  calcText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  validBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 4,
  },
  validText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '48%',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    padding: 12,
  },
  gridLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  labelWithDot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  grayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  gridBigNum: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textPrimary,
  },
  gridUnit: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  gridSubLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  indicatorPrimary: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  indicatorSuccess: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.normalText,
  },
  rangeSubtext: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textMuted,
  },
});

