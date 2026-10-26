import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { ClassificationBadge } from '../../../shared/ClassificationBadge';
import { CustomButton } from '../../../shared/CustomButton';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { tomarTurno, liberarTurno } from '../../../utils/turno';
import { FUENTE } from '../../../utils/medidas';
import { AlertaMedico, RESPUESTA_MAX, validarRespuesta } from '../../../services/medico';
import { clasificacionDeAlerta } from '../../../services/medicoVista';
import { etiquetaFechaHora, etiquetaMomento } from '../../../services/historial';
import { mensajeDeError } from '../../../services/http';

interface ResponderAlertaModalProps {
  alerta: AlertaMedico | null;
  /** true = alerta activa (se puede responder); false = resuelta (solo lectura). */
  activa: boolean;
  hoy: Date;
  /** Enviar la respuesta (solo alertas activas). Debe lanzar si falla. */
  onEnviar: (mensaje: string) => Promise<void>;
  onVerPaciente?: () => void;
  onClose: () => void;
}

// Detalle de la alerta y, si está activa, respuesta del médico con confirmación (en el mismo modal).
export const ResponderAlertaModal: React.FC<ResponderAlertaModalProps> = ({ alerta, activa, hoy, onEnviar, onVerPaciente, onClose }) => {
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const turno = useRef(false); // guarda síncrona contra el doble toque

  useEffect(() => {
    setMensaje('');
    setError('');
    setConfirmando(false);
    setEnviando(false);
  }, [alerta?.id]);

  if (!alerta) return null;
  const esResuelta = !activa;

  const revisar = () => {
    const e = validarRespuesta(mensaje);
    setError(e ?? '');
    if (!e) setConfirmando(true);
  };

  const enviar = async () => {
    if (enviando) return; // sin doble envío: el backend duplicaría la retroalimentación
    if (!tomarTurno(turno)) return;
    setEnviando(true);
    try {
      await onEnviar(mensaje);
    } catch (e) {
      setConfirmando(false);
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
      liberarTurno(turno);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        testID="alertas-modal"
      >
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.headerRow}>
              <Text style={styles.title} testID="alertas-modal-paciente">{alerta.paciente}</Text>
              <ClassificationBadge classification={clasificacionDeAlerta(alerta)} size="sm" />
            </View>
            <Text style={styles.sub}>
              {etiquetaFechaHora(alerta.fecha, alerta.hora, hoy)} · {etiquetaMomento(alerta.momento)}
            </Text>
            {alerta.glucosa !== null && (
              <Text style={styles.valor} numberOfLines={1} adjustsFontSizeToFit>
                {alerta.glucosa} <Text style={styles.unidad}>mg/dL</Text>
              </Text>
            )}
            {alerta.observaciones ? <Text style={styles.texto}>Observaciones: {alerta.observaciones}</Text> : null}

            {esResuelta ? (
              <View style={styles.respuestaBox}>
                <Text style={styles.etiqueta}>Tu respuesta</Text>
                <Text style={styles.texto} testID="alertas-modal-respuesta">{alerta.mensaje || 'Sin respuesta registrada.'}</Text>
              </View>
            ) : confirmando ? (
              <View style={styles.respuestaBox}>
                <Text style={styles.etiqueta}>¿Enviar esta respuesta?</Text>
                <Text style={styles.texto} testID="alertas-confirmacion-texto">{mensaje.trim()}</Text>
                <Text style={styles.nota}>La alerta pasará a resueltas y el paciente podrá ver tu respuesta.</Text>
              </View>
            ) : (
              <View style={styles.respuestaBox}>
                <Text style={styles.etiqueta}>Tu respuesta</Text>
                <TextInput
                  style={styles.input}
                  value={mensaje}
                  onChangeText={setMensaje}
                  placeholder="Indicaciones para el paciente..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  maxLength={RESPUESTA_MAX}
                  testID="alertas-respuesta"
                />
                <Text style={styles.nota}>{mensaje.trim().length}/{RESPUESTA_MAX}</Text>
              </View>
            )}

            {error ? <Text style={styles.error} testID="alertas-error">{error}</Text> : null}

            {!esResuelta && !confirmando && (
              <CustomButton title="Enviar respuesta" onPress={revisar} iconLeft="send" style={styles.btn} testID="alertas-enviar" />
            )}
            {!esResuelta && confirmando && (
              <>
                <CustomButton title="Confirmar y enviar" onPress={enviar} loading={enviando} style={styles.btn} testID="alertas-confirmar" />
                <CustomButton title="Revisar" onPress={() => setConfirmando(false)} variant="ghost" disabled={enviando} style={styles.btn} testID="alertas-revisar" />
              </>
            )}
            {onVerPaciente && !confirmando && (
              <CustomButton title="Ver paciente" onPress={onVerPaciente} variant="secondary" style={styles.btn} testID="alertas-ver-paciente" />
            )}
            {!confirmando && (
              <CustomButton title="Cerrar" onPress={onClose} variant="ghost" style={styles.btn} testID="alertas-cerrar" />
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 520,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  valor: {
    fontFamily: FONTS.bold,
    fontSize: FUENTE.cifraGrande,
    color: COLORS.textPrimary,
    marginVertical: 8,
  },
  unidad: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  texto: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  respuestaBox: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  etiqueta: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    minHeight: 90,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    textAlignVertical: 'top',
  },
  nota: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  error: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.riesgoHiperText,
    marginTop: 10,
    textAlign: 'center',
  },
  btn: {
    marginTop: 10,
  },
});
