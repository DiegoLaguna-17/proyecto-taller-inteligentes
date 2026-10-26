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
  /** Cantidades reales de cada filtro. */
  conteos: { todos: number; riesgo: number; estables: number };
}

export const PacientesFiltros: React.FC<PacientesFiltrosProps> = ({
  searchText,
  onChangeSearch,
  selectedFiltro,
  onSelectFiltro,
  conteos,
}) => {
  const pills: { id: PacientesFiltroType; texto: string; punto?: string }[] = [
    { id: 'todos', texto: `Todos (${conteos.todos})` },
    { id: 'riesgo', texto: `En riesgo (${conteos.riesgo})`, punto: COLORS.riesgoHiper },
    { id: 'estables', texto: `Estables (${conteos.estables})`, punto: COLORS.textSecondary },
  ];
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
          testID="medico-buscar"
        />
      </View>

      {/* Filter pills */}
      <View style={styles.pillsRow}>
        {pills.map((p) => {
          const activo = selectedFiltro === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.pill, activo ? styles.pillActive : styles.pillInactive]}
              onPress={() => onSelectFiltro(p.id)}
              activeOpacity={0.8}
              testID={`medico-filtro-${p.id}`}
            >
              {p.punto && <View style={[styles.dot, { backgroundColor: p.punto }]} />}
              <Text style={[styles.pillText, activo ? styles.pillTextActive : styles.pillTextInactive]}>
                {p.texto}
              </Text>
            </TouchableOpacity>
          );
        })}
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
    flexWrap: 'wrap',
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

