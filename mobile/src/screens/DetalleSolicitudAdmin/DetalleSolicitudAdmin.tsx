import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { Icon } from '../../shared/Icon';
import { ModalMensaje } from '../../shared/ModalMensaje';
import { SolicitanteInfoCard, CampoSolicitante } from './components/SolicitanteInfoCard';
import { AcreditacionMedicaCard } from './components/AcreditacionMedicaCard';
import { AlcancePermisosCard } from './components/AlcancePermisosCard';
import { AccionesSolicitud } from './components/AccionesSolicitud';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { tomarTurno, liberarTurno } from '../../utils/turno';
import { UsuarioAdmin, activarUsuario } from '../../services/administrador';
import { iniciales } from '../../services/medicoVista';
import { mensajeDeError } from '../../services/http';

interface DetalleSolicitudAdminProps {
  request: UsuarioAdmin;
  /** id_admin de la sesión (id_rol): lo exige el backend al activar. */
  idAdmin: number;
  onBack: () => void;
  /** Se llama tras activar con éxito, para volver a la lista (que se recarga). */
  onFinishAction: () => void;
  onNavigatePerfil?: () => void;
}

const dato = (v: string | null | undefined) => (v && v.trim() ? v : 'No registrado');

function camposDe(u: UsuarioAdmin): CampoSolicitante[] {
  const comunes: CampoSolicitante[] = [
    { etiqueta: 'Correo electrónico', valor: dato(u.correo) },
    { etiqueta: 'Teléfono', valor: dato(u.telefono) },
    { etiqueta: 'Fecha de nacimiento', valor: dato(u.fechaNac) },
  ];
  if (u.rol === 'Médico') return [...comunes, { etiqueta: 'Departamento', valor: dato(u.departamento) }];
  return [
    ...comunes,
    { etiqueta: 'Género', valor: dato(u.genero) },
    { etiqueta: 'Médico asignado', valor: dato(u.medico) },
    { etiqueta: 'Afecciones', valor: u.afecciones.length > 0 ? u.afecciones.join(', ') : 'No registradas' },
    {
      etiqueta: 'Tratamientos',
      valor: u.tratamientos.length > 0 ? u.tratamientos.map((t) => (t.dosis ? `${t.titulo} (${t.dosis})` : t.titulo)).join(', ') : 'No registrados',
    },
    { etiqueta: 'Contacto de emergencia', valor: u.nombreEmergencia ? `${u.nombreEmergencia}${u.numeroEmergencia ? ` · ${u.numeroEmergencia}` : ''}` : 'No registrado' },
    ...(u.embarazo ? [{ etiqueta: 'Embarazo', valor: u.semanas !== null ? `${u.semanas} semanas` : 'En curso' }] : []),
  ];
}

export const DetalleSolicitudAdmin: React.FC<DetalleSolicitudAdminProps> = ({
  request,
  idAdmin,
  onBack,
  onFinishAction,
  onNavigatePerfil,
}) => {
  const [confirmar, setConfirmar] = useState(false);
  const [activando, setActivando] = useState(false);
  const turno = useRef(false); // guarda síncrona contra el doble toque
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);

  const activar = async () => {
    if (activando) return; // sin doble envío
    if (!tomarTurno(turno)) return;
    setActivando(true);
    try {
      await activarUsuario(request.rol === 'Médico' ? 'Médico' : 'Paciente', request.id, idAdmin);
      setConfirmar(false);
      setResultado({ ok: true, mensaje: `La cuenta de ${request.nombre} quedó activa.` });
    } catch (e) {
      setConfirmar(false);
      setResultado({ ok: false, mensaje: mensajeDeError(e) });
    } finally {
      setActivando(false);
      liberarTurno(turno);
    }
  };

  return (
    <View style={styles.container}>
      <TopHeader
        title={`Detalle De ${request.rol}`}
        showBack
        onBack={onBack}
        onProfilePress={onNavigatePerfil}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation pill & Status */}
        <View style={styles.topStatusRow}>
          <TouchableOpacity
            style={styles.backPill}
            onPress={onBack}
            activeOpacity={0.7}
            testID="solicitud-volver"
          >
            <Icon name="arrowLeft" size={14} color={COLORS.primary} />
            <Text style={styles.backPillText}>Solicitudes</Text>
          </TouchableOpacity>

          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>PENDIENTE DE ACTIVACIÓN</Text>
          </View>
        </View>

        <Text style={styles.mainTitle}>Validación de Solicitud</Text>
        <Text style={styles.subtitle}>
          Revisa los datos {request.rol === 'Médico' ? 'y los documentos ' : ''}antes de activar la cuenta.
        </Text>

        <SolicitanteInfoCard
          initials={iniciales(request.nombre)}
          name={request.nombre}
          roleSubtitle={request.rol === 'Médico' ? 'Médico' : request.resumen}
          campos={camposDe(request)}
        />

        {request.rol === 'Médico' && (
          <AcreditacionMedicaCard matriculaUrl={request.matriculaUrl} carnetUrl={request.carnetUrl} />
        )}

        <AlcancePermisosCard />

        <AccionesSolicitud onAccept={() => setConfirmar(true)} loading={activando} />
      </ScrollView>

      <ModalMensaje
        visible={confirmar}
        titulo="¿Activar esta cuenta?"
        mensaje={`Se activará la cuenta de ${request.nombre} (${request.rol}). No se puede deshacer desde la app.`}
        textoConfirmar="Activar"
        onConfirm={activar}
        textoCancelar="Cancelar"
        onCancel={() => setConfirmar(false)}
        loading={activando}
        testIDPrefix="solicitud-confirmacion"
      />

      <ModalMensaje
        visible={resultado !== null}
        titulo={resultado?.ok ? 'Cuenta activada' : 'No se pudo activar'}
        mensaje={resultado?.mensaje ?? ''}
        textoConfirmar={resultado?.ok ? 'Volver a solicitudes' : 'Cerrar'}
        onConfirm={() => {
          const ok = resultado?.ok;
          setResultado(null);
          if (ok) onFinishAction();
        }}
        testIDPrefix="solicitud-resultado"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  topStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  backPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  statusPill: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusPillText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  mainTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
});

