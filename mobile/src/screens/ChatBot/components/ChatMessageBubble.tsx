import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { FUENTE, anchoBurbuja } from '../../../utils/medidas';
import { useMedidas } from '../../../utils/useMedidas';
import { ModoAnimacion, planRevelado, separarAviso, textoEnPaso } from '../../../services/revelado';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  /** true solo en la respuesta recién recibida: se revela por palabras. El historial nunca se anima. */
  animar?: boolean;
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
  /** Identificador de prueba del mensaje (p. ej. chat-mensaje-usuario-0). */
  testID?: string;
  modo?: ModoAnimacion;
  /** Se llama una vez cuando el mensaje animado ya se muestra completo (terminó o se tocó). */
  onTerminar?: (id: string) => void;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  testID,
  modo = 'escritura',
  onTerminar,
}) => {
  const { ancho, esc } = useMedidas();
  const maxAncho = anchoBurbuja(ancho);
  const tamano = esc(FUENTE.cuerpo, 1.15);
  const isUser = message.sender === 'user';

  // El aviso médico se separa del cuerpo: solo el cuerpo se anima y el aviso aparece completo al terminar
  const { cuerpo, aviso } = useMemo(() => separarAviso(message.text), [message.text]);
  const plan = useMemo(() => planRevelado(cuerpo, { modo }), [cuerpo, modo]);
  const total = plan.partes.length;
  const [paso, setPaso] = useState(1);
  const avisado = useRef(false);

  const enCurso = !isUser && !!message.animar && total > 1 && paso < total;

  // Temporizador del revelado: se limpia al desmontar, al terminar o cuando ChatBot quita `animar` (nuevo envío)
  useEffect(() => {
    if (isUser || !message.animar || total <= 1) return;
    const id = setInterval(() => setPaso((p) => (p >= total ? p : p + 1)), plan.intervaloMs);
    return () => clearInterval(id);
  }, [isUser, message.animar, total, plan.intervaloMs]);

  // Avisa una sola vez que el mensaje ya está completo
  useEffect(() => {
    if (isUser || !message.animar || avisado.current) return;
    if (total <= 1 || paso >= total) {
      avisado.current = true;
      onTerminar?.(message.id);
    }
  }, [isUser, message.animar, message.id, onTerminar, paso, total]);

  if (isUser) {
    return (
      <View style={[styles.userWrapper, { maxWidth: maxAncho }]} testID={testID}>
        <View style={styles.userBubble}>
          <Text style={[styles.userText, ROMPER_LARGAS, { fontSize: tamano, lineHeight: Math.round(tamano * 1.45) }]}>{message.text}</Text>
        </View>
        <Text style={styles.metaTime}>{message.time}</Text>
      </View>
    );
  }

  const visible = enCurso ? textoEnPaso(plan, paso) : cuerpo;

  return (
    <View style={styles.assistantWrapper} testID={testID}>
      <View style={styles.botAvatar}>
        <Icon name="bot" size={16} color={COLORS.primary} />
      </View>

      <View style={[styles.assistantCol, { maxWidth: maxAncho }]}>
        <Pressable
          disabled={!enCurso}
          onPress={() => setPaso(total)}
          accessibilityHint={enCurso ? 'Toca para mostrar la respuesta completa' : undefined}
          style={styles.assistantBubble}
        >
          <Text style={[styles.assistantText, ROMPER_LARGAS, { fontSize: tamano, lineHeight: Math.round(tamano * 1.5) }]} testID="chat-respuesta">
            {visible}
          </Text>
          {aviso && !enCurso ? (
            <Text style={[styles.aviso, { fontSize: esc(FUENTE.caption, 1.15) }]} testID="chat-aviso-medico">
              {aviso}
            </Text>
          ) : null}
        </Pressable>

        <Text style={styles.metaTime}>{message.time} · Asistente</Text>
      </View>
    </View>
  );
};

// En web una cadena sin espacios (URL) no se parte sola; en Android e iOS el texto ya parte las palabras largas
const ROMPER_LARGAS = Platform.OS === 'web' ? ({ overflowWrap: 'anywhere' } as object) : null;

const styles = StyleSheet.create({
  userWrapper: {
    alignItems: 'flex-end',
    marginBottom: 16,
    alignSelf: 'flex-end',
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    flexShrink: 1,
  },
  userText: {
    fontFamily: FONTS.medium,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  assistantWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    marginTop: 4,
  },
  assistantCol: {
    flexShrink: 1,
  },
  assistantBubble: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  assistantText: {
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  aviso: {
    fontFamily: FONTS.medium,
    lineHeight: 17,
    color: COLORS.textSecondary,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.primaryBorder,
  },
  metaTime: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
    marginLeft: 4,
  },
});
