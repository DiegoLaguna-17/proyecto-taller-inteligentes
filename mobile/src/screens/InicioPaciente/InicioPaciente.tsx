import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { CustomButton } from '../../shared/CustomButton';
import { UltimaTomaCard } from './components/UltimaTomaCard';
import { AvisoPreventivoCard } from './components/AvisoPreventivoCard';
import { ActividadHoyCards } from './components/ActividadHoyCards';
import { LecturasJornadaCard } from './components/LecturasJornadaCard';
import { ContactoClinicoFooter } from './components/ContactoClinicoFooter';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { FUENTE } from '../../utils/medidas';
import { USE_MOCK } from '../../services/config';
import { obtenerRegistros, RegistroHistorial } from '../../services/glucosa';
import {
  clasificacionDeRegistro,
  etiquetaFechaHora,
  etiquetaMomento,
  fechaLarga,
  haceCuanto,
  resumenInicio,
} from '../../services/historial';
import { mensajeDeError } from '../../services/http';
import { LECTURAS_DIARIAS_ESPERADAS } from '../../services/umbrales';

// Momentos del catálogo (ayunas, después de comer, antes de dormir): meta diaria de tomas
const META_TOMAS = LECTURAS_DIARIAS_ESPERADAS;

const ICONO: Record<string, string> = { AYUNAS: 'sun', 'DESPUES DE COMER': 'utensils', 'ANTES DE DORMIR': 'moon' };
const iconoDe = (r: RegistroHistorial) => ICONO[(r.momentoDia ?? '').toUpperCase()] ?? 'drop';

interface InicioPacienteProps {
  /** id_paciente de la sesión. */
  idPaciente: number;
  /** Primer nombre del perfil real; null si el perfil no se pudo cargar (se usa un texto genérico). */
  nombre: string | null;
  /** Médico asignado (perfil); null si no se conoce. */
  nombreMedico: string | null;
  onNavigateRegistrarToma: () => void;
  onNavigateHistorial: () => void;
  onNavigateChatBot: () => void;
  onNavigatePerfil: () => void;
}

export const InicioPaciente: React.FC<InicioPacienteProps> = ({
  idPaciente,
  nombre,
  nombreMedico,
  onNavigateRegistrarToma,
  onNavigateHistorial,
  onNavigatePerfil,
}) => {
  const [registros, setRegistros] = useState<RegistroHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setRegistros(await obtenerRegistros(idPaciente));
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [idPaciente]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const hoy = useMemo(() => new Date(), []);
  const resumen = useMemo(() => resumenInicio(registros, hoy), [registros, hoy]);
  const ultima = resumen.ultima;

  return (
    <View style={styles.container}>
      {/* El punto de notificaciones sin leer no tiene fuente real: solo se muestra en modo simulado */}
      <TopHeader
        title="Inicio"
        onProfilePress={onNavigatePerfil}
        hasUnreadNotifications={USE_MOCK}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Date and Greeting Header */}
        <View style={styles.greetingHeader}>
          <View>
            <Text style={styles.dateText} testID="inicio-fecha">{fechaLarga(hoy)}</Text>
            <Text style={styles.greetingText} testID="inicio-saludo">
              Hola, {nombre ?? 'Paciente'}
            </Text>
          </View>
          {resumen.enRangoHoy !== null && (
            <View style={styles.inRangeBadge}>
              <View style={styles.blueDot} />
              <Text style={styles.inRangeText} testID="inicio-en-rango">
                {resumen.enRangoHoy ? 'En rango hoy' : 'Fuera de rango hoy'}
              </Text>
            </View>
          )}
        </View>

        {/* Big Action Button: Registrar toma */}
        <CustomButton
          title="Registrar toma"
          onPress={onNavigateRegistrarToma}
          iconLeft="drop"
          size="lg"
          style={styles.actionBtn}
          testID="inicio-registrar-toma"
        />

        {cargando ? (
          <View style={styles.estadoBox} testID="inicio-cargando">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="inicio-error">{error}</Text>
            <CustomButton title="Reintentar" onPress={cargar} testID="inicio-reintentar" />
          </View>
        ) : !ultima ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="inicio-vacio">
              Aún no has registrado tomas. Pulsa "Registrar toma" para empezar.
            </Text>
          </View>
        ) : (
          <>
            <UltimaTomaCard
              value={ultima.nivelGlucosa as number}
              timeAgo={haceCuanto(ultima.fecha, ultima.hora, hoy)}
              moment={etiquetaMomento(ultima.momentoDia)}
              classification={clasificacionDeRegistro(ultima)}
            />
            <AvisoPreventivoCard cantidad={resumen.fueraDeRango3d} onPress={onNavigateHistorial} />
            <ActividadHoyCards
              tomas={resumen.deHoy.length}
              meta={META_TOMAS}
              promedio={resumen.promedioHoy}
              enRango={resumen.enRangoHoy}
              onPressDesglose={onNavigateHistorial}
            />
            <LecturasJornadaCard
              lecturas={resumen.anteriores.map((r) => ({
                id: r.id,
                momento: etiquetaMomento(r.momentoDia),
                cuando: etiquetaFechaHora(r.fecha, r.hora, hoy),
                valor: r.nivelGlucosa as number,
                icono: iconoDe(r),
              }))}
            />
          </>
        )}

        {nombreMedico ? <ContactoClinicoFooter doctorName={nombreMedico} /> : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  estadoBox: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  estadoText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  greetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dateText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  greetingText: {
    fontFamily: FONTS.bold,
    fontSize: FUENTE.tituloGrande,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  inRangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  blueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  inRangeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  actionBtn: {
    marginBottom: 20,
  },
});

