import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export type UserStatusFilter = 'todos' | 'activos' | 'inactivos';

interface FiltroUsuariosProps {
  searchText: string;
  onChangeSearch: (t: string) => void;
  filter: UserStatusFilter;
  onSelectFilter: (f: UserStatusFilter) => void;
  conteos: { todos: number; activos: number; inactivos: number };
}

export const FiltroUsuarios: React.FC<FiltroUsuariosProps> = ({
  searchText,
  onChangeSearch,
  filter,
  onSelectFilter,
  conteos,
}) => {
  const pills: { id: UserStatusFilter; texto: string }[] = [
    { id: 'todos', texto: `Todos ${conteos.todos}` },
    { id: 'activos', texto: `Activos ${conteos.activos}` },
    { id: 'inactivos', texto: `Inactivos ${conteos.inactivos}` },
  ];
  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchBar}>
        <Icon name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, correo o rol..."
          placeholderTextColor={COLORS.textMuted}
          value={searchText}
          onChangeText={onChangeSearch}
          testID="admin-buscar"
        />
      </View>

      {/* Filter pills */}
      <View style={styles.pillsRow}>
        {pills.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.pill, filter === p.id ? styles.pillActive : styles.pillInactive]}
            onPress={() => onSelectFilter(p.id)}
            activeOpacity={0.8}
            testID={`admin-filtro-${p.id}`}
          >
            <Text style={[styles.pillText, filter === p.id ? styles.pillTextActive : styles.pillTextInactive]}>
              {p.texto}
            </Text>
          </TouchableOpacity>
        ))}
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

