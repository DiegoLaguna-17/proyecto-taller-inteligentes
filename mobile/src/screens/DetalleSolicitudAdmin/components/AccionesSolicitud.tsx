import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CustomButton } from '../../../shared/CustomButton';

interface AccionesSolicitudProps {
  onAccept: () => void;
  onReject: () => void;
}

export const AccionesSolicitud: React.FC<AccionesSolicitudProps> = ({
  onAccept,
  onReject,
}) => {
  return (
    <View style={styles.container}>
      <CustomButton
        title="Aceptar solicitud"
        onPress={onAccept}
        iconLeft="userCheck"
        size="lg"
        style={styles.acceptBtn}
      />
      <CustomButton
        title="Rechazar solicitud"
        onPress={onReject}
        variant="secondary"
        size="lg"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginBottom: 20,
  },
  acceptBtn: {
    // solid primary
  },
});

