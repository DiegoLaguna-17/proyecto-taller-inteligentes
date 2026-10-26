import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { CustomButton } from '../../../shared/CustomButton';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { PacienteMedico } from '../../../services/medico';

interface ModalSeleccionPacienteProps {
  visible: boolean;
  pacientes: PacienteMedico[];
  seleccionado: number | null;
  onSelect: (id: number) => void;
  onClose: () => void;
}

export const ModalSeleccionPaciente: React.FC<ModalSeleccionPacienteProps> = ({
  visible,
  pacientes,
  seleccionado,
  onSelect,
  onClose,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay} testID="reportes-modal-pacientes">
        <View style={styles.card}>
          <Text style={styles.title}>Seleccionar paciente</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {pacientes.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.fila}
                onPress={() => onSelect(p.id)}
                activeOpacity={0.7}
                testID={`reportes-paciente-${p.id}`}
              >
                <Text style={[styles.nombre, seleccionado === p.id && styles.nombreActivo]}>{p.nombre}</Text>
                {seleccionado === p.id && <Icon name="check" size={16} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <CustomButton title="Cerrar" onPress={onClose} variant="ghost" style={styles.btn} testID="reportes-modal-cerrar" />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: '75%',
    width: '100%',
    maxWidth: 520,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  nombre: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  nombreActivo: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  btn: {
    marginTop: 10,
  },
});
