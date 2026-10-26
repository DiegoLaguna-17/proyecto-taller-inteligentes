import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { CustomButton } from '../../../shared/CustomButton';
import { abrirDocumento } from '../../../shared/documentos';
import { esUrlAbrible } from '../../../services/administradorVista';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';

interface AcreditacionMedicaCardProps {
  matriculaUrl: string | null;
  carnetUrl: string | null;
}

// Documentos subidos por el médico (URL de Storage). La "verificación en el padrón nacional" de la maqueta no existe.
export const AcreditacionMedicaCard: React.FC<AcreditacionMedicaCardProps> = ({
  matriculaUrl,
  carnetUrl,
}) => {
  const [error, setError] = useState('');

  const abrir = async (url: string | null) => {
    setError('');
    const e = await abrirDocumento(url);
    if (e) setError(e);
  };

  return (
    <View style={styles.card} testID="solicitud-documentos">
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>DOCUMENTOS PROFESIONALES</Text>
      </View>

      <Text style={styles.licenseLabel}>Matrícula profesional (PDF)</Text>
      {esUrlAbrible(matriculaUrl) ? (
        <CustomButton
          title="Abrir matrícula"
          onPress={() => abrir(matriculaUrl)}
          variant="secondary"
          size="sm"
          iconLeft="fileText"
          style={styles.docBtn}
          testID="solicitud-abrir-matricula"
        />
      ) : (
        <Text style={styles.collegeText} testID="solicitud-sin-matricula">No se cargó la matrícula.</Text>
      )}

      <Text style={[styles.licenseLabel, styles.docGap]}>Carnet profesional</Text>
      {esUrlAbrible(carnetUrl) ? (
        <>
          <Image source={{ uri: carnetUrl }} style={styles.preview} resizeMode="contain" testID="solicitud-carnet-vista" />
          <CustomButton
            title="Abrir carnet"
            onPress={() => abrir(carnetUrl)}
            variant="secondary"
            size="sm"
            iconLeft="idCard"
            style={styles.docBtn}
            testID="solicitud-abrir-carnet"
          />
        </>
      ) : (
        <Text style={styles.collegeText} testID="solicitud-sin-carnet">No se cargó el carnet.</Text>
      )}

      {error ? <Text style={styles.error} testID="solicitud-doc-error">{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  docBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  docGap: {
    marginTop: 16,
  },
  preview: {
    width: '100%',
    height: 170,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    marginTop: 8,
  },
  error: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.riesgoHiperText,
    marginTop: 10,
  },
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
  },
  officialBadge: {
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  officialText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  licenseLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  licenseNumber: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  collegeText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 14,
  },
  verifiedBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    padding: 12,
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  verifiedTextCol: {
    flex: 1,
  },
  verifiedTitle: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  verifiedDesc: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.textSecondary,
  },
});

