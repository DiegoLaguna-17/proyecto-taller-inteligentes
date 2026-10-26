import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { CustomButton } from '../../../shared/CustomButton';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface SuccessModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({ visible, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Icon name="check" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>¡Solicitud enviada!</Text>
          <Text style={styles.description}>
            Tu solicitud de acceso fue registrada correctamente. Un administrador la
            revisará y recibirás una notificación cuando sea aprobada.
          </Text>
          <CustomButton
            title="Volver a Iniciar sesión"
            onPress={onClose}
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  btn: {
    width: '100%',
  },
});

