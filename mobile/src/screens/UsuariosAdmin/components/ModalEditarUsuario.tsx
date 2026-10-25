import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { CustomButton } from '../../../shared/CustomButton';
import { AdminUser } from '../../../utils/mockData';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface ModalEditarUsuarioProps {
  user: AdminUser | null;
  visible: boolean;
  onClose: () => void;
  onSave: (updatedUser: AdminUser) => void;
}

export const ModalEditarUsuario: React.FC<ModalEditarUsuarioProps> = ({
  user,
  visible,
  onClose,
  onSave,
}) => {
  const [role, setRole] = useState<'Paciente' | 'Médico' | 'Admin'>('Paciente');
  const [status, setStatus] = useState<'Activo' | 'Inactivo'>('Activo');

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setStatus(user.status);
    }
  }, [user]);

  if (!user) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Gestionar Usuario</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.userInfoRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.initialsText}>{user.initials}</Text>
            </View>
            <View>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          </View>

          {/* Role selector */}
          <Text style={styles.sectionLabel}>Rol en el sistema</Text>
          <View style={styles.roleOptions}>
            {(['Paciente', 'Médico', 'Admin'] as const).map((r) => {
              const isSelected = role === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.roleBtn,
                    isSelected && styles.roleBtnSelected,
                  ]}
                  onPress={() => setRole(r)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.roleBtnText,
                      isSelected && styles.roleBtnTextSelected,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Status selector */}
          <Text style={styles.sectionLabel}>Estado de la cuenta</Text>
          <View style={styles.statusRow}>
            <TouchableOpacity
              style={[
                styles.statusBtn,
                status === 'Activo' && styles.statusBtnActive,
              ]}
              onPress={() => setStatus('Activo')}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      status === 'Activo' ? COLORS.normal : COLORS.textMuted,
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusBtnText,
                  status === 'Activo' && styles.statusBtnTextActive,
                ]}
              >
                Activo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusBtn,
                status === 'Inactivo' && styles.statusBtnInactive,
              ]}
              onPress={() => setStatus('Inactivo')}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      status === 'Inactivo' ? COLORS.riesgoHiper : COLORS.textMuted,
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusBtnText,
                  status === 'Inactivo' && styles.statusBtnTextInactive,
                ]}
              >
                Inactivo
              </Text>
            </TouchableOpacity>
          </View>

          <CustomButton
            title="Guardar Cambios"
            onPress={() => {
              onSave({ ...user, role, status });
              onClose();
            }}
            style={styles.saveBtn}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
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

