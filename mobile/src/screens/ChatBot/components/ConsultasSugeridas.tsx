import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface ConsultasSugeridasProps {
  onSelectPrompt: (prompt: string) => void;
}

const PROMPTS = [
  { id: '1', label: 'Glucosa baja y colaciones', icon: 'utensils' },
  { id: '2', label: 'Rango en ayunas', icon: 'chart' },
  { id: '3', label: 'Picos postprandiales', icon: 'clock' },
];

export const ConsultasSugeridas: React.FC<ConsultasSugeridasProps> = ({
  onSelectPrompt,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>CONSULTAS SUGERIDAS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {PROMPTS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.pill}
            onPress={() => onSelectPrompt(item.label)}
            activeOpacity={0.7}
          >
            <Icon name={item.icon} size={15} color={COLORS.primary} />
            <Text style={styles.pillText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  scrollList: {
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    gap: 6,
  },
  pillText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
});

