import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { CustomButton } from '../../../shared/CustomButton';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface ConfirmarTomaModalProps {
  visible: boolean;
  value: number;
  moment: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Confirma antes de guardar: una lectura mal escrita podría avisar por error al médico.
export const ConfirmarTomaModal: React.FC<ConfirmarTomaModalProps> = ({
  visible,
  value,
  moment,
  loading,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay} testID="registro-confirmacion">
        <View style={styles.card}>
          <Text style={styles.title}>¿Confirmas esta toma?</Text>
          <Text style={styles.detail}>
            {value} mg/dL · {moment}
          </Text>
          <Text style={styles.note}>
            Si el valor está fuera de rango, se avisará a tu médico. Revisa que sea correcto.
          </Text>
          <CustomButton
            title="Confirmar y guardar"
            onPress={onConfirm}
            loading={loading}
            testID="registro-confirmar"
            style={styles.btn}
          />
          <CustomButton
            title="Corregir"
            onPress={onCancel}
            variant="ghost"
            disabled={loading}
            testID="registro-cancelar"
            style={styles.btn}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  detail: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
    marginBottom: 8,
  },
  note: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  btn: {
    width: '100%',
    marginTop: 6,
  },
});
