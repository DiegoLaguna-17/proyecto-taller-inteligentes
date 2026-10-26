import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';
import { COLORS } from '../utils/colors';
import { FONTS } from '../utils/typography';

interface TopHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  hasUnreadNotifications?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  title,
  subtitle = 'GLUCOTRACKER',
  showBack = false,
  onBack,
  onNotificationPress,
  onProfilePress,
  hasUnreadNotifications = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftContainer}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="arrowLeft" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.logoContainer}>
            <Icon name="logoDrop" size={26} color={COLORS.primary} />
          </View>
        )}

        <View style={styles.titleColumn}>
          {!showBack && (
            <Text style={styles.brandSubtitle}>{subtitle}</Text>
          )}
          <Text style={styles.titleText}>{title}</Text>
        </View>
      </View>

      <View style={styles.rightContainer}>
        {!showBack && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onNotificationPress}
            activeOpacity={0.7}
          >
            <Icon name="bell" size={22} color={COLORS.textPrimary} />
            {hasUnreadNotifications && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.avatarButton}
          onPress={onProfilePress}
          activeOpacity={0.7}
        >
          <View style={styles.avatarCircle}>
            <Icon name="user" size={18} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    marginRight: 10,
  },
  backButton: {
    marginRight: 12,
    padding: 2,
  },
  titleColumn: {
    justifyContent: 'center',
  },
  brandSubtitle: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  titleText: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.riesgoHiper,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarButton: {
    padding: 2,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

