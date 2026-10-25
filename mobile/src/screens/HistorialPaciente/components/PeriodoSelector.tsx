import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

export type PeriodoType = 'Diario' | 'Semanal' | 'Mensual';
export type ViewMode = 'grafico' | 'lista';

interface PeriodoSelectorProps {
  periodo: PeriodoType;
  onSelectPeriodo: (p: PeriodoType) => void;
  viewMode: ViewMode;
  onToggleViewMode: (mode: ViewMode) => void;
}

export const PeriodoSelector: React.FC<PeriodoSelectorProps> = ({
  periodo,
  onSelectPeriodo,
  viewMode,
  onToggleViewMode,
}) => {
  return (
    <View style={styles.container}>
      {/* 3 tabs */}
      <View style={styles.segmentedContainer}>
        {(['Diario', 'Semanal', 'Mensual'] as PeriodoType[]).map((tab) => {
          const isActive = periodo === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.segmentBtn, isActive && styles.segmentBtnActive]}
              onPress={() => onSelectPeriodo(tab)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentText,
                  isActive && styles.segmentTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Date row & View switcher */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.datePill} activeOpacity={0.7}>
          <Icon name="calendar" size={16} color={COLORS.primary} />
          <Text style={styles.dateText}>17 Oct - 24 Oct, 2024</Text>
          <Icon name="chevronDown" size={14} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <View style={styles.viewToggleGroup}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              viewMode === 'grafico' && styles.toggleBtnActive,
            ]}
            onPress={() => onToggleViewMode('grafico')}
            activeOpacity={0.8}
          >
            <Icon
              name="chart"
              size={18}
              color={viewMode === 'grafico' ? COLORS.primary : COLORS.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              viewMode === 'lista' && styles.toggleBtnActive,
            ]}
            onPress={() => onToggleViewMode('lista')}
            activeOpacity={0.8}
          >
            <Icon
              name="list"
              size={18}
              color={viewMode === 'lista' ? COLORS.primary : COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: COLORS.backgroundWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  segmentTextActive: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  datePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  dateText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 3,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: COLORS.backgroundWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
});

