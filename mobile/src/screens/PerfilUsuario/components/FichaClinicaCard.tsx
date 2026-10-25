import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { UserProfile } from '../../../utils/mockData';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface FichaClinicaCardProps {
  user: UserProfile;
}

export const FichaClinicaCard: React.FC<FichaClinicaCardProps> = ({ user }) => {
  const isPaciente = user.role === 'paciente';

  if (!isPaciente) {
    return (
      <View style={styles.container}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {user.role === 'medico'
              ? 'Credenciales Médicas'
              : 'Privilegios de Seguridad'}
          </Text>
          <Text style={styles.activeBadge}>ACTIVA</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.itemRow}>
            <View style={styles.iconCircle}>
              <Icon
                name={user.role === 'medico' ? 'stethoscope' : 'shieldCheck'}
                size={18}
                color={COLORS.primary}
              />
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.itemLabel}>
                {user.role === 'medico'
                  ? 'Especialidad Principal'
                  : 'Nivel de Control'}
              </Text>
              <Text style={styles.itemTitle}>
                {user.role === 'medico'
                  ? 'Endocrinología y Diabetes'
                  : 'Super Administrador Root'}
              </Text>
              <Text style={styles.itemSub}>
                {user.role === 'medico'
                  ? 'Colegio Médico MN 142.890'
                  : 'Auditoría y Gestión de Cuentas'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Ficha Clínica de Referencia</Text>
        <Text style={styles.activeBadge}>ACTIVA</Text>
      </View>

      <View style={styles.card}>
        {/* Item 1 */}
        <View style={styles.itemRow}>
          <View style={styles.iconCircle}>
            <Icon name="chart" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.itemLabel}>Condición diagnóstica</Text>
            <Text style={styles.itemTitle}>Diabetes Tipo 2</Text>
            <Text style={styles.itemSub}>Diagnosticado en noviembre 2021</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Item 2 */}
        <View style={styles.itemRow}>
          <View style={styles.iconCircle}>
            <Icon name="stethoscope" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.itemLabel}>Médico tratante</Text>
            <Text style={styles.itemTitle}>Dra. Carmen Silva</Text>
            <Text style={styles.itemSub}>
              Clínica Santa María · Endocrinología
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Item 3 */}
        <View style={styles.itemRow}>
          <View style={styles.iconCircle}>
            <Icon name="sliders" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.infoCol}>
            <View style={styles.rangeHeader}>
              <Text style={styles.itemLabel}>Rango glucémico objetivo</Text>
              <Text style={styles.rangeStatus}>Estable</Text>
            </View>
            <Text style={styles.rangeValue}>
              70 - 140 <Text style={styles.rangeUnit}>mg/dL</Text>
            </Text>
            <View style={styles.rangeTrack}>
              <View style={[styles.rangeFill, { width: '85%' }]} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  activeBadge: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  itemLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  itemTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  itemSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  rangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rangeStatus: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  rangeValue: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textPrimary,
    marginVertical: 4,
  },
  rangeUnit: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  rangeTrack: {
    height: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  rangeFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
});

