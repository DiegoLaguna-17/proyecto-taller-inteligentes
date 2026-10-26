import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { Icon } from '../../shared/Icon';
import { CustomButton } from '../../shared/CustomButton';
import { InputField } from '../../shared/InputField';
import { ModalMensaje } from '../../shared/ModalMensaje';
import { ValorGlucosaCard } from '../RegistroToma/components/ValorGlucosaCard';
import { FechaHoraCard } from '../RegistroToma/components/FechaHoraCard';
import { MomentoTomaSelector, OpcionMomento } from '../RegistroToma/components/MomentoTomaSelector';
import { RiesgoMlBloque } from './components/RiesgoMlBloque';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { FUENTE } from '../../utils/medidas';
import { useMedidas } from '../../utils/useMedidas';
import { tomarTurno, liberarTurno } from '../../utils/turno';
import { obtenerMomentos, obtenerDatosPaciente, DatosPaciente } from '../../services/glucosa';
import { momentoDeId } from '../../services/clasificacionGlucosa';
import { etiquetaMomento } from '../../services/historial';
import { mensajeDeError } from '../../services/http';
import { PacienteMedico } from '../../services/medico';
import {
  MAX_OBSERVACIONES,
  mensajeFalloTomaMedico,
  mensajeResultadoMedico,
  registrarTomaMedico,
  validarTomaMedico,
} from '../../services/registroTomaMedico';
import type { ResultadoToma } from '../../services/registroToma';

interface RegistroTomaMedicoProps {
  /** Paciente de `misPacientes` por quien se registra la lectura. */
  paciente: PacienteMedico;
  /** id_medico de la sesión (quien registra). */
  idMedico: number;
  onBack: () => void;
  /** Se llama al cerrar el resultado: vuelve al detalle y recarga el historial. */
  onGuardado: () => void;
}

const dos = (n: number) => String(n).padStart(2, '0');

