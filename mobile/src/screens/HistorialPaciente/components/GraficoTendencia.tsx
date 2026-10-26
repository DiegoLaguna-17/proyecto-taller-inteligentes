import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { RegistroHistorial } from '../../../services/glucosa';
import { clasificacionDeRegistro, etiquetaDia } from '../../../services/historial';
import { RANGO_META_MAX, RANGO_META_MIN, textoRangoMeta } from '../../../services/umbrales';
import { DOMINIO_GRAFICO_GLUCOSA, posicionY } from '../../../utils/medidas';

interface GraficoTendenciaProps {
  /** Lecturas del periodo en orden cronológico (máximo 7 puntos). */
  puntos: RegistroHistorial[];
  /** Porcentaje de lecturas dentro del rango meta; null si no hay datos. */
  tir: number | null;
}

// Escala: dominio 40-240 mg/dL sobre el área del gráfico (y=10 arriba, y=130 abajo); los límites del rango meta
// salen de umbrales.ts, así que cambiar el rango mueve la banda sin tocar este archivo.
const ALTO_SVG = 140;
const yDe = (valor: number) => posicionY(valor, DOMINIO_GRAFICO_GLUCOSA, 10, 130);
const VALOR_MEDIO = Math.round((RANGO_META_MIN + RANGO_META_MAX) / 2);
const Y_MAX = yDe(RANGO_META_MAX);
const Y_MEDIO = yDe(VALOR_MEDIO);
const Y_MIN = yDe(RANGO_META_MIN);
const xDe = (i: number, n: number) => (n === 1 ? 137 : 10 + (i * 255) / (n - 1));
const COLOR_PUNTO = { Normal: '#2563EB', 'Riesgo Hipo': '#D97706', 'Riesgo Hiper': '#EF4444' } as const;

export const GraficoTendencia: React.FC<GraficoTendenciaProps> = ({ puntos, tir }) => {
  const n = puntos.length;
  const coords = puntos.map((r, i) => ({
    x: xDe(i, n),
    y: yDe(r.nivelGlucosa ?? 0),
    color: COLOR_PUNTO[clasificacionDeRegistro(r)],
    etiqueta: etiquetaDia(r.fecha),
  }));
  const trazo = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.blueDot} />
          <Text style={styles.titleText}>Curva de tendencia</Text>
        </View>
        <Text style={styles.metaLegend}>— Meta {textoRangoMeta()}</Text>
      </View>

      {/* SVG Chart area */}
      <View style={styles.chartContainer}>
        {/* Y Axis labels */}
        <View style={styles.yAxisCol}>
          {[Y_MAX, Y_MEDIO, Y_MIN].map((y, k) => (
            <Text key={k} style={[styles.yAxisLabel, { top: `${(y / ALTO_SVG) * 100}%` }]}>
              {[RANGO_META_MAX, VALOR_MEDIO, RANGO_META_MIN][k]}
            </Text>
          ))}
        </View>

        <View style={styles.svgWrapper}>
          <Svg height="140" width="100%" viewBox="0 0 280 140">
            {/* Guías: límites del rango meta y punto medio (posiciones calculadas con umbrales.ts) */}
            {[Y_MAX, Y_MEDIO, Y_MIN].map((y, k) => (
              <Line
                key={k}
                x1="0"
                y1={y}
                x2="280"
                y2={y}
                stroke={k === 1 ? '#E2E8F0' : '#CBD5E1'}
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            ))}

            {/* Rango meta sombreado */}
            <Rect x="0" y={Y_MAX} width="280" height={Y_MIN - Y_MAX} fill="#E0F2FE" opacity="0.45" />

            {/* Línea de tendencia */}
            {n > 1 && <Path d={trazo} fill="none" stroke="#2563EB" strokeWidth="3" />}

            {/* Puntos de datos (ámbar: hipoglucemia, rojo: hiperglucemia) */}
            {coords.map((c, i) => (
              <Circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={4.5}
                fill={i === n - 1 ? c.color : '#FFFFFF'}
                stroke={c.color}
                strokeWidth={c.color === '#2563EB' ? 2 : 3}
              />
            ))}
          </Svg>

          {/* X Axis labels */}
          <View style={styles.xAxisRow}>
            {coords.map((c, i) => (
              <Text
                key={i}
                style={[styles.xAxisLabel, i === n - 1 && styles.xAxisLabelActive]}
              >
                {c.etiqueta}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footerRow}>
        <View style={styles.legendLeft}>
          <View style={[styles.dot, { backgroundColor: COLORS.normal }]} />
          <Text style={styles.legendText}>Objetivo en rango: {textoRangoMeta(' - ')} mg/dL</Text>
        </View>
        <Text style={styles.tirText} testID="historial-tir">
          TIR: {tir === null ? '--' : `${tir}%`}
        </Text>
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
    height: ALTO_SVG,
    width: 28,
    paddingRight: 8,
  },
  yAxisLabel: {
    position: 'absolute',
    right: 8,
    marginTop: -6,
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

