import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { EventoAuditoria } from '../../../services/administrador';
import { clasificarEvento, etiquetaFechaEvento } from '../../../services/administradorVista';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface EventoAuditoriaCardProps {
  event: EventoAuditoria;
  hoy: Date;
}

const ROL: Record<string, string> = { login: 'Acceso', paciente: 'Paciente', medico: 'Médico', administrador: 'Administrador' };

// Sin nombres de usuario; IP enmascarada y números de la ruta sustituidos por {id} (ver normalizarAuditoria).
export const EventoAuditoriaCard: React.FC<EventoAuditoriaCardProps> = ({
  event,
  hoy,
}) => {
  const isAlert = !event.exito;
  const isNormal = event.exito;
  const tipo = clasificarEvento(event);

  return (
    <View style={styles.card} testID={`auditoria-evento-${event.id}`}>
      <View style={styles.headerRow}>
        <View style={styles.metaRow}>
          <View style={styles.timePill}>
            <Text style={styles.timeText}>{etiquetaFechaEvento(event, hoy)}</Text>
          </View>
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>{ROL[event.rol] ?? (event.rol || 'Sistema')}</Text>
          </View>
        </View>

        <Icon
          name={
            isAlert
              ? 'alertTriangle'
              : tipo === 'acceso'
              ? 'shieldCheck'
              : tipo === 'modificacion'
              ? 'fileText'
              : 'chart'
          }
          size={16}
          color={isAlert ? COLORS.riesgoHiper : COLORS.textMuted}
        />
      </View>

      <Text style={styles.titleText} numberOfLines={2}>{event.operacion} {event.endpoint}</Text>
      <Text style={styles.descriptionText}>
        Respuesta {event.codigo ?? 'sin código'}
      </Text>

      <View style={styles.footerRow}>
        <Text style={styles.detailText} numberOfLines={1}>
          IP {event.ip}{event.idUsuario !== null ? ` · Usuario #${event.idUsuario}` : ''}
        </Text>
        <View
          style={[
            styles.statusPill,
            isAlert ? styles.statusAlert : styles.statusNormal,
          ]}
        >
          {isNormal && <View style={styles.greenDot} />}
          <Text
            style={[
              styles.statusText,
              isAlert ? styles.statusTextAlert : styles.statusTextNormal,
            ]}
          >
            {isAlert ? 'Con error' : 'Correcto'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 1,
    alignItems: 'center',
    gap: 8,
  },
  timePill: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  timeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textPrimary,
  },
  badgePill: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  titleText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  descriptionText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 8,
  },
  detailText: {
    flex: 1,
    marginRight: 8,
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  statusAlert: {
    backgroundColor: COLORS.riesgoHiperBg,
  },
  statusNormal: {
    backgroundColor: COLORS.normalBg,
  },
  statusDefault: {
    backgroundColor: COLORS.surfaceLight,
  },
  greenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.normal,
  },
  statusText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  statusTextAlert: {
    color: COLORS.riesgoHiperText,
  },
  statusTextNormal: {
    color: COLORS.normalText,
  },
  statusTextDefault: {
    color: COLORS.primary,
  },
});

