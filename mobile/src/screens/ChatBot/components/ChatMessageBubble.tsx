import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  cardItems?: { icon: string; text: string }[];
  subtext?: string;
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
}) => {
  const isUser = message.sender === 'user';

  if (isUser) {
    return (
      <View style={styles.userWrapper}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.text}</Text>
        </View>
        <View style={styles.userMeta}>
          <Text style={styles.metaTime}>{message.time}</Text>
          <Icon name="doubleCheck" size={13} color={COLORS.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistantWrapper}>
      <View style={styles.botAvatar}>
        <Icon name="bot" size={16} color={COLORS.primary} />
      </View>

      <View style={styles.assistantCol}>
        <View style={styles.assistantBubble}>
          <Text style={styles.assistantText}>{message.text}</Text>

          {message.cardItems && message.cardItems.length > 0 && (
            <View style={styles.innerCard}>
              {message.cardItems.map((item, idx) => (
                <View key={idx} style={styles.innerItemRow}>
                  <Icon name={item.icon} size={15} color={COLORS.primary} />
                  <Text style={styles.innerItemText}>{item.text}</Text>
                </View>
              ))}
            </View>
          )}

          {message.subtext && (
            <Text style={styles.subtext}>{message.subtext}</Text>
          )}
        </View>

        <Text style={styles.metaTime}>{message.time} · Asistente</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  userWrapper: {
    alignItems: 'flex-end',
    marginBottom: 16,
    maxWidth: '85%',
    alignSelf: 'flex-end',
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  userText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  assistantWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    maxWidth: '90%',
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
    flex: 1,
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
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textPrimary,
  },
  innerCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    gap: 8,
  },
  innerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  innerItemText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  subtext: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    marginTop: 10,
  },
  metaTime: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
    marginLeft: 4,
  },
});

