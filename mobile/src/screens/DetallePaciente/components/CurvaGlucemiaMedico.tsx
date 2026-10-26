import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { RegistroHistorial } from '../../../services/glucosa';
import { clasificacionDeRegistro, etiquetaDia, filtrarPorPeriodo } from '../../../services/historial';
import { GLUCOSA_HIPO_MAX, RANGO_META_MAX, RANGO_META_MIN } from '../../../services/umbrales';
import { DOMINIO_GRAFICO_GLUCOSA, posicionY } from '../../../utils/medidas';

interface CurvaGlucemiaMedicoProps {
  /** Lecturas del paciente, más recientes primero. */
  registros: RegistroHistorial[];
  hoy: Date;
}

// Escala: dominio 40-240 mg/dL sobre el área del gráfico (y=8 arriba, y=100 abajo); los límites salen de umbrales.ts.
const yDe = (v: number) => posicionY(v, DOMINIO_GRAFICO_GLUCOSA, 8, 100);
const Y_MAX = yDe(RANGO_META_MAX);
const Y_MIN = yDe(RANGO_META_MIN);
const xDe = (i: number, n: number) => (n === 1 ? 140 : 10 + (i * 250) / (n - 1));
const COLOR = { Normal: '#2563EB', 'Riesgo Hipo': '#D97706', 'Riesgo Hiper': '#EF4444' } as const;

export const CurvaGlucemiaMedico: React.FC<CurvaGlucemiaMedicoProps> = ({ registros, hoy }) => {
  const [periodo, setPeriodo] = useState<'Semanal' | 'Mensual'>('Semanal');

  // Cronológico y, como máximo, las últimas 7 lecturas del periodo
  const puntos = useMemo(
    () =>
      filtrarPorPeriodo(registros, periodo, hoy)
        .filter((r) => r.nivelGlucosa !== null)
        .slice(0, 7)
        .reverse(),
    [registros, periodo, hoy],
  );
  const n = puntos.length;
  const coords = puntos.map((r, i) => ({
    x: xDe(i, n),
    y: yDe(r.nivelGlucosa as number),
    color: COLOR[clasificacionDeRegistro(r)],
    etiqueta: etiquetaDia(r.fecha),
  }));
  const trazo = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  return (
    <View style={styles.card} testID="detalle-curva">
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Curva de Glucemia</Text>
          <Text style={styles.subtitle}>Lecturas registradas por el paciente</Text>
        </View>

        <View style={styles.switchBox}>
          {(['Semanal', 'Mensual'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.switchBtn, periodo === p && styles.switchBtnActive]}
              onPress={() => setPeriodo(p)}
              activeOpacity={0.8}
              testID={`detalle-periodo-${p.toLowerCase()}`}
            >
              <Text style={[styles.switchText, periodo === p && styles.switchTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.chartArea}>
        <View style={styles.labelsCol}>
          <Text style={styles.limitLabel}>{RANGO_META_MAX} mg/dL (Límite sup.)</Text>
          <Text style={[styles.limitLabel, { color: COLORS.riesgoHipo }]}>
            {GLUCOSA_HIPO_MAX} mg/dL (Umbral hipo)
          </Text>
        </View>

        <Svg height="110" width="100%" viewBox="0 0 280 110">
          {/* Target band */}
          <Rect x="0" y={Y_MAX} width="280" height={Y_MIN - Y_MAX} fill="#F0F9FF" opacity="0.8" />
          <Line x1="0" y1={Y_MAX} x2="280" y2={Y_MAX} stroke="#94A3B8" strokeDasharray="4 4" strokeWidth="1" />
          <Line x1="0" y1={Y_MIN} x2="280" y2={Y_MIN} stroke="#D97706" strokeDasharray="4 4" strokeWidth="1" />

          {/* Curve */}
          {n > 1 && <Path d={trazo} fill="none" stroke="#2563EB" strokeWidth="3" />}
          {coords.map((c, i) => (
            <Circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={i === n - 1 ? 6 : 4.5}
              fill={i === n - 1 ? c.color : '#FFFFFF'}
              stroke={c.color}
              strokeWidth={c.color === '#2563EB' ? 2 : 2.5}
            />
          ))}
        </Svg>

        {n === 0 ? (
          <Text style={styles.vacio} testID="detalle-curva-vacia">Sin lecturas en este periodo.</Text>
        ) : (
          <View style={styles.xLabelsRow}>
            {coords.map((c, i) => (
              <Text key={i} style={[styles.xLabel, i === n - 1 && styles.xLabelAlert]}>
                {c.etiqueta}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  vacio: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
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
    flexWrap: 'wrap',
    gap: 8,
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
    color: COLORS.riesgoHipoText,
  },
});

