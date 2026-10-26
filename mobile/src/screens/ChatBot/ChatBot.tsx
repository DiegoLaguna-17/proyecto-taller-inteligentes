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

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    sender: 'assistant',
    text: '¡Hola, Carlos! Soy tu asistente de GlucoTracker. Puedo ayudarte con dudas sobre nutrición, pautas generales de glucemia y hábitos saludables. ¿En qué puedo orientarte hoy?',
    time: '09:14',
  },
  {
    id: 'm2',
    sender: 'user',
    text: '¿Qué puedo comer si tengo la glucosa baja?',
    time: '09:15',
  },
  {
    id: 'm3',
    sender: 'assistant',
    text: 'Si experimentas hipoglucemia (menos de 70 mg/dL), la regla general es la de los 15 gramos de hidratos rápidos:',
    time: '09:15',
    cardItems: [
      { icon: 'utensils', text: 'Medio vaso de jugo de fruta (125 ml)' },
      { icon: 'fastFood', text: '3 caramelos duros masticables' },
      { icon: 'drop', text: '1 sobre de azúcar disuelto en agua' },
    ],
    subtext:
      'Vuelve a medirte a los 15 minutos. Si los síntomas persisten, contacta a tu médico de inmediato.',
  },
];

interface ChatBotProps {
  onNavigatePerfil?: () => void;
}

export const ChatBot: React.FC<ChatBotProps> = ({ onNavigatePerfil }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputText.trim(),
      time: 'Ahora',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    // Simulated reply
    setTimeout(() => {
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: 'He registrado tu consulta. Recuerda mantener un registro constante de tus tomas para un mejor seguimiento clínico con tu especialista.',
        time: 'Ahora',
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 600);
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
        {messages.map((item) => (
          <ChatMessageBubble key={item.id} message={item} />
        ))}

        {/* Resource suggestion card */}
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

