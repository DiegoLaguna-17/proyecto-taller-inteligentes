import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ClassificationBadge } from '../../../shared/ClassificationBadge';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { AlertaMedico } from '../../../services/medico';
import { clasificacionDeAlerta } from '../../../services/medicoVista';
import { etiquetaFechaHora, etiquetaMomento } from '../../../services/historial';

interface AlertaCardProps {
  alert: AlertaMedico;
  hoy: Date;
  onPress: () => void;
}

export const AlertaCard: React.FC<AlertaCardProps> = ({ alert, hoy, onPress }) => {
  const clasificacion = clasificacionDeAlerta(alert);
  const isHiper = clasificacion === 'Riesgo Hiper';
  const valColor = isHiper ? COLORS.riesgoHiper : COLORS.primary;
  // Resuelta: se muestra la respuesta del médico; activa: las observaciones o el momento de la toma
  const descripcion = alert.mensaje
    ? `Respuesta: ${alert.mensaje}`
    : alert.observaciones || etiquetaMomento(alert.momento);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`alertas-alerta-${alert.id}`}
    >
      <View style={styles.topRow}>
        <View style={styles.avatarCircle}>
          <Icon name="user" size={18} color={COLORS.primary} />
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.patientName}>{alert.paciente}</Text>
          <Text style={styles.timeText}>{etiquetaFechaHora(alert.fecha, alert.hora, hoy)}</Text>
        </View>

        <ClassificationBadge classification={clasificacion} size="sm" />

        <Icon
          name="chevronRight"
          size={18}
          color={COLORS.textMuted}
          style={{ marginLeft: 6 }}
        />
      </View>

      <View style={styles.detailBox}>
        <Text style={styles.descriptionText} numberOfLines={1}>
          {descripcion}
        </Text>
        {alert.glucosa !== null && (
          <Text style={[styles.valText, { color: valColor }]}>
            {alert.glucosa}{' '}
            <Text style={styles.unitText}>mg/dL</Text>
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  infoCol: {
    flex: 1,
  },
  patientName: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  timeText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  detailBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  descriptionText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  valText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  unitText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});

