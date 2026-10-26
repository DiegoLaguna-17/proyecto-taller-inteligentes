import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { RegistroHistorial } from '../../../services/glucosa';
import { clasificacionDeRegistro, etiquetaFechaHora, etiquetaMomento } from '../../../services/historial';

interface RegistrosRecientesMedicoProps {
  /** Lecturas del paciente, más recientes primero. */
  registros: RegistroHistorial[];
  hoy: Date;
  /** Tomas registradas hoy. */
  tomasHoy: number;
}

const ESTILO = {
  Normal: { texto: 'Objetivo', bg: COLORS.normalBg, color: COLORS.normalText, icono: 'check', iconoColor: COLORS.normal },
  'Riesgo Hipo': { texto: 'Riesgo Hipo', bg: COLORS.riesgoHipoBg, color: COLORS.riesgoHipoText, icono: 'arrowTrendingDown', iconoColor: COLORS.riesgoHipo },
  'Riesgo Hiper': { texto: 'Elevado', bg: COLORS.riesgoHiperBg, color: COLORS.riesgoHiperText, icono: 'arrowTrendingUp', iconoColor: COLORS.riesgoHiper },
} as const;

export const RegistrosRecientesMedico: React.FC<RegistrosRecientesMedicoProps> = ({ registros, hoy, tomasHoy }) => {
  return (
    <View style={styles.container} testID="detalle-registros">
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Registros Recientes</Text>
        <Text style={styles.countText}>{tomasHoy === 1 ? '1 toma hoy' : `${tomasHoy} tomas hoy`}</Text>
      </View>

      <View style={styles.list}>
        {registros.slice(0, 4).map((r) => {
          const e = ESTILO[clasificacionDeRegistro(r)];
          return (
            <View key={r.id} style={styles.card} testID={`detalle-registro-${r.id}`}>
              <View style={[styles.iconCircle, { backgroundColor: e.bg }]}>
                <Icon name={e.icono} size={16} color={e.iconoColor} />
              </View>

              <View style={styles.infoCol}>
                <Text style={styles.titleText}>{etiquetaMomento(r.momentoDia)}</Text>
                <Text style={styles.subtitleText}>{etiquetaFechaHora(r.fecha, r.hora, hoy)}</Text>
              </View>

              <View style={styles.valueCol}>
                <Text style={styles.valueText}>
                  {r.nivelGlucosa} <Text style={styles.unitText}>mg/dL</Text>
                </Text>
                <View style={[styles.badge, { backgroundColor: e.bg }]}>
                  <Text style={[styles.badgeText, { color: e.color }]}>{e.texto}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  countText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  titleText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  subtitleText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  valueCol: {
    alignItems: 'flex-end',
  },
  valueText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  unitText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  badgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
});

