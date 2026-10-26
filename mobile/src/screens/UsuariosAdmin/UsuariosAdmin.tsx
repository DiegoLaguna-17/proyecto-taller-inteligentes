import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { CustomButton } from '../../shared/CustomButton';
import {
  FiltroUsuarios,
  UserStatusFilter,
} from './components/FiltroUsuarios';
import { UsuarioCard } from './components/UsuarioCard';
import { ModalEditarUsuario } from './components/ModalEditarUsuario';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { USE_MOCK } from '../../services/config';
import {
  UsuarioAdmin,
  activarUsuario,
  obtenerAdministradores,
  obtenerMedicosActivos,
  obtenerMedicosSolicitantes,
  obtenerPacientesActivos,
  obtenerPacientesSolicitantes,
} from '../../services/administrador';
import { conteoUsuarios, filtrarUsuarios } from '../../services/administradorVista';
import { mensajeDeError } from '../../services/http';

interface UsuariosAdminProps {
  /** id_admin de la sesión (id_rol). */
  idAdmin: number;
  onNavigatePerfil?: () => void;
}

const FUENTES = ['médicos activos', 'pacientes activos', 'administradores', 'médicos pendientes', 'pacientes pendientes'];

export const UsuariosAdmin: React.FC<UsuariosAdminProps> = ({
  idAdmin,
  onNavigatePerfil,
}) => {
  const [users, setUsers] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [fallidas, setFallidas] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<UserStatusFilter>('todos');
  const [selectedUser, setSelectedUser] = useState<UsuarioAdmin | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    const r = await Promise.allSettled([
      obtenerMedicosActivos(),
      obtenerPacientesActivos(),
      obtenerAdministradores(idAdmin),
      obtenerMedicosSolicitantes(),
      obtenerPacientesSolicitantes(),
    ]);
    const lista: UsuarioAdmin[] = [];
    const malas: string[] = [];
    r.forEach((x, i) => {
      if (x.status === 'fulfilled') lista.push(...x.value);
      else malas.push(FUENTES[i]);
    });
    setUsers(lista);
    setFallidas(malas);
    if (malas.length === r.length) {
      const primero = r.find((x) => x.status === 'rejected') as PromiseRejectedResult | undefined;
      setError(mensajeDeError(primero?.reason));
    }
    setCargando(false);
  }, [idAdmin]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filteredUsers = useMemo(() => filtrarUsuarios(users, searchText, filter), [users, searchText, filter]);
  const conteos = useMemo(() => conteoUsuarios(users), [users]);

  const handleActivar = async (u: UsuarioAdmin) => {
    try {
      await activarUsuario(u.rol === 'Médico' ? 'Médico' : 'Paciente', u.id, idAdmin);
    } catch (e) {
      cargar(); // refleja el estado real aunque el servidor haya fallado a medias
      throw e;
    }
    setSelectedUser(null);
    await cargar();
  };

  return (
    <View style={styles.container}>
      <TopHeader
        title="Usuarios"
        onProfilePress={onNavigatePerfil}
        hasUnreadNotifications={USE_MOCK}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.badgeTop}>PANEL DE CONTROL</Text>
        <Text style={styles.mainTitle}>Gestión de Usuarios</Text>
        <Text style={styles.subtitle}>
          Consulta de cuentas activas y pendientes. El backend solo permite activar cuentas.
        </Text>

        <FiltroUsuarios
          searchText={searchText}
          onChangeSearch={setSearchText}
          filter={filter}
          onSelectFilter={setFilter}
          conteos={conteos}
        />

        {fallidas.length > 0 && !error ? (
          <Text style={styles.estadoText} testID="admin-parcial">
            No se pudieron cargar: {fallidas.join(', ')}. La lista puede estar incompleta.
          </Text>
        ) : null}

        {cargando ? (
          <View style={styles.estadoBox} testID="admin-cargando">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="admin-error">{error}</Text>
            <CustomButton title="Reintentar" onPress={cargar} testID="admin-reintentar" />
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.estadoBox}>
            <Text style={styles.estadoText} testID="admin-vacio">No hay usuarios que coincidan.</Text>
          </View>
        ) : (
          filteredUsers.map((user) => (
            <UsuarioCard
              key={user.clave}
              user={user}
              onPress={() => setSelectedUser(user)}
            />
          ))
        )}
      </ScrollView>

      <ModalEditarUsuario
        user={selectedUser}
        visible={selectedUser !== null}
        onClose={() => setSelectedUser(null)}
        onActivar={handleActivar}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  estadoBox: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  estadoText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
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

