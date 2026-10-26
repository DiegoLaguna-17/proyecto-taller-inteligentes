import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ClassificationBadge } from '../../../shared/ClassificationBadge';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { RegistroHistorial } from '../../../services/glucosa';
import { clasificacionDeRegistro, etiquetaMomento, fechaCorta } from '../../../services/historial';
import { FONTS } from '../../../utils/typography';

interface TomasListProps {
  /** Registros del periodo, más recientes primero. */
  tomas: RegistroHistorial[];
}

const ICONO_MOMENTO: Record<string, string> = {
  AYUNAS: 'sun',
  'DESPUES DE COMER': 'utensils',
  'ANTES DE DORMIR': 'moon',
};

const ESTILO = {
  Normal: { circleBg: COLORS.surfaceLight, iconColor: COLORS.primary },
  'Riesgo Hipo': { circleBg: COLORS.riesgoHipoBg, iconColor: COLORS.riesgoHipo },
  'Riesgo Hiper': { circleBg: COLORS.riesgoHiperBg, iconColor: COLORS.riesgoHiper },
} as const;

export const TomasList: React.FC<TomasListProps> = ({ tomas }) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Tomas registradas</Text>
        <Text style={styles.countText}>
          {tomas.length === 1 ? '1 registro' : `${tomas.length} registros`}
        </Text>
      </View>

      <View style={styles.list}>
        {tomas.map((item) => {
          const clasificacion = clasificacionDeRegistro(item);
          const estilo = ESTILO[clasificacion];
          const hora = item.hora ? item.hora.slice(0, 5) : '';
          return (
            <View key={item.id} style={styles.card} testID={`historial-toma-${item.id}`}>
              <View style={[styles.iconCircle, { backgroundColor: estilo.circleBg }]}>
                <Icon
                  name={ICONO_MOMENTO[(item.momentoDia ?? '').toUpperCase()] ?? 'drop'}
                  size={18}
                  color={estilo.iconColor}
                />
              </View>

              <View style={styles.infoCol}>
                <View style={styles.readingRow}>
                  <Text style={styles.readingValue}>{item.nivelGlucosa ?? '--'}</Text>
                  <Text style={styles.readingUnit}>mg/dL</Text>
                </View>
                <Text style={styles.detailText}>
                  {etiquetaMomento(item.momentoDia)} · {fechaCorta(item.fecha)}
                  {hora ? `, ${hora}` : ''}
                </Text>
              </View>

              <ClassificationBadge classification={clasificacion} />
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  readingValue: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  readingUnit: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  detailText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});

