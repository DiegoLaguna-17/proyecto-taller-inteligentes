import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export interface LecturaAnterior {
  id: number;
  momento: string;
  cuando: string;
  valor: number;
  /** Nombre del ícono: sun | utensils | moon */
  icono: string;
}

interface LecturasJornadaCardProps {
  lecturas: LecturaAnterior[];
}

export const LecturasJornadaCard: React.FC<LecturasJornadaCardProps> = ({ lecturas }) => {
  if (lecturas.length === 0) return null;
  return (
    <View style={styles.container} testID="inicio-lecturas-anteriores">
      <Text style={styles.sectionTitle}>LECTURAS ANTERIORES</Text>
      <View style={styles.card}>
        {lecturas.map((l, i) => (
          <React.Fragment key={l.id}>
            {i > 0 && <View style={styles.divider} />}
            <View style={styles.row}>
              <View style={styles.iconCircle}>
                <Icon name={l.icono} size={18} color={COLORS.primary} />
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.momentTitle}>{l.momento}</Text>
                <Text style={styles.timeSubtitle}>{l.cuando}</Text>
              </View>
              <View style={styles.valueCol}>
                <Text style={styles.valueText}>
                  {l.valor} <Text style={styles.unitText}>mg/dL</Text>
                </Text>
              </View>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  momentTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  timeSubtitle: {
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
    fontSize: 17,
    color: COLORS.textPrimary,
  },
  unitText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
});

