import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export type EventFilterType = 'todos' | 'accesos' | 'modificaciones';

interface FiltroEventosProps {
  filter: EventFilterType;
  onSelectFilter: (f: EventFilterType) => void;
  /** true = solo los eventos de hoy. */
  soloHoy: boolean;
  onToggleHoy: () => void;
}

export const FiltroEventos: React.FC<FiltroEventosProps> = ({
  filter,
  onSelectFilter,
  soloHoy,
  onToggleHoy,
}) => {
  return (
    <View style={styles.container}>
      {/* Date Pill */}
      <TouchableOpacity
        style={styles.datePill}
        onPress={onToggleHoy}
        activeOpacity={0.7}
        testID="auditoria-fecha"
      >
        <Icon name="calendar" size={16} color={COLORS.primary} />
        <Text style={styles.dateText}>{soloHoy ? 'Solo hoy' : 'Todo el historial'}</Text>
        <Icon name="chevronDown" size={14} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Filter Tabs */}
      <View style={styles.pillsRow}>
        <TouchableOpacity
          style={[
            styles.pill,
            filter === 'todos' ? styles.pillActive : styles.pillInactive,
          ]}
          onPress={() => onSelectFilter('todos')}
          activeOpacity={0.8}
          testID="auditoria-filtro-todos"
        >
          <Text
            style={[
              styles.pillText,
              filter === 'todos'
                ? styles.pillTextActive
                : styles.pillTextInactive,
            ]}
          >
            Todos los eventos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pill,
            filter === 'accesos' ? styles.pillActive : styles.pillInactive,
          ]}
          onPress={() => onSelectFilter('accesos')}
          activeOpacity={0.8}
          testID="auditoria-filtro-accesos"
        >
          <Text
            style={[
              styles.pillText,
              filter === 'accesos'
                ? styles.pillTextActive
                : styles.pillTextInactive,
            ]}
          >
            Accesos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pill,
            filter === 'modificaciones'
              ? styles.pillActive
              : styles.pillInactive,
          ]}
          onPress={() => onSelectFilter('modificaciones')}
          activeOpacity={0.8}
          testID="auditoria-filtro-modificaciones"
        >
          <Text
            style={[
              styles.pillText,
              filter === 'modificaciones'
                ? styles.pillTextActive
                : styles.pillTextInactive,
            ]}
          >
            Modificaciones
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  dateText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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

