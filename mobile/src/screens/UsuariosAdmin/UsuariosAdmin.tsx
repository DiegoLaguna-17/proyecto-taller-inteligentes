import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import {
  FiltroUsuarios,
  UserStatusFilter,
} from './components/FiltroUsuarios';
import { UsuarioCard } from './components/UsuarioCard';
import { ModalEditarUsuario } from './components/ModalEditarUsuario';
import {
  MOCK_ADMIN_USERS,
  AdminUser,
} from '../../utils/mockData';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';

interface UsuariosAdminProps {
  onNavigatePerfil?: () => void;
}

export const UsuariosAdmin: React.FC<UsuariosAdminProps> = ({
  onNavigatePerfil,
}) => {
  const [users, setUsers] = useState<AdminUser[]>(MOCK_ADMIN_USERS);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<UserStatusFilter>('todos');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchText.toLowerCase()) ||
      u.email.toLowerCase().includes(searchText.toLowerCase()) ||
      u.role.toLowerCase().includes(searchText.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'activos') return u.status === 'Activo';
    if (filter === 'inactivos') return u.status === 'Inactivo';
    return true;
  });

  const handleSaveUser = (updated: AdminUser) => {
    setUsers((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  return (
    <View style={styles.container}>
      <TopHeader
        title="Usuarios"
        onProfilePress={onNavigatePerfil}
        hasUnreadNotifications
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.badgeTop}>PANEL DE CONTROL</Text>
        <Text style={styles.mainTitle}>Gestión de Usuarios</Text>
        <Text style={styles.subtitle}>
          Control de accesos, roles y estados del sistema
        </Text>

        <FiltroUsuarios
          searchText={searchText}
          onChangeSearch={setSearchText}
          filter={filter}
          onSelectFilter={setFilter}
        />

        {filteredUsers.map((user) => (
          <UsuarioCard
            key={user.id}
            user={user}
            onPress={() => {
              setSelectedUser(user);
              setIsModalVisible(true);
            }}
          />
        ))}
      </ScrollView>

      <ModalEditarUsuario
        user={selectedUser}
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSave={handleSaveUser}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  badgeTop: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  mainTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
});

