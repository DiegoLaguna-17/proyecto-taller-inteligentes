import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export const ConfiguracionMenu: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Configuración y Seguridad</Text>

      <View style={styles.card}>
        {/* Item 1 */}
        <TouchableOpacity
          style={styles.itemRow}
          onPress={() => {
            Alert.alert(
              'Notificaciones',
              'Configuración de recordatorios matutinos y postprandiales activa.'
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Icon name="clock" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.itemTitle}>Notificaciones de tomas</Text>
            <Text style={styles.itemSub}>Alertas matutinas y postprandiales</Text>
          </View>
          <Icon name="chevronRight" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Item 2 */}
        <TouchableOpacity
          style={styles.itemRow}
          onPress={() => {
            Alert.alert(
              'Seguridad y acceso',
              'Opciones de biometría y actualización de contraseña.'
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Icon name="shieldCheck" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.itemTitle}>Seguridad y acceso</Text>
            <Text style={styles.itemSub}>Cambio de contraseña y biometría</Text>
          </View>
          <Icon name="chevronRight" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Item 3 */}
        <TouchableOpacity
          style={styles.itemRow}
          onPress={() => {
            Alert.alert(
              'Exportación de registros',
              'Conexión segura establecida con el portal clínico.'
            );
          }}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <Icon name="share" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.itemTitle}>Exportación de registros</Text>
            <Text style={styles.itemSub}>Sincronización con portal médico</Text>
          </View>
          <Icon name="chevronRight" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    paddingHorizontal: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  itemTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  itemSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
});

