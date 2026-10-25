import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';
import { COLORS } from '../utils/colors';
import { FONTS } from '../utils/typography';
import { UserRole } from '../utils/mockData';

export type NavTabId = string;

interface TabConfig {
  id: NavTabId;
  label: string;
  iconName: string;
}

const ROLE_TABS: Record<UserRole, TabConfig[]> = {
  paciente: [
    { id: 'Inicio', label: 'Inicio', iconName: 'home' },
    { id: 'Historial', label: 'Historial', iconName: 'chart' },
    { id: 'ChatBot', label: 'ChatBot', iconName: 'bot' },
    { id: 'Perfil', label: 'Perfil', iconName: 'user' },
  ],
  medico: [
    { id: 'Pacientes', label: 'Pacientes', iconName: 'home' },
    { id: 'Alertas', label: 'Alertas', iconName: 'chart' },
    { id: 'Reportes', label: 'Reportes', iconName: 'bot' },
    { id: 'Perfil', label: 'Perfil', iconName: 'user' },
  ],
  admin: [
    { id: 'Solicitudes', label: 'Solicitudes', iconName: 'home' },
    { id: 'Usuarios', label: 'Usuarios', iconName: 'chart' },
    { id: 'Auditoria', label: 'Auditoría', iconName: 'bot' },
    { id: 'Perfil', label: 'Perfil', iconName: 'user' },
  ],
};

interface BottomNavBarProps {
  role: UserRole;
  activeTab: NavTabId;
  onSelectTab: (tabId: NavTabId) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  role,
  activeTab,
  onSelectTab,
}) => {
  const tabs = ROLE_TABS[role] || ROLE_TABS.paciente;

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const color = isActive ? COLORS.primary : COLORS.textSecondary;

        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabButton}
            onPress={() => onSelectTab(tab.id)}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Icon name={tab.iconName} size={22} color={color} />
            </View>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: color,
                  fontFamily: isActive ? FONTS.bold : FONTS.medium,
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: -0.2,
  },
});

