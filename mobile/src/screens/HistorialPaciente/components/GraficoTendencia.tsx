import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export const GraficoTendencia: React.FC = () => {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.blueDot} />
          <Text style={styles.titleText}>Curva de tendencia</Text>
        </View>
        <Text style={styles.metaLegend}>— Meta 70-140</Text>
      </View>

      {/* SVG Chart area */}
      <View style={styles.chartContainer}>
        {/* Y Axis labels */}
        <View style={styles.yAxisCol}>
          <Text style={styles.yAxisLabel}>180</Text>
          <Text style={styles.yAxisLabel}>140</Text>
          <Text style={styles.yAxisLabel}>100</Text>
          <Text style={styles.yAxisLabel}>70</Text>
        </View>

        <View style={styles.svgWrapper}>
          <Svg height="140" width="100%" viewBox="0 0 280 140">
            {/* Horizontal guide lines */}
            <Line
              x1="0"
              y1="10"
              x2="280"
              y2="10"
              stroke="#E2E8F0"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <Line
              x1="0"
              y1="40"
              x2="280"
              y2="40"
              stroke="#CBD5E1"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <Line
              x1="0"
              y1="80"
              x2="280"
              y2="80"
              stroke="#E2E8F0"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <Line
              x1="0"
              y1="110"
              x2="280"
              y2="110"
              stroke="#CBD5E1"
              strokeDasharray="3 3"
              strokeWidth="1"
            />

            {/* Target Range Shaded Area (between y=40 (140) and y=110 (70)) */}
            <Rect
              x="0"
              y="40"
              width="280"
              height="70"
              fill="#E0F2FE"
              opacity="0.45"
            />

            {/* Smooth line curve */}
            <Path
              d="M 10 75 Q 35 70, 50 82 T 95 110 T 140 85 T 180 32 T 225 78 T 265 65"
              fill="none"
              stroke="#2563EB"
              strokeWidth="3"
            />

            {/* Data points */}
            {/* J17 (100) */}
            <Circle cx="10" cy="75" r="4.5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
            {/* V18 (115) */}
            <Circle cx="52" cy="72" r="4" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
            {/* S19 (68 - Hipo alert) */}
            <Circle cx="95" cy="110" r="5" fill="#FFFFFF" stroke="#D97706" strokeWidth="3" />
            {/* D20 (110) */}
            <Circle cx="140" cy="85" r="4" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
            {/* L21 (165 - Hiper alert) */}
            <Circle cx="180" cy="32" r="5" fill="#FFFFFF" stroke="#EF4444" strokeWidth="3" />
            {/* M22 (120) */}
            <Circle cx="225" cy="76" r="4" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
            {/* X23 (124 - Current) */}
            <Circle cx="265" cy="65" r="4.5" fill="#2563EB" stroke="#2563EB" strokeWidth="2" />
          </Svg>

          {/* X Axis labels */}
          <View style={styles.xAxisRow}>
            <Text style={styles.xAxisLabel}>J17</Text>
            <Text style={styles.xAxisLabel}>V18</Text>
            <Text style={styles.xAxisLabel}>S19</Text>
            <Text style={styles.xAxisLabel}>D20</Text>
            <Text style={styles.xAxisLabel}>L21</Text>
            <Text style={styles.xAxisLabel}>M22</Text>
            <Text style={[styles.xAxisLabel, styles.xAxisLabelActive]}>X23</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footerRow}>
        <View style={styles.legendLeft}>
          <View style={[styles.dot, { backgroundColor: COLORS.normal }]} />
          <Text style={styles.legendText}>Objetivo en rango: 70 - 140 mg/dL</Text>
        </View>
        <Text style={styles.tirText}>TIR: 88%</Text>
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
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  titleText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  metaLegend: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 165,
    marginVertical: 4,
  },
  yAxisCol: {
    height: 140,
    justifyContent: 'space-between',
    paddingRight: 8,
    alignItems: 'flex-end',
  },
  yAxisLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textMuted,
  },
  svgWrapper: {
    flex: 1,
    height: '100%',
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  xAxisLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  xAxisLabelActive: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 12,
    marginTop: 8,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  tirText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
  },
});

