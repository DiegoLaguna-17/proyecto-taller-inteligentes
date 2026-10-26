import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export type SolicitudFilter = 'todos' | 'pacientes' | 'medicos';

interface FiltroSolicitudesProps {
  filter: SolicitudFilter;
  onSelectFilter: (f: SolicitudFilter) => void;
  counts: { todos: number; pacientes: number; medicos: number };
}

export const FiltroSolicitudes: React.FC<FiltroSolicitudesProps> = ({
  filter,
  onSelectFilter,
  counts,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.pill,
          filter === 'todos' ? styles.pillActive : styles.pillInactive,
        ]}
        onPress={() => onSelectFilter('todos')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.pillText,
            filter === 'todos' ? styles.pillTextActive : styles.pillTextInactive,
          ]}
        >
          Todos {counts.todos}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.pill,
          filter === 'pacientes' ? styles.pillActive : styles.pillInactive,
        ]}
        onPress={() => onSelectFilter('pacientes')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.pillText,
            filter === 'pacientes' ? styles.pillTextActive : styles.pillTextInactive,
          ]}
        >
          Pacientes {counts.pacientes}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.pill,
          filter === 'medicos' ? styles.pillActive : styles.pillInactive,
        ]}
        onPress={() => onSelectFilter('medicos')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.pillText,
            filter === 'medicos' ? styles.pillTextActive : styles.pillTextInactive,
          ]}
        >
          Médicos {counts.medicos}
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
    paddingHorizontal: 16,
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
    fontSize: 13,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  pillTextInactive: {
    color: COLORS.textSecondary,
  },
});

