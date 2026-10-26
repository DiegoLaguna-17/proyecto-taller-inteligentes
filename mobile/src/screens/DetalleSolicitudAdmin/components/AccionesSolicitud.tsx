import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CustomButton } from '../../../shared/CustomButton';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface AccionesSolicitudProps {
  onAccept: () => void;
  loading?: boolean;
}

// El backend solo ofrece "activar": no existe un endpoint para rechazar solicitudes, así que ese botón queda deshabilitado.
export const AccionesSolicitud: React.FC<AccionesSolicitudProps> = ({
  onAccept,
  loading = false,
}) => {
  return (
    <View style={styles.container}>
      <CustomButton
        title="Activar cuenta"
        onPress={onAccept}
        iconLeft="userCheck"
        size="lg"
        loading={loading}
        style={styles.acceptBtn}
        testID="solicitud-activar"
      />
      <CustomButton
        title="Rechazar solicitud"
        onPress={() => {}}
        variant="secondary"
        size="lg"
        disabled
        testID="solicitud-rechazar"
      />
      <Text style={styles.nota} testID="solicitud-rechazar-aviso">
        Rechazar solicitudes no está disponible: el backend solo permite activar cuentas.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  nota: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  container: {
    gap: 12,
    marginBottom: 20,
  },
  acceptBtn: {
    // solid primary
  },
});

