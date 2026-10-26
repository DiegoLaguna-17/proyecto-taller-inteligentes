import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { Icon } from '../../shared/Icon';
import { CustomButton } from '../../shared/CustomButton';
import { ValorGlucosaCard, VALOR_MIN, VALOR_MAX } from './components/ValorGlucosaCard';
import { FechaHoraCard } from './components/FechaHoraCard';
import { MomentoTomaSelector, OpcionMomento } from './components/MomentoTomaSelector';
import { RecomendacionCard } from './components/RecomendacionCard';
import { ResultadoClasificacionModal } from './components/ResultadoClasificacionModal';
import { ConfirmarTomaModal } from './components/ConfirmarTomaModal';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { tomarTurno, liberarTurno } from '../../utils/turno';
import { obtenerMomentos, obtenerDatosPaciente, DatosPaciente } from '../../services/glucosa';
import { esMomentoPostComida, momentoDeId } from '../../services/clasificacionGlucosa';
import { registrarToma, ResultadoToma } from '../../services/registroToma';
import { etiquetaMomento } from '../../services/historial';
import { mensajeDeError } from '../../services/http';

interface RegistroTomaProps {
  /** id_paciente de la sesión (id_rol devuelto por POST /api/verify-otp). */
  idPaciente: number;
  onBack: () => void;
  onSaveSuccess: () => void;
}

const dos = (n: number) => String(n).padStart(2, '0');

export const RegistroToma: React.FC<RegistroTomaProps> = ({
  idPaciente,
  onBack,
  onSaveSuccess,
}) => {
  const [valor, setValor] = useState('');
  const [momentos, setMomentos] = useState<OpcionMomento[]>([]);
  const [momentoId, setMomentoId] = useState<number | null>(null);
  const [datos, setDatos] = useState<DatosPaciente | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const turno = useRef(false); // guarda síncrona contra el doble toque
  const [resultado, setResultado] = useState<ResultadoToma | null>(null);
  const [valorGuardado, setValorGuardado] = useState(0);
  const [ahora] = useState(() => new Date());

  // Carga los momentos y los datos del paciente (edad, embarazo, enfermedades, médico)
  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const [lista, paciente] = await Promise.all([obtenerMomentos(), obtenerDatosPaciente(idPaciente)]);
      const opciones = lista
        .filter((m) => momentoDeId(m.id_momento) !== undefined)
        .map((m) => ({
          id: m.id_momento,
          clave: momentoDeId(m.id_momento) as string,
          etiqueta: etiquetaMomento(m.momento),
        }));
      if (opciones.length === 0) throw new Error('sin momentos');
      setMomentos(opciones);
      setDatos(paciente);
    } catch (e) {
      setErrorCarga(
        e instanceof Error && e.message === 'sin momentos'
          ? 'No se pudieron cargar los momentos de la toma.'
          : mensajeDeError(e),
      );
    } finally {
      setCargando(false);
    }
  }, [idPaciente]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const numero = parseInt(valor, 10);
  const etiquetaSeleccionada = momentos.find((m) => m.id === momentoId)?.etiqueta ?? '';

  // Valida y abre la confirmación
  const handleSave = () => {
    setErrorMessage('');
    if (Number.isNaN(numero) || numero < VALOR_MIN || numero > VALOR_MAX) {
      setErrorMessage(`Ingresa un nivel de glucosa entre ${VALOR_MIN} y ${VALOR_MAX} mg/dL.`);
      return;
    }
    if (momentoId === null) {
      setErrorMessage('Selecciona el momento de la toma.');
      return;
    }
    setShowConfirm(true);
  };

  // Clasifica en el cliente, guarda y, si no es NORMAL, registra la alerta
  const handleConfirm = async () => {
    if (!datos || momentoId === null) return;
    if (!tomarTurno(turno)) return;
    setGuardando(true);
    try {
      const r = await registrarToma({ datos, idMomento: momentoId, valor: numero, ahora: new Date() });
      setValorGuardado(numero);
      setResultado(r);
      setShowConfirm(false);
    } catch (e) {
      setShowConfirm(false);
      setErrorMessage(mensajeDeError(e));
    } finally {
      setGuardando(false);
      liberarTurno(turno);
    }
  };

  const handleFinish = () => {
    setResultado(null);
    onSaveSuccess();
  };

  return (
    <View style={styles.container}>
      <TopHeader
        title="Registro De Glucosa"
        showBack
        onBack={onBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Banner Paso 1 de 2 */}
        <View style={styles.stepBanner}>
          <View style={styles.iconCircle}>
            <Icon name="drop" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerTitle}>Registrar Glucemia</Text>
            <Text style={styles.bannerSubtitle}>
              Completa los datos de tu medición...
            </Text>
          </View>
          <View style={styles.stepPill}>
            <Text style={styles.stepPillText}>Paso 1 de 2</Text>
          </View>
        </View>

        {cargando ? (
          <View style={styles.loadingBox} testID="registro-cargando">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : errorCarga ? (
          <View>
            <View style={styles.errorBox}>
              <Text style={styles.errorText} testID="registro-error-carga">{errorCarga}</Text>
            </View>
            <CustomButton title="Reintentar" onPress={cargar} testID="registro-reintentar" />
          </View>
        ) : (
          <>
            {/* Input Cards */}
            <ValorGlucosaCard value={valor} onChangeValue={setValor} />

            <FechaHoraCard
              timeText={`Hoy, ${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`}
            />

            <MomentoTomaSelector
              opciones={momentos}
              selectedId={momentoId}
              onSelectMomento={setMomentoId}
            />

            {/* Solo si el momento (catálogo real) es posterior a una comida; decisión del usuario */}
            {esMomentoPostComida(momentos.find((m) => m.id === momentoId)?.clave) ? <RecomendacionCard /> : null}

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText} testID="registro-error">{errorMessage}</Text>
              </View>
            ) : null}

            {/* Save button */}
            <CustomButton
              title="Guardar toma"
              onPress={handleSave}
              iconLeft="check"
              size="lg"
              style={styles.saveBtn}
              testID="registro-enviar"
            />
          </>
        )}
      </ScrollView>

      <ConfirmarTomaModal
        visible={showConfirm}
        value={numero}
        moment={etiquetaSeleccionada}
        loading={guardando}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Result Modal / Step 2 */}
      <ResultadoClasificacionModal
        visible={resultado !== null}
        value={valorGuardado}
        moment={etiquetaSeleccionada}
        estado={resultado?.estado ?? null}
        alerta={resultado?.alerta ?? 'no_aplica'}
        onGoHome={handleFinish}
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
  stepBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.backgroundWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerInfo: {
    flex: 1,
  },
  bannerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  bannerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  stepPill: {
    backgroundColor: COLORS.backgroundWhite,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  stepPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  saveBtn: {
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: COLORS.riesgoHiperBg,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.riesgoHiperText,
    textAlign: 'center',
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});

