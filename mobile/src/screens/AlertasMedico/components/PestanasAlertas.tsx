import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export type PestanaAlertas = 'activas' | 'resueltas';

interface PestanasAlertasProps {
  seleccionada: PestanaAlertas;
  onSelect: (p: PestanaAlertas) => void;
  activas: number;
  resueltas: number;
}

export const PestanasAlertas: React.FC<PestanasAlertasProps> = ({ seleccionada, onSelect, activas, resueltas }) => {
  const tabs: { id: PestanaAlertas; texto: string }[] = [
    { id: 'activas', texto: `Activas (${activas})` },
    { id: 'resueltas', texto: `Resueltas (${resueltas})` },
  ];
  return (
    <View style={styles.container}>
      {tabs.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={[styles.tab, seleccionada === t.id && styles.tabActiva]}
          onPress={() => onSelect(t.id)}
          activeOpacity={0.8}
          testID={`alertas-pestana-${t.id}`}
        >
          <Text style={[styles.tabText, seleccionada === t.id && styles.tabTextActiva]}>{t.texto}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActiva: {
    backgroundColor: COLORS.backgroundWhite,
  },
  tabText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  tabTextActiva: {
    color: COLORS.primary,
  },
});
