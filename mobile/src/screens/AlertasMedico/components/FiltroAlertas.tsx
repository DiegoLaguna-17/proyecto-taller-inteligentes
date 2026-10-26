import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export type AlertFilter = 'all' | 'hipo' | 'hiper';

interface FiltroAlertasProps {
  filter: AlertFilter;
  onSelectFilter: (f: AlertFilter) => void;
}

export const FiltroAlertas: React.FC<FiltroAlertasProps> = ({
  filter,
  onSelectFilter,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.pill, filter === 'all' ? styles.pillActive : styles.pillInactive]}
        onPress={() => onSelectFilter('all')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.pillText,
            filter === 'all' ? styles.pillTextActive : styles.pillTextInactive,
          ]}
        >
          Todas (4)
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.pill, filter === 'hipo' ? styles.pillActive : styles.pillInactive]}
        onPress={() => onSelectFilter('hipo')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.pillText,
            filter === 'hipo' ? styles.pillTextActive : styles.pillTextInactive,
          ]}
        >
          Riesgo Hipo (2)
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.pill, filter === 'hiper' ? styles.pillActive : styles.pillInactive]}
        onPress={() => onSelectFilter('hiper')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.pillText,
            filter === 'hiper' ? styles.pillTextActive : styles.pillTextInactive,
          ]}
        >
          Riesgo Hiper (2)
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
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

