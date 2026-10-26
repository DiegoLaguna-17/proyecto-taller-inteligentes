import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { ChatDisclaimer } from './components/ChatDisclaimer';
import { ConsultasSugeridas } from './components/ConsultasSugeridas';
import {
  ChatMessageBubble,
  ChatMessage,
} from './components/ChatMessageBubble';
import { IndicadorEscribiendo } from './components/IndicadorEscribiendo';
import { ChatInputBar } from './components/ChatInputBar';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { tomarTurno, liberarTurno } from '../../utils/turno';
import { consultarChatbot, LIMITE_CONSULTA } from '../../services/chatbot';
import { CHAT_ANIMACION } from '../../services/config';
import { modoEfectivo } from '../../services/revelado';
import { mensajeDeError } from '../../services/http';

const dos = (n: number) => String(n).padStart(2, '0');
const horaActual = () => {
  const d = new Date();
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`;
};

// Sin historial en el servidor (el servicio NLP es stateless): la conversación vive solo en esta pantalla.
const mensajeInicial = (): ChatMessage => ({
  id: 'm1',
  sender: 'assistant',
  text: '¡Hola! Soy tu asistente de GlucoTracker. Puedo ayudarte con dudas sobre nutrición, pautas generales de glucemia y hábitos saludables. ¿En qué puedo orientarte hoy?',
  time: horaActual(),
});

/** Distancia (dp) al final a partir de la cual se considera que el usuario subió a mano. */
const UMBRAL_FINAL = 80;

interface ChatBotProps {
  onNavigatePerfil?: () => void;
}

export const ChatBot: React.FC<ChatBotProps> = ({ onNavigatePerfil }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [mensajeInicial()]);
  const [inputText, setInputText] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [reducirMovimiento, setReducirMovimiento] = useState(false);

  const turno = useRef(false); // guarda síncrona contra el doble toque
  const montado = useRef(true);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const cercaDelFinal = useRef(true); // false si el usuario subió manualmente

  const modo = modoEfectivo(CHAT_ANIMACION, reducirMovimiento);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // «Reducir movimiento» del sistema: respuestas inmediatas y puntos fijos
  useEffect(() => {
    let activo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => activo && setReducirMovimiento(v))
      .catch(() => {});
    const suscripcion = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReducirMovimiento(v));
    return () => {
      activo = false;
      suscripcion.remove();
    };
  }, []);

  const alScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    cercaDelFinal.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) <= UMBRAL_FINAL;
  };

  // El contenido crece mientras se escribe: baja solo si el usuario sigue cerca del final
  const alCambiarContenido = () => {
    if (cercaDelFinal.current) scrollRef.current?.scrollToEnd({ animated: false });
  };

  const terminarAnimacion = useCallback((id: string) => {
    if (!montado.current) return;
    setMessages((prev) => prev.map((m) => (m.id === id && m.animar ? { ...m, animar: false } : m)));
  }, []);

  const enviar = async (texto: string) => {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    if (limpio.length > LIMITE_CONSULTA) {
      setError(`Tu consulta es muy larga. Escribe como máximo ${LIMITE_CONSULTA} caracteres.`);
      return;
    }
    if (!tomarTurno(turno)) return;

    setError('');
    cercaDelFinal.current = true;
    // Al enviar otra consulta, lo ya recibido se muestra completo (se detienen los temporizadores)
    setMessages((prev) => [
      ...prev.map((m) => (m.animar ? { ...m, animar: false } : m)),
      { id: Date.now().toString(), sender: 'user', text: limpio, time: horaActual() },
    ]);
    setInputText('');
    setEnviando(true);

    try {
      // Solo viaja el texto: el contrato del NLP no admite datos del usuario ni contexto clínico
      const respuesta = await consultarChatbot(limpio);
      if (!montado.current) return;
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: respuesta,
          time: horaActual(),
          animar: modo === 'escritura',
        },
      ]);
    } catch (e) {
      if (montado.current) setError(mensajeDeError(e));
    } finally {
      liberarTurno(turno);
      if (montado.current) setEnviando(false);
    }
  };

  const handleSend = () => enviar(inputText);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TopHeader
        title="Chatbot"
        onProfilePress={onNavigatePerfil}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={alScroll}
        scrollEventThrottle={64}
        onContentSizeChange={alCambiarContenido}
      >
        <ChatDisclaimer />

        {/* Title & Badge */}
        <View style={styles.titleRow}>
          <Text style={styles.titleText}>Asistente Clínico</Text>
          <View style={styles.badgeActive}>
            <Text style={styles.badgeActiveText}>Asistente de IA</Text>
          </View>
        </View>
        <Text style={styles.subtitleText}>
          Orientación general sobre diabetes, glucemia y nutrición.
        </Text>

        <ConsultasSugeridas onSelectPrompt={enviar} disabled={enviando} />

        {/* Date separator */}
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>Hoy</Text>
        </View>

        {/* Message list */}
        {messages.map((item, i) => (
          <ChatMessageBubble
            key={item.id}
            message={item}
            modo={modo}
            onTerminar={terminarAnimacion}
            testID={`chat-mensaje-${item.sender === 'user' ? 'usuario' : 'asistente'}-${i}`}
          />
        ))}

        {/* Solo mientras se espera la respuesta; con error se oculta (enviando vuelve a false) */}
        {enviando && (
          <View testID="chat-cargando">
            <IndicadorEscribiendo sinMovimiento={reducirMovimiento} />
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText} testID="chat-error" accessibilityRole="alert">{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Input bar */}
      <ChatInputBar
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSend}
        maxLength={LIMITE_CONSULTA}
        disabled={enviando}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  errorBox: {
    backgroundColor: COLORS.riesgoHiperBg,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.riesgoHiperText,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  titleText: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  badgeActive: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  badgeActiveText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  subtitleText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  dateSeparator: {
    alignSelf: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 12,
  },
  dateSeparatorText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});
