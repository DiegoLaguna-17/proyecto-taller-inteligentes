import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export type MomentoType =
  | 'Ayunas'
  | 'Antes de comer'
  | 'Postprandial'
  | 'Antes de dormir';

interface MomentoTomaSelectorProps {
  selectedMomento: MomentoType;
  onSelectMomento: (m: MomentoType) => void;
}

const MOMENTOS: MomentoType[] = [
  'Ayunas',
  'Antes de comer',
  'Postprandial',
  'Antes de dormir',
];

export const MomentoTomaSelector: React.FC<MomentoTomaSelectorProps> = ({
  selectedMomento,
  onSelectMomento,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>
          Momento de la toma <Text style={styles.requiredStar}>*</Text>
        </Text>
        <Text style={styles.subText}>Selección única</Text>
      </View>

      <View style={styles.grid}>
        {MOMENTOS.map((momento) => {
          const isSelected = selectedMomento === momento;
          return (
            <TouchableOpacity
              key={momento}
              style={[
                styles.optionBtn,
                isSelected && styles.optionBtnSelected,
              ]}
              onPress={() => onSelectMomento(momento)}
              activeOpacity={0.8}
            >
              {isSelected && (
                <Icon
                  name="check"
                  size={16}
                  color="#FFFFFF"
                  style={{ marginRight: 6 }}
                />
              )}
              <Text
                style={[
                  styles.optionText,
                  isSelected && styles.optionTextSelected,
                ]}
              >
                {momento}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  requiredStar: {
    color: COLORS.riesgoHiper,
  },
  subText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionBtn: {
    width: '48%',
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBtnSelected: {
    backgroundColor: COLORS.primary,
  },
  optionText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
});

