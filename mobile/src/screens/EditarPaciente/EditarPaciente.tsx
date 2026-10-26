import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TopHeader } from '../../shared/TopHeader';
import { InputField } from '../../shared/InputField';
import { CustomButton } from '../../shared/CustomButton';
import { OpcionesChips } from '../../shared/OpcionesChips';
import { ModalMensaje } from '../../shared/ModalMensaje';
import { COLORS } from '../../utils/colors';
import { FONTS } from '../../utils/typography';
import { tomarTurno, liberarTurno } from '../../utils/turno';
import { PerfilPaciente, actualizarPaciente } from '../../services/paciente';
import {
  FormEdicion,
  construirActualizacion,
  empiezaEmbarazo,
  formDesdePerfil,
  hayCambios,
  terminaEmbarazo,
  validarEdicion,
} from '../../services/edicionPaciente';
import { mensajeDeError } from '../../services/http';

interface EditarPacienteProps {
  perfil: PerfilPaciente;
  onBack: () => void;
  /** Se llama tras guardar con éxito, para recargar el perfil y volver. */
  onGuardado: () => void;
}

export const EditarPaciente: React.FC<EditarPacienteProps> = ({ perfil, onBack, onGuardado }) => {
  const [form, setForm] = useState<FormEdicion>(() => formDesdePerfil(perfil));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const turno = useRef(false); // guarda síncrona contra el doble toque
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);

  const cambiar = <K extends keyof FormEdicion>(clave: K, valor: FormEdicion[K]) =>
    setForm((f) => ({ ...f, [clave]: valor }));

  // Solo las mujeres pueden indicar embarazo (o quien ya lo tiene registrado)
  const muestraEmbarazo = perfil.genero === 'Femenino' || perfil.embarazo;

  const handleGuardar = () => {
    setAviso('');
    const e = validarEdicion(form, perfil);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    if (!hayCambios(form, perfil)) {
      setAviso('No hay cambios que guardar.');
      return;
    }
    setConfirmar(true);
  };

  const handleConfirmar = async () => {
    if (perfil.idUsuario === null) {
      setConfirmar(false);
      setResultado({ ok: false, mensaje: 'No se pudo identificar tu cuenta. Cierra sesión e inicia de nuevo.' });
      return;
    }
    if (!tomarTurno(turno)) return;
    setGuardando(true);
    try {
      await actualizarPaciente(perfil.idUsuario, construirActualizacion(form, perfil));
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
        <Text style={styles.section}>Datos personales</Text>
        <InputField
          label="Nombre completo"
          value={form.nombre}
          onChangeText={(v) => cambiar('nombre', v)}
          leftIcon="idCard"
          autoCapitalize="words"
          error={errors.nombre}
          testID="editar-nombre"
        />
        <InputField
          label="Correo electrónico"
          value={form.correo}
          onChangeText={(v) => cambiar('correo', v)}
          leftIcon="mail"
          keyboardType="email-address"
          error={errors.correo}
          helperText="Es el correo con el que inicias sesión."
          testID="editar-correo"
        />
        <InputField
          label="Teléfono"
          value={form.telefono}
          onChangeText={(v) => cambiar('telefono', v.replace(/\D/g, ''))}
          leftIcon="phone"
          keyboardType="number-pad"
          maxLength={8}
          error={errors.telefono}
          testID="editar-telefono"
        />

        <Text style={styles.section}>Medidas</Text>
        <InputField
          label="Altura (cm)"
          helperText="Escríbela en centímetros (ej. 165)."
          value={form.altura}
          onChangeText={(v) => cambiar('altura', v)}
          keyboardType="decimal-pad"
          error={errors.altura}
          testID="editar-altura"
        />
        <InputField
          label="Peso (kg)"
          value={form.peso}
          onChangeText={(v) => cambiar('peso', v)}
          keyboardType="decimal-pad"
          error={errors.peso}
          testID="editar-peso"
        />

        <Text style={styles.section}>Contacto de emergencia</Text>
        <InputField
          label="Nombre del contacto"
          value={form.nombreEmergencia}
          onChangeText={(v) => cambiar('nombreEmergencia', v)}
          leftIcon="user"
          autoCapitalize="words"
          error={errors.nombreEmergencia}
          testID="editar-emergencia-nombre"
        />
        <InputField
          label="Teléfono del contacto"
          value={form.numeroEmergencia}
          onChangeText={(v) => cambiar('numeroEmergencia', v.replace(/\D/g, ''))}
          leftIcon="phone"
          keyboardType="number-pad"
          maxLength={8}
          error={errors.numeroEmergencia}
          testID="editar-emergencia-numero"
        />

        {muestraEmbarazo && (
          <>
            <Text style={styles.section}>Embarazo</Text>
            <OpcionesChips
              label="¿Estás embarazada?"
              opciones={[{ id: 'si', etiqueta: 'Sí' }, { id: 'no', etiqueta: 'No' }]}
              seleccionado={form.embarazo ? 'si' : 'no'}
              onSelect={(id) => cambiar('embarazo', id === 'si')}
              testIDPrefix="editar-embarazo"
            />
            {empiezaEmbarazo(form, perfil) && (
              <InputField
                label="Semanas de embarazo"
                value={form.semanas}
                onChangeText={(v) => cambiar('semanas', v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={2}
                error={errors.semanas}
                testID="editar-semanas"
              />
            )}
            {terminaEmbarazo(form, perfil) && (
              <InputField
                label="Fecha de terminación (AAAA-MM-DD)"
                value={form.fechaTerminacion}
                onChangeText={(v) => cambiar('fechaTerminacion', v)}
                leftIcon="calendar"
                error={errors.fechaTerminacion}
                keyboardType="numbers-and-punctuation"
                testID="editar-fecha-terminacion"
              />
            )}
          </>
        )}

        {aviso ? <Text style={styles.aviso} testID="editar-aviso">{aviso}</Text> : null}

        <CustomButton
          title="Guardar cambios"
          onPress={handleGuardar}
          iconLeft="check"
          size="lg"
          style={styles.saveBtn}
          testID="editar-guardar"
        />
        <CustomButton
          title="Cancelar"
          onPress={onBack}
          variant="ghost"
          testID="editar-cancelar"
        />
      </ScrollView>

      <ModalMensaje
        visible={confirmar}
        titulo="¿Guardar los cambios?"
        mensaje={
          cambiaCorreo
            ? 'Vas a cambiar tu correo electrónico. Con ese correo iniciarás sesión desde ahora.'
            : 'Se actualizarán tus datos personales.'
        }
        textoConfirmar="Guardar"
        onConfirm={handleConfirmar}
        textoCancelar="Revisar"
        onCancel={() => setConfirmar(false)}
        loading={guardando}
        testIDPrefix="editar-confirmacion"
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
        testIDPrefix="editar-resultado"
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
  aviso: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  saveBtn: {
    marginTop: 8,
    marginBottom: 4,
  },
});
