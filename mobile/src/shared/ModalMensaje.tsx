import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { CustomButton } from './CustomButton';
import { COLORS } from '../utils/colors';
import { FONTS } from '../utils/typography';

interface ModalMensajeProps {
  visible: boolean;
  titulo: string;
  mensaje: string;
  textoConfirmar: string;
  onConfirm: () => void;
  /** Si se pasa, aparece el botón secundario (confirmaciones). */
  textoCancelar?: string;
  onCancel?: () => void;
  loading?: boolean;
  /** Prefijo de los testID: `${testIDPrefix}`, `-confirmar`, `-cancelar`, `-mensaje`. */
  testIDPrefix: string;
}

// Modal simple (confirmación o aviso) con el estilo de los modales de la app.
export const ModalMensaje: React.FC<ModalMensajeProps> = ({
  visible,
  titulo,
  mensaje,
  textoConfirmar,
  onConfirm,
  textoCancelar,
  onCancel,
  loading = false,
  testIDPrefix,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay} testID={testIDPrefix}>
        <View style={styles.card}>
          <Text style={styles.title}>{titulo}</Text>
          <Text style={styles.note} testID={`${testIDPrefix}-mensaje`}>{mensaje}</Text>
          <CustomButton
            title={textoConfirmar}
            onPress={onConfirm}
            loading={loading}
            testID={`${testIDPrefix}-confirmar`}
            style={styles.btn}
          />
          {textoCancelar && onCancel ? (
            <CustomButton
              title={textoCancelar}
              onPress={onCancel}
              variant="ghost"
              disabled={loading}
              testID={`${testIDPrefix}-cancelar`}
              style={styles.btn}
            />
          ) : null}
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
  note: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  btn: {
    width: '100%',
    marginTop: 6,
  },
});
