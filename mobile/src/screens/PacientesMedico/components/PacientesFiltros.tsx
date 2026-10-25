import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export type PacientesFiltroType = 'todos' | 'riesgo' | 'estables';

interface PacientesFiltrosProps {
  searchText: string;
  onChangeSearch: (t: string) => void;
  selectedFiltro: PacientesFiltroType;
  onSelectFiltro: (f: PacientesFiltroType) => void;
}

export const PacientesFiltros: React.FC<PacientesFiltrosProps> = ({
  searchText,
  onChangeSearch,
  selectedFiltro,
  onSelectFiltro,
}) => {
  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchBar}>
        <Icon name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar paciente por nombre o ID..."
          placeholderTextColor={COLORS.textMuted}
          value={searchText}
          onChangeText={onChangeSearch}
        />
      </View>

      {/* Filter pills */}
      <View style={styles.pillsRow}>
        <TouchableOpacity
          style={[
            styles.pill,
            selectedFiltro === 'todos' ? styles.pillActive : styles.pillInactive,
          ]}
          onPress={() => onSelectFiltro('todos')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.pillText,
              selectedFiltro === 'todos'
                ? styles.pillTextActive
                : styles.pillTextInactive,
            ]}
          >
            Todos (18)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pill,
            selectedFiltro === 'riesgo' ? styles.pillActive : styles.pillInactive,
          ]}
          onPress={() => onSelectFiltro('riesgo')}
          activeOpacity={0.8}
        >
          <View style={[styles.dot, { backgroundColor: COLORS.riesgoHiper }]} />
          <Text
            style={[
              styles.pillText,
              selectedFiltro === 'riesgo'
                ? styles.pillTextActive
                : styles.pillTextInactive,
            ]}
          >
            En riesgo (2)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pill,
            selectedFiltro === 'estables' ? styles.pillActive : styles.pillInactive,
          ]}
          onPress={() => onSelectFiltro('estables')}
          activeOpacity={0.8}
        >
          <View style={[styles.dot, { backgroundColor: COLORS.textSecondary }]} />
          <Text
            style={[
              styles.pillText,
              selectedFiltro === 'estables'
                ? styles.pillTextActive
                : styles.pillTextInactive,
            ]}
          >
            Estables (16)
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
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
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

