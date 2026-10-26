import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { ChatDisclaimer } from './components/ChatDisclaimer';
import { ConsultasSugeridas } from './components/ConsultasSugeridas';
import {
  ChatMessageBubble,
  ChatMessage,
} from './components/ChatMessageBubble';
import { RecursoCard } from './components/RecursoCard';
import { ChatInputBar } from './components/ChatInputBar';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { consultarChatbot, LIMITE_CONSULTA } from '../../services/chatbot';
import { mensajeDeError } from '../../services/http';

const dos = (n: number) => String(n).padStart(2, '0');
const horaActual = () => {
  const d = new Date();
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`;
};

// Sin historial en el servidor (el servicio NLP es stateless): la conversación vive solo en esta pantalla.
const MENSAJE_INICIAL: ChatMessage = {
  id: 'm1',
  sender: 'assistant',
  text: '¡Hola! Soy tu asistente de GlucoTracker. Puedo ayudarte con dudas sobre nutrición, pautas generales de glucemia y hábitos saludables. ¿En qué puedo orientarte hoy?',
  time: horaActual(),
};

interface ChatBotProps {
  onNavigatePerfil?: () => void;
}

export const ChatBot: React.FC<ChatBotProps> = ({ onNavigatePerfil }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([MENSAJE_INICIAL]);
  const [inputText, setInputText] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    const texto = inputText.trim();
    if (!texto || enviando) return;
    if (texto.length > LIMITE_CONSULTA) {
      setError(`Tu consulta es muy larga. Escribe como máximo ${LIMITE_CONSULTA} caracteres.`);
      return;
    }

    setError('');
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), sender: 'user', text: texto, time: horaActual() },
    ]);
    setInputText('');
    setEnviando(true);

    try {
      // Solo viaja el texto: el contrato del NLP no admite datos del usuario ni contexto clínico
      const respuesta = await consultarChatbot(texto);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: 'assistant', text: respuesta, time: horaActual() },
      ]);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  };

  const handleSelectPrompt = (prompt: string) => {
    setInputText(`¿Cómo debo gestionar: ${prompt}?`);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TopHeader
        title="Chatbot"
        onProfilePress={onNavigatePerfil}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ChatDisclaimer />

        {/* Title & Badge */}
        <View style={styles.titleRow}>
          <Text style={styles.titleText}>Asistente Clínico</Text>
          <View style={styles.badgeActive}>
            <Text style={styles.badgeActiveText}>IA Activa</Text>
          </View>
        </View>
        <Text style={styles.subtitleText}>
          Orientación personalizada sobre diabetes, glucemia y nutrición.
        </Text>

        <ConsultasSugeridas onSelectPrompt={handleSelectPrompt} />

        {/* Date separator */}
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>Hoy</Text>
        </View>

        {/* Message list */}
        {messages.map((item, i) => (
          <ChatMessageBubble
            key={item.id}
            message={item}
            testID={`chat-mensaje-${item.sender === 'user' ? 'usuario' : 'asistente'}-${i}`}
          />
        ))}

        {enviando && (
          <Text style={styles.typingText} testID="chat-cargando">
            El asistente está escribiendo...
          </Text>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText} testID="chat-error">{error}</Text>
          </View>
        ) : null}

        {/* Simulado en esta pantalla: tarjeta de recurso estática (no viene del servicio) */}
        <RecursoCard
          onPress={() => {
            Alert.alert(
              'Guía de carbohidratos',
              'Abriendo material educativo sobre conteo de carbohidratos...'
            );
          }}
        />
      </ScrollView>

      {/* Input bar */}
      <ChatInputBar
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSend}
        maxLength={LIMITE_CONSULTA}
        disabled={enviando}
        onMicPress={() => {
          Alert.alert('Dictado por voz', 'El dictado por voz está listo.');
        }}
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
  typingText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
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

