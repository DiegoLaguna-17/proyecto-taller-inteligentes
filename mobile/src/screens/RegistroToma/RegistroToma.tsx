import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { Icon } from '../../shared/Icon';
import { CustomButton } from '../../shared/CustomButton';
import { ValorGlucosaCard } from './components/ValorGlucosaCard';
import { FechaHoraCard } from './components/FechaHoraCard';
import { MomentoTomaSelector, MomentoType } from './components/MomentoTomaSelector';
import { RecomendacionCard } from './components/RecomendacionCard';
import { ResultadoClasificacionModal } from './components/ResultadoClasificacionModal';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';

interface RegistroTomaProps {
  onBack: () => void;
  onSaveSuccess: () => void;
}

export const RegistroToma: React.FC<RegistroTomaProps> = ({
  onBack,
  onSaveSuccess,
}) => {
  const [value, setValue] = useState(124);
  const [momento, setMomento] = useState<MomentoType>('Postprandial');
  const [showResultModal, setShowResultModal] = useState(false);

  const handleSave = () => {
    // Show classification step/modal
    setShowResultModal(true);
  };

  const handleFinish = () => {
    setShowResultModal(false);
    onSaveSuccess();
  };

  return (
    <View style={styles.container}>
      <TopHeader
        title="Registro De Glucosa"
        showBack
        onBack={onBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Paso 1 de 2 */}
        <View style={styles.stepBanner}>
          <View style={styles.iconCircle}>
            <Icon name="drop" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerTitle}>Registrar Glucemia</Text>
            <Text style={styles.bannerSubtitle}>
              Completa los datos de tu medición...
            </Text>
          </View>
          <View style={styles.stepPill}>
            <Text style={styles.stepPillText}>Paso 1 de 2</Text>
          </View>
        </View>

        {/* Input Cards */}
        <ValorGlucosaCard value={value} onChangeValue={setValue} />

        <FechaHoraCard
          timeText="Hoy, 14:35"
          onPressCambiar={() => {
            Alert.alert('Fecha y hora', 'Usa la hora actual del dispositivo detectada.');
          }}
        />

        <MomentoTomaSelector
          selectedMomento={momento}
          onSelectMomento={setMomento}
        />

        <RecomendacionCard />

        {/* Save button */}
        <CustomButton
          title="Guardar toma"
          onPress={handleSave}
          iconLeft="check"
          size="lg"
          style={styles.saveBtn}
        />
      </ScrollView>

      {/* Result Modal / Step 2 */}
      <ResultadoClasificacionModal
        visible={showResultModal}
        value={value}
        moment={momento}
        onGoHome={handleFinish}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  stepBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.backgroundWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerInfo: {
    flex: 1,
  },
  bannerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  bannerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  stepPill: {
    backgroundColor: COLORS.backgroundWhite,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  stepPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  saveBtn: {
    marginTop: 4,
  },
});

