import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { InputField } from '../../shared/InputField';
import { CustomButton } from '../../shared/CustomButton';
import { ModalMensaje } from '../../shared/ModalMensaje';
import { elegirImagen } from '../../shared/selectores';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { tomarTurno, liberarTurno } from '../../utils/turno';
import { PerfilMedico, actualizarMedico } from '../../services/medico';
import {
  FormEdicionMedico,
  construirActualizacionMedico,
  formDesdePerfilMedico,
  hayCambiosMedico,
  validarEdicionMedico,
} from '../../services/edicionMedico';
import { mensajeDeError } from '../../services/http';

interface EditarMedicoProps {
  /** id_medico de la sesión (id_rol). */
  idMedico: number;
  perfil: PerfilMedico;
  onBack: () => void;
  /** Se llama tras guardar con éxito, para recargar el perfil y volver. */
  onGuardado: () => void;
}

export const EditarMedico: React.FC<EditarMedicoProps> = ({ idMedico, perfil, onBack, onGuardado }) => {
  const [form, setForm] = useState<FormEdicionMedico>(() => formDesdePerfilMedico(perfil));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const turno = useRef(false); // guarda síncrona contra el doble toque
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);

  const cambiar = <K extends keyof FormEdicionMedico>(clave: K, valor: FormEdicionMedico[K]) =>
    setForm((f) => ({ ...f, [clave]: valor }));

  const elegirCarnet = async () => {
    setErrors((e) => ({ ...e, carnet: '' }));
    const r = await elegirImagen('carnet');
    if (!r) return;
    if ('error' in r) setErrors((e) => ({ ...e, carnet: r.error }));
    else cambiar('carnet', r.archivo);
  };

  const handleGuardar = () => {
    setAviso('');
    const e = validarEdicionMedico(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    if (!hayCambiosMedico(form, perfil)) {
      setAviso('No hay cambios que guardar.');
      return;
    }
    setConfirmar(true);
  };

  const handleConfirmar = async () => {
    if (guardando) return;
    if (!tomarTurno(turno)) return;
    setGuardando(true);
    try {
      await actualizarMedico(idMedico, construirActualizacionMedico(form, perfil));
      setConfirmar(false);
      setResultado({ ok: true, mensaje: 'Tus datos se actualizaron correctamente.' });
    } catch (e) {
      setConfirmar(false);
      setResultado({ ok: false, mensaje: mensajeDeError(e) });
    } finally {
      setGuardando(false);
      liberarTurno(turno);
    }
  };

  const cambiaCorreo = form.correo.trim() !== (perfil.correo ?? '');
  const vistaCarnet = form.carnet?.uri ?? perfil.carnetUrl;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TopHeader title="Editar mis datos" showBack onBack={onBack} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.nota}>
          Solo puedes cambiar tu teléfono, correo, departamento y carnet. El nombre y la fecha de nacimiento no se editan desde la app.
        </Text>

        <InputField
          label="Teléfono"
          value={form.telefono}
          onChangeText={(v) => cambiar('telefono', v.replace(/\D/g, ''))}
          leftIcon="phone"
          keyboardType="number-pad"
          maxLength={8}
          error={errors.telefono}
          testID="medico-editar-telefono"
        />
        <InputField
          label="Correo electrónico"
          value={form.correo}
          onChangeText={(v) => cambiar('correo', v)}
          leftIcon="mail"
          keyboardType="email-address"
          error={errors.correo}
          helperText="Es el correo con el que inicias sesión."
          testID="medico-editar-correo"
        />
        <InputField
          label="Departamento"
          value={form.departamento}
          onChangeText={(v) => cambiar('departamento', v)}
          error={errors.departamento}
          testID="medico-editar-departamento"
        />

        <Text style={styles.section}>Carnet profesional</Text>
        {vistaCarnet ? (
          <Image source={{ uri: vistaCarnet }} style={styles.carnet} resizeMode="contain" testID="medico-editar-carnet-vista" />
        ) : (
          <Text style={styles.nota}>Aún no hay un carnet cargado.</Text>
        )}
        <CustomButton
          title={form.carnet ? 'Cambiar imagen elegida' : 'Elegir nuevo carnet'}
          onPress={elegirCarnet}
          variant="secondary"
          size="sm"
          testID="medico-editar-carnet"
        />
        <Text style={styles.nota}>JPG o PNG, máximo 2 MB.</Text>
        {errors.carnet ? <Text style={styles.error} testID="medico-editar-carnet-error">{errors.carnet}</Text> : null}

        {aviso ? <Text style={styles.aviso} testID="medico-editar-aviso">{aviso}</Text> : null}

        <CustomButton
          title="Guardar cambios"
          onPress={handleGuardar}
          iconLeft="check"
          size="lg"
          style={styles.saveBtn}
          testID="medico-editar-guardar"
        />
        <CustomButton title="Cancelar" onPress={onBack} variant="ghost" testID="medico-editar-cancelar" />
      </ScrollView>

      <ModalMensaje
        visible={confirmar}
        titulo="¿Guardar los cambios?"
        mensaje={
          cambiaCorreo
            ? 'Vas a cambiar tu correo electrónico. Con ese correo iniciarás sesión desde ahora.'
            : 'Se actualizarán tus datos de contacto.'
        }
        textoConfirmar="Guardar"
        onConfirm={handleConfirmar}
        textoCancelar="Revisar"
        onCancel={() => setConfirmar(false)}
        loading={guardando}
        testIDPrefix="medico-editar-confirmacion"
      />

      <ModalMensaje
        visible={resultado !== null}
        titulo={resultado?.ok ? 'Datos actualizados' : 'No se pudo guardar'}
        mensaje={resultado?.mensaje ?? ''}
        textoConfirmar={resultado?.ok ? 'Listo' : 'Cerrar'}
        onConfirm={() => {
          const ok = resultado?.ok;
          setResultado(null);
          if (ok) onGuardado();
        }}
        testIDPrefix="medico-editar-resultado"
      />
    </KeyboardAvoidingView>
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
  section: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginTop: 8,
    marginBottom: 12,
  },
  nota: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  carnet: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: 12,
  },
  error: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.riesgoHiperText,
    marginTop: 6,
  },
  aviso: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: 12,
  },
  saveBtn: {
    marginTop: 8,
    marginBottom: 4,
  },
});
