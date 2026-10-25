import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export const CurvaGlucemiaMedico: React.FC = () => {
  const [periodo, setPeriodo] = useState<'Semanal' | 'Mensual'>('Semanal');

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Curva de Glucemia</Text>
          <Text style={styles.subtitle}>Monitorización continua reciente</Text>
        </View>

        <View style={styles.switchBox}>
          <TouchableOpacity
            style={[
              styles.switchBtn,
              periodo === 'Semanal' && styles.switchBtnActive,
            ]}
            onPress={() => setPeriodo('Semanal')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.switchText,
                periodo === 'Semanal' && styles.switchTextActive,
              ]}
            >
              Semanal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.switchBtn,
              periodo === 'Mensual' && styles.switchBtnActive,
            ]}
            onPress={() => setPeriodo('Mensual')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.switchText,
                periodo === 'Mensual' && styles.switchTextActive,
              ]}
            >
              Mensual
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chartArea}>
        <View style={styles.labelsCol}>
          <Text style={styles.limitLabel}>140 mg/dL (Límite sup.)</Text>
          <Text style={[styles.limitLabel, { color: COLORS.riesgoHipo }]}>
            70 mg/dL (Umbral hipo)
          </Text>
        </View>

        <Svg height="110" width="100%" viewBox="0 0 280 110">
          {/* Target band */}
          <Rect
            x="0"
            y="20"
            width="280"
            height="60"
            fill="#F0F9FF"
            opacity="0.8"
          />
          <Line
            x1="0"
            y1="20"
            x2="280"
            y2="20"
            stroke="#94A3B8"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <Line
            x1="0"
            y1="80"
            x2="280"
            y2="80"
            stroke="#D97706"
            strokeDasharray="4 4"
            strokeWidth="1"
          />

          {/* Curve */}
          <Path
            d="M 10 45 Q 40 40, 80 55 T 150 42 T 210 70 L 260 92"
            fill="none"
            stroke="#2563EB"
            strokeWidth="3"
          />

          <Circle cx="10" cy="45" r="4.5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
          <Circle cx="80" cy="55" r="4" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
          <Circle cx="150" cy="42" r="4" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
          <Circle cx="210" cy="70" r="4" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
          {/* Today: 62 in amber */}
          <Circle cx="260" cy="92" r="6" fill="#FEF3C7" stroke="#D97706" strokeWidth="2.5" />
        </Svg>

        <View style={styles.xLabelsRow}>
          <Text style={styles.xLabel}>Lun 10</Text>
          <Text style={styles.xLabel}>Mar 11</Text>
          <Text style={styles.xLabel}>Mié 12</Text>
          <Text style={styles.xLabel}>Jue 13</Text>
          <Text style={[styles.xLabel, styles.xLabelAlert]}>Hoy (62)</Text>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  switchBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 10,
    padding: 2,
  },
  switchBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  switchBtnActive: {
    backgroundColor: COLORS.backgroundWhite,
  },
  switchText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  switchTextActive: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  chartArea: {
    marginTop: 4,
  },
  labelsCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  limitLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textMuted,
  },
  xLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  xLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  xLabelAlert: {
    fontFamily: FONTS.bold,
    color: COLORS.riesgoHipo,
  },
});