export const RegistroTomaMedico: React.FC<RegistroTomaMedicoProps> = ({ paciente, idMedico, onBack, onGuardado }) => {
  const { esc } = useMedidas();
  const [valor, setValor] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [momentos, setMomentos] = useState<OpcionMomento[]>([]);
  const [momentoId, setMomentoId] = useState<number | null>(null);
  const [datos, setDatos] = useState<DatosPaciente | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const turno = useRef(false); // guarda síncrona contra el doble toque
  const montado = useRef(true);
  const [resultado, setResultado] = useState<ResultadoToma | null>(null);
  const [valorGuardado, setValorGuardado] = useState(0);
  const [ahora] = useState(() => new Date());

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // Momentos del catálogo real y datos del paciente elegido (edad, embarazo, enfermedades, médico asignado)
  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const [lista, d] = await Promise.all([obtenerMomentos(), obtenerDatosPaciente(paciente.id)]);
      const opciones = lista
        .filter((m) => momentoDeId(m.id_momento) !== undefined)
        .map((m) => ({ id: m.id_momento, clave: momentoDeId(m.id_momento) as string, etiqueta: etiquetaMomento(m.momento) }));
      if (opciones.length === 0) throw new Error('sin momentos');
      if (!montado.current) return;
      setMomentos(opciones);
      setDatos(d);
    } catch (e) {
      if (montado.current) {
        setErrorCarga(
          e instanceof Error && e.message === 'sin momentos' ? 'No se pudieron cargar los momentos de la toma.' : mensajeDeError(e),
        );
      }
    } finally {
      if (montado.current) setCargando(false);
    }
  }, [paciente.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const numero = parseInt(valor, 10);
  const etiquetaSeleccionada = momentos.find((m) => m.id === momentoId)?.etiqueta ?? '';

  const handleSave = () => {
    setErrorMessage('');
    const e = validarTomaMedico({ valor, idMomento: momentoId, observaciones });
    if (e) {
      setErrorMessage(e);
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!datos || momentoId === null) return;
    if (!tomarTurno(turno)) return;
    setGuardando(true);
    try {
      const r = await registrarTomaMedico({
        datos,
        idMedico,
        idMomento: momentoId,
        valor: numero,
        ahora: new Date(),
        observaciones,
      });
      if (!montado.current) return;
      setValorGuardado(numero);
      setResultado(r);
      setShowConfirm(false);
    } catch (e) {
      if (montado.current) {
        setShowConfirm(false);
        setErrorMessage(mensajeFalloTomaMedico(e));
      }
    } finally {
      liberarTurno(turno);
      if (montado.current) setGuardando(false);
    }
  };

  const handleFinish = () => {
    setResultado(null);
    onGuardado();
  };

  return (
    <View style={styles.container}>
      <TopHeader title="Registrar Toma" showBack onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Deja claro que la lectura se registra POR el paciente */}
        <View style={styles.banner} testID="medico-toma-paciente">
          <View style={styles.iconCircle}>
            <Icon name="user" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerTitle} numberOfLines={2}>Registrando por {paciente.nombre}</Text>
            <Text style={styles.bannerSubtitle}>
              La lectura quedará a nombre del paciente y registrada por ti como médico.
            </Text>
          </View>
        </View>

        {cargando ? (
          <View style={styles.loadingBox} testID="medico-toma-cargando">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : errorCarga ? (
          <View>
            <View style={styles.errorBox}>
              <Text style={styles.errorText} testID="medico-toma-error-carga">{errorCarga}</Text>
            </View>
            <CustomButton title="Reintentar" onPress={cargar} testID="medico-toma-reintentar" />
          </View>
        ) : (
          <>
            <ValorGlucosaCard value={valor} onChangeValue={setValor} />

            <FechaHoraCard timeText={`Hoy, ${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`} />

            <MomentoTomaSelector opciones={momentos} selectedId={momentoId} onSelectMomento={setMomentoId} />

            <InputField
              label="Observaciones (opcional)"
              placeholder="Notas sobre la toma"
              value={observaciones}
              onChangeText={setObservaciones}
              maxLength={MAX_OBSERVACIONES}
              helperText={`${observaciones.length}/${MAX_OBSERVACIONES}`}
              testID="medico-toma-observaciones"
            />

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={[styles.errorText, { fontSize: esc(FUENTE.cuerpo - 1, 1.1) }]} testID="medico-toma-error" accessibilityRole="alert">
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            <CustomButton
              title="Guardar toma"
              onPress={handleSave}
              iconLeft="check"
              size="lg"
              style={styles.saveBtn}
              testID="medico-toma-enviar"
            />
          </>
        )}
      </ScrollView>

      <ModalMensaje
        visible={showConfirm}
        titulo="¿Confirmas esta toma?"
        mensaje={`${numero} mg/dL · ${etiquetaSeleccionada}\nPaciente: ${paciente.nombre}\nSi el valor está fuera de rango se creará una alerta para el médico asignado. Revisa que sea correcto.`}
        textoConfirmar="Confirmar y guardar"
        onConfirm={handleConfirm}
        textoCancelar="Corregir"
        onCancel={() => setShowConfirm(false)}
        loading={guardando}
        testIDPrefix="medico-toma-confirmacion"
      />

      <ModalMensaje
        visible={resultado !== null}
        titulo="Toma registrada"
        mensaje={
          resultado
            ? `${valorGuardado} mg/dL · ${etiquetaSeleccionada}\n${mensajeResultadoMedico(resultado.estado, resultado.alerta, paciente.nombre)}`
            : ''
        }
        textoConfirmar="Volver al detalle"
        onConfirm={handleFinish}
        testIDPrefix="medico-toma-resultado"
      >
        {/* Solo informativo y solo en esta vista: no se guarda ni altera la alerta (el aviso de la alerta va primero, en el mensaje) */}
        {resultado?.riesgoMl ? <RiesgoMlBloque riesgo={resultado.riesgoMl} /> : null}
      </ModalMensaje>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36 },
  banner: {
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
  bannerInfo: { flex: 1 },
  bannerTitle: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.textPrimary },
  bannerSubtitle: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  loadingBox: { paddingVertical: 40, alignItems: 'center' },
  errorBox: { backgroundColor: COLORS.riesgoHiperBg, borderRadius: 14, padding: 12, marginBottom: 16 },
  errorText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.riesgoHiperText, textAlign: 'center' },
  saveBtn: { marginTop: 4 },
});
