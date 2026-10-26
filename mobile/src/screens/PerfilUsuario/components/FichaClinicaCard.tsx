import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { CustomButton } from '../../../shared/CustomButton';
import { UserProfile } from '../../../utils/tipos';
import { PerfilPaciente } from '../../../services/paciente';
import { PerfilMedico } from '../../../services/medico';
import { PerfilAdmin } from '../../../services/administrador';
import { textoRangoMeta } from '../../../services/umbrales';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface FichaClinicaCardProps {
  user: UserProfile;
  /** Perfil real del paciente; null si no se pudo cargar. */
  perfil?: PerfilPaciente | null;
  /** Semanas de embarazo actuales (cálculo del servidor); null si no aplica. */
  semanas?: number | null;
  /** % de lecturas dentro del rango meta de los últimos 7 días; null si no hay lecturas. */
  enRangoSemana?: number | null;
  /** Perfil real del médico; null si no se pudo cargar. */
  perfilMedico?: PerfilMedico | null;
  /** Perfil real del administrador; null si no se pudo cargar. */
  perfilAdmin?: PerfilAdmin | null;
  /** true mientras se pide el perfil (en ese caso no se muestra el error). */
  cargandoPerfil?: boolean;
  /** Reintenta la carga del perfil (se ofrece junto al mensaje de error). */
  onReintentar?: () => void;
}

