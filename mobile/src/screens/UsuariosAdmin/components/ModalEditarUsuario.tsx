import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { CustomButton } from '../../../shared/CustomButton';
import { UsuarioAdmin } from '../../../services/administrador';
import { iniciales } from '../../../services/medicoVista';
import { mensajeDeError } from '../../../services/http';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { tomarTurno, liberarTurno } from '../../../utils/turno';

interface ModalEditarUsuarioProps {
  user: UsuarioAdmin | null;
  visible: boolean;
  onClose: () => void;
  /** Activa la cuenta (solo médicos y pacientes inactivos). Debe lanzar si falla. */
  onActivar: (user: UsuarioAdmin) => Promise<void>;
}

// El backend NO permite cambiar el rol ni desactivar o eliminar cuentas: esos controles se muestran deshabilitados.
// Lo único que se puede hacer es activar una cuenta pendiente.
export const ModalEditarUsuario: React.FC<ModalEditarUsuarioProps> = ({
  user,
  visible,
  onClose,
  onActivar,
}) => {
  const [confirmando, setConfirmando] = useState(false);
  const [activando, setActivando] = useState(false);
  const turno = useRef(false); // guarda síncrona contra el doble toque
  const [error, setError] = useState('');

  useEffect(() => {
    setConfirmando(false);
    setActivando(false);
    setError('');
  }, [user?.clave]);

  if (!user) return null;

  const puedeActivar = !user.activo && (user.rol === 'Médico' || user.rol === 'Paciente');

  const activar = async () => {
    if (activando) return; // sin doble envío
    if (!tomarTurno(turno)) return;
    setActivando(true);
    setError('');
    try {
      await onActivar(user);
    } catch (e) {
      setConfirmando(false);
      setError(mensajeDeError(e));
    } finally {
      setActivando(false);
      liberarTurno(turno);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay} testID="admin-modal">
        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Gestionar Usuario</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="admin-modal-cerrar"
          accessibilityRole="button"
          accessibilityLabel="Cerrar">
              <Icon name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.userInfoRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.initialsText}>{iniciales(user.nombre)}</Text>
            </View>
            <View>
              <Text style={styles.userName} testID="admin-modal-nombre">{user.nombre}</Text>
              <Text style={styles.userEmail}>{user.correo ?? 'Sin correo'}</Text>
            </View>
          </View>

          {/* Rol (solo lectura) */}
          <Text style={styles.sectionLabel}>Rol en el sistema</Text>
          <View style={styles.roleOptions}>
            {(['Paciente', 'Médico', 'Administrador'] as const).map((r) => {
              const isSelected = user.rol === r;
              return (
                <View key={r} style={[styles.roleBtn, isSelected && styles.roleBtnSelected, !isSelected && { opacity: 0.5 }]}>
                  <Text style={[styles.roleBtnText, isSelected && styles.roleBtnTextSelected]}>{r}</Text>
                </View>
              );
            })}
          </View>

          {/* Estado (solo lectura) */}
          <Text style={styles.sectionLabel}>Estado de la cuenta</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusBtn, user.activo && styles.statusBtnActive, !user.activo && { opacity: 0.5 }]}>
              <View style={[styles.dot, { backgroundColor: user.activo ? COLORS.normal : COLORS.textMuted }]} />
              <Text style={[styles.statusBtnText, user.activo && styles.statusBtnTextActive]}>Activo</Text>
            </View>
            <View style={[styles.statusBtn, !user.activo && styles.statusBtnInactive, user.activo && { opacity: 0.5 }]}>
              <View style={[styles.dot, { backgroundColor: !user.activo ? COLORS.riesgoHiper : COLORS.textMuted }]} />
              <Text style={[styles.statusBtnText, !user.activo && styles.statusBtnTextInactive]}>Pendiente</Text>
            </View>
          </View>

          <Text style={styles.nota} testID="admin-modal-aviso">
            Cambiar el rol, desactivar o eliminar una cuenta no está disponible: el backend no ofrece esas acciones.
          </Text>

          {error ? <Text style={styles.error} testID="admin-modal-error">{error}</Text> : null}

          {puedeActivar && !confirmando && (
            <CustomButton title="Activar cuenta" onPress={() => setConfirmando(true)} style={styles.saveBtn} testID="admin-activar" />
          )}
          {puedeActivar && confirmando && (
            <>
              <Text style={styles.nota}>¿Activar la cuenta de {user.nombre}? No se puede deshacer desde la app.</Text>
              <CustomButton title="Confirmar activación" onPress={activar} loading={activando} style={styles.saveBtn} testID="admin-activar-confirmar" />
              <CustomButton title="Cancelar" onPress={() => setConfirmando(false)} variant="ghost" disabled={activando} testID="admin-activar-cancelar" />
            </>
          )}
          {!confirmando && (
            <CustomButton title="Cerrar" onPress={onClose} variant="ghost" testID="admin-cerrar" />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  nota: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  error: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.riesgoHiperText,
    marginTop: 10,
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    width: '100%',
    maxWidth: 520,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    padding: 14,
    borderRadius: 16,
    marginBottom: 20,
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.backgroundWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.primary,
  },
  userName: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  userEmail: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  roleOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBtnSelected: {
    backgroundColor: COLORS.primary,
  },
  roleBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  roleBtnTextSelected: {
    color: '#FFFFFF',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    gap: 6,
  },
  statusBtnActive: {
    backgroundColor: COLORS.normalBg,
  },
  statusBtnInactive: {
    backgroundColor: COLORS.riesgoHiperBg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  statusBtnTextActive: {
    color: COLORS.normalText,
  },
  statusBtnTextInactive: {
    color: COLORS.riesgoHiperText,
  },
  saveBtn: {
    marginTop: 4,
  },
});

