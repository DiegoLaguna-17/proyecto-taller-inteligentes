import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { InputField } from '../../../shared/InputField';
import { CustomButton } from '../../../shared/CustomButton';
import { OpcionesChips } from '../../../shared/OpcionesChips';
import { Icon } from '../../../shared/Icon';
import { elegirImagen, elegirPdf } from '../../../shared/selectores';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { tomarTurno, liberarTurno } from '../../../utils/turno';
import { Opcion, obtenerEspecialidades } from '../../../services/catalogos';
import { MIN_CONTRASENA } from '../../../services/registroPaciente';
import {
  SOLICITUD_MEDICO_VACIA,
  SolicitudMedico,
  enviarSolicitudMedico,
  validarSolicitudMedico,
} from '../../../services/registroMedico';
import { ArchivoLocal, MAX_IMAGEN_BYTES, MAX_PDF_BYTES, MB } from '../../../services/archivos';
import { mensajeDeError } from '../../../services/http';
import { mensajeFalloRegistro } from '../../../services/registroAviso';

interface SolicitudMedicoFormProps {
  onSuccess: () => void;
}

const tamano = (a: ArchivoLocal) => (a.bytes !== undefined ? ` (${(a.bytes / MB).toFixed(1)} MB)` : '');

export const SolicitudMedicoForm: React.FC<SolicitudMedicoFormProps> = ({ onSuccess }) => {
  const [form, setForm] = useState<SolicitudMedico>(SOLICITUD_MEDICO_VACIA);
  const [especialidades, setEspecialidades] = useState<Opcion[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorEnvio, setErrorEnvio] = useState('');
  const [enviando, setEnviando] = useState(false);
  const turno = useRef(false); // guarda síncrona contra el doble toque

  const cambiar = <K extends keyof SolicitudMedico>(clave: K, valor: SolicitudMedico[K]) =>
    setForm((f) => ({ ...f, [clave]: valor }));

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      setEspecialidades(await obtenerEspecialidades());
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const elegirArchivo = async (campo: 'matricula' | 'carnet') => {
    setErrors((e) => ({ ...e, [campo]: '' }));
    const r = campo === 'matricula' ? await elegirPdf('matricula') : await elegirImagen('carnet');
    if (!r) return;
    if ('error' in r) setErrors((e) => ({ ...e, [campo]: r.error }));
    else cambiar(campo, r.archivo);
  };

  const handleEnviar = async () => {
    if (enviando) return;
    setErrorEnvio('');
    // Todo se valida ANTES de enviar: el backend sube los archivos antes de revisar el resto
    const e = validarSolicitudMedico(form);
    setErrors(e);
    if (Object.keys(e).length > 0) {
      setErrorEnvio('Revisa los campos marcados en rojo.');
      return;
    }
    if (!tomarTurno(turno)) return;
    setEnviando(true);
    try {
      await enviarSolicitudMedico(form);
      setForm(SOLICITUD_MEDICO_VACIA); // la contraseña no queda en memoria
      onSuccess();
    } catch (err) {
      setErrorEnvio(mensajeFalloRegistro(err));
    } finally {
      setEnviando(false);
      liberarTurno(turno);
    }
  };

  if (cargando) {
    return (
      <View style={styles.estado} testID="registro-medico-cargando">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (errorCarga || !especialidades) {
    return (
      <View style={styles.estado}>
        <Text style={styles.errorTexto} testID="registro-medico-error-carga">
          {errorCarga || 'No se pudieron cargar las especialidades.'}
        </Text>
        <CustomButton title="Reintentar" onPress={cargar} testID="registro-medico-reintentar" />
      </View>
    );
  }

  return (
    <View testID="registro-medico-form">
      <Text style={styles.section}>Datos de acceso</Text>
      <InputField
        label="Nombre completo"
        placeholder="Ej. Dra. Carmen Silva"
        value={form.nombreCompleto}
        onChangeText={(v) => cambiar('nombreCompleto', v)}
        leftIcon="idCard"
        autoCapitalize="words"
        error={errors.nombreCompleto}
        testID="registro-medico-nombre"
      />
      <InputField
        label="Correo electrónico"
        placeholder="nombre@ejemplo.com"
        value={form.correo}
        onChangeText={(v) => cambiar('correo', v)}
        leftIcon="mail"
        keyboardType="email-address"
        error={errors.correo}
        testID="registro-medico-correo"
      />
      <InputField
        label="Contraseña"
        placeholder="••••••••••••"
        value={form.contrasena}
        onChangeText={(v) => cambiar('contrasena', v)}
        leftIcon="lock"
        isPassword
        helperText={`Mínimo ${MIN_CONTRASENA} caracteres.`}
        error={errors.contrasena}
        testID="registro-medico-contrasena"
      />

      <Text style={styles.section}>Datos personales</Text>
      <InputField
        label="Fecha de nacimiento (AAAA-MM-DD)"
        placeholder="1985-05-10"
        value={form.fechaNac}
        onChangeText={(v) => cambiar('fechaNac', v)}
        leftIcon="calendar"
        error={errors.fechaNac}
        keyboardType="numbers-and-punctuation"
        testID="registro-medico-fecha-nac"
      />
      <InputField
        label="Teléfono"
        placeholder="70000000"
        value={form.telefono}
        onChangeText={(v) => cambiar('telefono', v.replace(/\D/g, ''))}
        leftIcon="phone"
        keyboardType="number-pad"
        maxLength={8}
        helperText="8 dígitos."
        error={errors.telefono}
        testID="registro-medico-telefono"
      />

      <Text style={styles.section}>Datos profesionales</Text>
      <InputField
        label="Departamento"
        placeholder="Ej. La Paz"
        value={form.departamento}
        onChangeText={(v) => cambiar('departamento', v)}
        error={errors.departamento}
        testID="registro-medico-departamento"
      />
      <OpcionesChips
        label="Especialidad"
        opciones={especialidades.map((o) => ({ id: o.id, etiqueta: o.etiqueta }))}
        seleccionado={form.idEspecialidad}
        onSelect={(id) => cambiar('idEspecialidad', id as number)}
        error={errors.idEspecialidad}
        testIDPrefix="registro-medico-especialidad"
      />

      <Text style={styles.section}>Documentos</Text>
      <View style={styles.archivo}>
        <Icon name="fileText" size={20} color={COLORS.primary} />
        <View style={styles.archivoInfo}>
          <Text style={styles.archivoTitulo}>Matrícula profesional (PDF, máx. {MAX_PDF_BYTES / MB} MB) *</Text>
          <Text style={styles.archivoNombre} testID="registro-medico-matricula-nombre">
            {form.matricula ? `${form.matricula.nombre}${tamano(form.matricula)}` : 'Ningún archivo elegido'}
          </Text>
        </View>
        <CustomButton
          title={form.matricula ? 'Cambiar' : 'Elegir'}
          onPress={() => elegirArchivo('matricula')}
          variant="secondary"
          size="sm"
          style={styles.archivoBtn}
          testID="registro-medico-matricula"
        />
      </View>
      {errors.matricula ? <Text style={styles.errorTexto} testID="registro-medico-matricula-error">{errors.matricula}</Text> : null}

      <View style={styles.archivo}>
        <Icon name="idCard" size={20} color={COLORS.primary} />
        <View style={styles.archivoInfo}>
          <Text style={styles.archivoTitulo}>Carnet profesional (JPG o PNG, máx. {MAX_IMAGEN_BYTES / MB} MB) *</Text>
          <Text style={styles.archivoNombre} testID="registro-medico-carnet-nombre">
            {form.carnet ? `${form.carnet.nombre}${tamano(form.carnet)}` : 'Ningún archivo elegido'}
          </Text>
        </View>
        <CustomButton
          title={form.carnet ? 'Cambiar' : 'Elegir'}
          onPress={() => elegirArchivo('carnet')}
          variant="secondary"
          size="sm"
          style={styles.archivoBtn}
          testID="registro-medico-carnet"
        />
      </View>
      {errors.carnet ? <Text style={styles.errorTexto} testID="registro-medico-carnet-error">{errors.carnet}</Text> : null}

      {errorEnvio ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTexto} testID="registro-medico-error">{errorEnvio}</Text>
        </View>
      ) : null}

      <CustomButton
        title="Enviar solicitud"
        onPress={handleEnviar}
        iconLeft="send"
        loading={enviando}
        style={styles.submitBtn}
        testID="registro-medico-enviar"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  estado: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  section: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginTop: 8,
    marginBottom: 12,
  },
  archivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  archivoInfo: {
    flex: 1,
    minWidth: 0,
  },
  archivoBtn: {
    width: 'auto',
    minWidth: 84,
    flexShrink: 0,
  },
  archivoTitulo: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  archivoNombre: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: COLORS.riesgoHiperBg,
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  errorTexto: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.riesgoHiperText,
    textAlign: 'center',
    marginBottom: 6,
  },
  submitBtn: {
    marginTop: 16,
  },
});
