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
}

export const FiltroUsuarios: React.FC<FiltroUsuariosProps> = ({
  searchText,
  onChangeSearch,
  filter,
  onSelectFilter,
}) => {
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
        />
      </View>

      {/* Filter pills */}
      <View style={styles.pillsRow}>
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
            Todos 42
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pill,
            filter === 'activos' ? styles.pillActive : styles.pillInactive,
          ]}
          onPress={() => onSelectFilter('activos')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.pillText,
              filter === 'activos'
                ? styles.pillTextActive
                : styles.pillTextInactive,
            ]}
          >
            Activos 39
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pill,
            filter === 'inactivos' ? styles.pillActive : styles.pillInactive,
          ]}
          onPress={() => onSelectFilter('inactivos')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.pillText,
              filter === 'inactivos'
                ? styles.pillTextActive
                : styles.pillTextInactive,
            ]}
          >
            Inactivos 3
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

