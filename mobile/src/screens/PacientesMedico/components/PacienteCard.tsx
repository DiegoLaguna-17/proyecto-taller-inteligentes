import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ClassificationBadge } from '../../../shared/ClassificationBadge';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { PacienteConEstado, clasificacionDeAlerta, iniciales } from '../../../services/medicoVista';
import { etiquetaFechaHora } from '../../../services/historial';

interface PacienteCardProps {
  item: PacienteConEstado;
  hoy: Date;
  onPress: () => void;
}

export const PacienteCard: React.FC<PacienteCardProps> = ({ item, hoy, onPress }) => {
  const { paciente, alerta } = item;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`medico-paciente-${paciente.id}`}
    >
      {/* Avatar with optional urgent dot */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatarCircle}>
          <Text style={styles.initialsText}>{iniciales(paciente.nombre)}</Text>
        </View>
        {alerta && <View style={styles.urgentDot} />}
      </View>

      {/* Info col */}
      <View style={styles.infoCol}>
        <View style={styles.nameRow}>
          <Text style={styles.nameText} numberOfLines={1}>
            {paciente.nombre}
          </Text>
          <Text style={styles.codeText}>#{paciente.id}</Text>
        </View>

        {alerta ? (
          <View style={styles.alertRow}>
            <Icon name="bell" size={13} color={COLORS.riesgoHiper} />
            <Text style={styles.alertText}>
              {etiquetaFechaHora(alerta.fecha, alerta.hora, hoy)} · Alerta activa
              {item.alertasActivas > 1 ? ` (+${item.alertasActivas - 1})` : ''}
            </Text>
          </View>
        ) : (
          <Text style={styles.timeText}>Sin alertas activas</Text>
        )}
      </View>

      {/* Value & Badge: solo cuando hay una alerta activa (el estado sale de las alertas) */}
      {alerta && alerta.glucosa !== null && (
        <View style={styles.valueCol}>
          <View style={styles.readingRow}>
            <Text style={styles.readingValue}>{alerta.glucosa}</Text>
            <Text style={styles.readingUnit}>mg/dL</Text>
          </View>
          <ClassificationBadge classification={clasificacionDeAlerta(alerta)} size="sm" />
        </View>
      )}

      {/* Chevron */}
      <Icon name="chevronRight" size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.primary,
  },
  urgentDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.riesgoHiper,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  infoCol: {
    flex: 1,
    marginRight: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
  },
  nameText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
    maxWidth: '75%',
  },
  codeText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  timeText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.riesgoHiperText,
  },
  valueCol: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  readingValue: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  readingUnit: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textSecondary,
    marginLeft: 2,
  },
});