export const FichaClinicaCard: React.FC<FichaClinicaCardProps> = ({
  user,
  perfil = null,
  semanas = null,
  enRangoSemana = null,
  perfilMedico = null,
  perfilAdmin = null,
  cargandoPerfil = false,
  onReintentar,
}) => {
  const isPaciente = user.role === 'paciente';

  // Estado del perfil que falta: cargando o error con reintento
  const estado = (testID: string, mensaje: string) =>
    cargandoPerfil ? (
      <Text style={styles.itemSub} testID="perfil-cargando">Cargando…</Text>
    ) : (
      <View style={styles.estadoCol}>
        <Text style={styles.itemSub} testID={testID}>{mensaje}</Text>
        {onReintentar ? (
          <CustomButton title="Reintentar" onPress={onReintentar} variant="secondary" size="sm" style={styles.reintentarBtn} testID="perfil-reintentar" />
        ) : null}
      </View>
    );

  if (user.role === 'medico') {
    if (!perfilMedico) {
      return (
        <View style={styles.container}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Credenciales Médicas</Text>
          </View>
          <View style={styles.card}>
            {estado('perfil-medico-error', 'No se pudieron cargar tus credenciales. Intenta de nuevo más tarde.')}
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container} testID="perfil-medico-ficha">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Credenciales Médicas</Text>
          <Text style={styles.activeBadge}>ACTIVA</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.itemRow}>
            <View style={styles.iconCircle}>
              <Icon name="stethoscope" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.itemLabel}>Especialidad Principal</Text>
              <Text style={styles.itemTitle} testID="perfil-medico-especialidad">
                {perfilMedico.especialidad ?? 'Sin especialidad registrada'}
              </Text>
              <Text style={styles.itemSub} testID="perfil-medico-departamento">
                {perfilMedico.departamento ? `Departamento: ${perfilMedico.departamento}` : 'Sin departamento registrado'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.itemRow}>
            <View style={styles.iconCircle}>
              <Icon name="shieldCheck" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.itemLabel}>Documentos profesionales</Text>
              <Text style={styles.itemTitle} testID="perfil-medico-matricula">
                Matrícula: {perfilMedico.matriculaUrl ? 'cargada' : 'no registrada'}
              </Text>
              <Text style={styles.itemSub} testID="perfil-medico-carnet">
                Carnet: {perfilMedico.carnetUrl ? 'cargado' : 'no registrado'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (!isPaciente) {
    if (!perfilAdmin) {
      return (
        <View style={styles.container}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Datos de Administración</Text>
          </View>
          <View style={styles.card}>
            {estado('perfil-admin-error', 'No se pudieron cargar tus datos. Intenta de nuevo más tarde.')}
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container} testID="perfil-admin-ficha">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Datos de Administración</Text>
          <Text style={styles.activeBadge}>ACTIVA</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.itemRow}>
            <View style={styles.iconCircle}>
              <Icon name="shieldCheck" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.itemLabel}>Cargo</Text>
              <Text style={styles.itemTitle} testID="perfil-admin-cargo">
                {perfilAdmin.cargo ?? 'Sin cargo registrado'}
              </Text>
              <Text style={styles.itemSub} testID="perfil-admin-ingreso">
                {perfilAdmin.fechaIngreso ? `Ingreso: ${perfilAdmin.fechaIngreso}` : 'Fecha de ingreso no registrada'}
              </Text>
            </View>
          </View>

          {perfilAdmin.admitidoPor ? (
            <>
              <View style={styles.divider} />
              <View style={styles.itemRow}>
                <View style={styles.iconCircle}>
                  <Icon name="userCheck" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.itemLabel}>Admitido por</Text>
                  <Text style={styles.itemTitle} testID="perfil-admin-admitido">{perfilAdmin.admitidoPor}</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </View>
    );
  }

  if (!perfil) {
    return (
      <View style={styles.container}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ficha Clínica de Referencia</Text>
        </View>
        <View style={styles.card}>
          {estado('perfil-ficha-error', 'No se pudo cargar tu ficha clínica. Intenta de nuevo más tarde.')}
        </View>
      </View>
    );
  }

  const tratamientos = perfil.tratamientos
    .map((t) => (t.dosis ? `${t.titulo} · ${t.dosis}` : t.titulo))
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.container} testID="perfil-ficha">
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
            <Text style={styles.itemTitle} testID="perfil-condicion">
              {perfil.afecciones.length > 0 ? perfil.afecciones.join(', ') : 'Sin afecciones registradas'}
            </Text>
            <Text style={styles.itemSub} testID="perfil-tratamientos">
              {tratamientos ? `Tratamiento: ${tratamientos}` : 'Sin tratamientos registrados'}
            </Text>
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
            <Text style={styles.itemTitle} testID="perfil-medico">
              {perfil.nombreMedico ?? 'Sin médico asignado'}
            </Text>
            {perfil.nivelActividad ? (
              <Text style={styles.itemSub}>Actividad física: {perfil.nivelActividad}</Text>
            ) : null}
          </View>
        </View>

        {perfil.embarazo && (
          <>
            <View style={styles.divider} />
            <View style={styles.itemRow}>
              <View style={styles.iconCircle}>
                <Icon name="user" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.itemLabel}>Embarazo</Text>
                <Text style={styles.itemTitle} testID="perfil-embarazo">
                  {semanas !== null ? `${semanas} semanas` : 'En curso'}
                </Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.divider} />

        {/* Item 3 */}
        <View style={styles.itemRow}>
          <View style={styles.iconCircle}>
            <Icon name="sliders" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.infoCol}>
            <View style={styles.rangeHeader}>
              <Text style={styles.itemLabel}>Rango glucémico objetivo</Text>
              <Text style={styles.rangeStatus} testID="perfil-en-rango">
                {enRangoSemana === null ? 'Sin lecturas (7 días)' : `${enRangoSemana}% en rango (7 días)`}
              </Text>
            </View>
            <Text style={styles.rangeValue}>
              {textoRangoMeta(' - ')} <Text style={styles.rangeUnit}>mg/dL</Text>
            </Text>
            <View style={styles.rangeTrack}>
              <View style={[styles.rangeFill, { width: `${enRangoSemana ?? 0}%` }]} />
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
  estadoCol: {
    gap: 10,
    alignItems: 'flex-start',
  },
  reintentarBtn: {
    width: 'auto',
    minWidth: 120,
  },
});

