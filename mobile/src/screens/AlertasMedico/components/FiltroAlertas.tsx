import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export type AlertFilter = 'todas' | 'hipo' | 'hiper';

interface FiltroAlertasProps {
  filter: AlertFilter;
  onSelectFilter: (f: AlertFilter) => void;
  conteos: { todas: number; hipo: number; hiper: number };
}

export const FiltroAlertas: React.FC<FiltroAlertasProps> = ({
  filter,
  onSelectFilter,
  conteos,
}) => {
  const pills: { id: AlertFilter; texto: string }[] = [
    { id: 'todas', texto: `Todas (${conteos.todas})` },
    { id: 'hipo', texto: `Riesgo Hipo (${conteos.hipo})` },
    { id: 'hiper', texto: `Riesgo Hiper (${conteos.hiper})` },
  ];
  return (
    <View style={styles.container}>
      {pills.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={[styles.pill, filter === p.id ? styles.pillActive : styles.pillInactive]}
          onPress={() => onSelectFilter(p.id)}
          activeOpacity={0.8}
          testID={`alertas-filtro-${p.id}`}
        >
          <Text style={[styles.pillText, filter === p.id ? styles.pillTextActive : styles.pillTextInactive]}>
            {p.texto}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  pillActive: {
    backgroundColor: COLORS.primary,
  },
  pillInactive: {
    backgroundColor: COLORS.surfaceLight,
  },
  pillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  pillTextInactive: {
    color: COLORS.textSecondary,
  },
});

