import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { InputField } from '../../../shared/InputField';
import { CustomButton } from '../../../shared/CustomButton';
import { OpcionesChips } from '../../../shared/OpcionesChips';
import { Icon } from '../../../shared/Icon';
import { COLORS } from '../../../utils/colors';
import { FONTS } from '../../../utils/typography';
import { tomarTurno, liberarTurno } from '../../../utils/turno';
import {
  Opcion,
  obtenerEnfermedades,
  obtenerMedicos,
  obtenerNiveles,
  obtenerTratamientos,
} from '../../../services/catalogos';
import {
  MIN_CONTRASENA,
  SOLICITUD_VACIA,
  SolicitudPaciente,
  enviarSolicitudPaciente,
  validarSolicitudPaciente,
} from '../../../services/registroPaciente';
import { mensajeDeError } from '../../../services/http';
import { mensajeFalloRegistro } from '../../../services/registroAviso';

interface SolicitudPacienteFormProps {
  onSuccess: () => void;
}

interface Catalogos {
  niveles: Opcion[];
  enfermedades: Opcion[];
  tratamientos: Opcion[];
  medicos: Opcion[];
}

const chips = (o: Opcion[]) => o.map((x) => ({ id: x.id, etiqueta: x.etiqueta }));

export const SolicitudPacienteForm: React.FC<SolicitudPacienteFormProps> = ({ onSuccess }) => {
  const [form, setForm] = useState<SolicitudPaciente>(SOLICITUD_VACIA);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorEnvio, setErrorEnvio] = useState('');
  const [enviando, setEnviando] = useState(false);
  const turno = useRef(false); // guarda síncrona contra el doble toque

  const cambiar = <K extends keyof SolicitudPaciente>(clave: K, valor: SolicitudPaciente[K]) =>
    setForm((f) => ({ ...f, [clave]: valor }));

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const [niveles, enfermedades, tratamientos, medicos] = await Promise.all([
        obtenerNiveles(),
        obtenerEnfermedades(),
        obtenerTratamientos(),
        obtenerMedicos(),
      ]);
      setCatalogos({ niveles, enfermedades, tratamientos, medicos });
    } catch (e) {
      setErrorCarga(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const elegirFoto = async () => {
    setErrors((e) => ({ ...e, foto: '' }));
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5, // comprime la foto para que la subida sea liviana
      });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      // Algunos proveedores de Android no informan el MIME: se deduce de la extensión
      const ext = (a.fileName ?? a.uri).split('.').pop()?.toLowerCase();
      let tipo = (a.mimeType ?? '').toLowerCase();
      if (!tipo) tipo = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : '';
      if (tipo === 'image/jpg') tipo = 'image/jpeg';
      if (tipo !== 'image/jpeg' && tipo !== 'image/png') {
        setErrors((e) => ({ ...e, foto: 'Selecciona una imagen JPG o PNG.' }));
        return;
      }
      // tipo = MIME completo y nombre con extensión, como exige el multipart
      cambiar('foto', {
        uri: a.uri,
        nombre: tipo === 'image/png' ? 'perfil.png' : 'perfil.jpg',
        tipo,
        bytes: a.fileSize,
      });
    } catch {
      setErrors((e) => ({ ...e, foto: 'No se pudo abrir la galería. Revisa los permisos de fotos.' }));
    }
  };

  const handleEnviar = async () => {
    setErrorEnvio('');
    const e = validarSolicitudPaciente(form);
    setErrors(e);
    if (Object.keys(e).length > 0) {
      setErrorEnvio('Revisa los campos marcados en rojo.');
      return;
    }
    if (!tomarTurno(turno)) return;
    setEnviando(true);
    try {
      await enviarSolicitudPaciente(form);
      setForm(SOLICITUD_VACIA); // la contraseña no queda en memoria
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
      <View style={styles.estado} testID="registro-paciente-cargando">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (errorCarga || !catalogos) {
    return (
      <View style={styles.estado}>
        <Text style={styles.errorTexto} testID="registro-paciente-error-carga">
          {errorCarga || 'No se pudieron cargar las opciones del formulario.'}
        </Text>
        <CustomButton title="Reintentar" onPress={cargar} testID="registro-paciente-reintentar" />
      </View>
    );
  }

  const tratamiento = catalogos.tratamientos.find((t) => t.id === form.tratamientoId);

  return (
    <View testID="registro-paciente-form">
      <Text style={styles.section}>Datos de acceso</Text>
      <InputField
        label="Nombre completo"
        placeholder="Ej. Carlos Ruiz"
        value={form.nombreCompleto}
        onChangeText={(v) => cambiar('nombreCompleto', v)}
        leftIcon="idCard"
        autoCapitalize="words"
        error={errors.nombreCompleto}
        testID="registro-paciente-nombre"
      />
      <InputField
        label="Correo electrónico"
        placeholder="nombre@ejemplo.com"
        value={form.correo}
        onChangeText={(v) => cambiar('correo', v)}
        leftIcon="mail"
        keyboardType="email-address"
        error={errors.correo}
        testID="registro-paciente-correo"
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
        testID="registro-paciente-contrasena"
      />

      <Text style={styles.section}>Datos personales</Text>
      <InputField
        label="Fecha de nacimiento (AAAA-MM-DD)"
        placeholder="1990-05-23"
        value={form.fechaNac}
        onChangeText={(v) => cambiar('fechaNac', v)}
        leftIcon="calendar"
        error={errors.fechaNac}
        keyboardType="numbers-and-punctuation"
        testID="registro-paciente-fecha-nac"
      />
      <InputField
        label="Teléfono"
        placeholder="70000000"
        value={form.telefono}
        onChangeText={(v) => cambiar('telefono', v.replace(/\D/g, ''))}
        leftIcon="phone"
        keyboardType="number-pad"
        maxLength={8}
        error={errors.telefono}
        testID="registro-paciente-telefono"
      />
      <OpcionesChips
        label="Género"
        opciones={[{ id: 'Masculino', etiqueta: 'Masculino' }, { id: 'Femenino', etiqueta: 'Femenino' }]}
        seleccionado={form.genero || null}
        onSelect={(id) => cambiar('genero', id as SolicitudPaciente['genero'])}
        error={errors.genero}
        testIDPrefix="registro-paciente-genero"
      />
      {form.genero === 'Femenino' && (
        <>
          <OpcionesChips
            label="¿Estás embarazada?"
            opciones={[{ id: 'si', etiqueta: 'Sí' }, { id: 'no', etiqueta: 'No' }]}
            seleccionado={form.embarazada ? 'si' : 'no'}
            onSelect={(id) => cambiar('embarazada', id === 'si')}
            testIDPrefix="registro-paciente-embarazada"
          />
          {form.embarazada && (
            <InputField
              label="Semanas de embarazo"
              value={form.semanas}
              onChangeText={(v) => cambiar('semanas', v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={2}
              error={errors.semanas}
              testID="registro-paciente-semanas"
            />
          )}
        </>
      )}
      <InputField
        label="Peso (kg)"
        placeholder="72.5"
        value={form.peso}
        onChangeText={(v) => cambiar('peso', v)}
        keyboardType="decimal-pad"
        error={errors.peso}
        testID="registro-paciente-peso"
      />
      <InputField
        label="Altura (cm)"
        placeholder="165"
        helperText="Escríbela en centímetros."
        value={form.altura}
        onChangeText={(v) => cambiar('altura', v)}
        keyboardType="decimal-pad"
        error={errors.altura}
        testID="registro-paciente-altura"
      />

      <Text style={styles.section}>Datos clínicos</Text>
      <OpcionesChips
        label="Médico"
        opciones={chips(catalogos.medicos)}
        seleccionado={form.idMedico}
        onSelect={(id) => cambiar('idMedico', id as number)}
        error={errors.idMedico}
        testIDPrefix="registro-paciente-medico"
      />
      <OpcionesChips
        label="Nivel de actividad física"
        opciones={chips(catalogos.niveles)}
        seleccionado={form.idActividad}
        onSelect={(id) => cambiar('idActividad', id as number)}
        error={errors.idActividad}
        testIDPrefix="registro-paciente-actividad"
      />
      <OpcionesChips
        label="Afección"
        opciones={chips(catalogos.enfermedades)}
        seleccionado={form.enfermedadId}
        onSelect={(id) => cambiar('enfermedadId', id as number)}
        error={errors.enfermedadId}
        testIDPrefix="registro-paciente-afeccion"
      />
      <OpcionesChips
        label="Tratamiento"
        opciones={chips(catalogos.tratamientos)}
        seleccionado={form.tratamientoId}
        onSelect={(id) => cambiar('tratamientoId', id as number)}
        error={errors.tratamientoId}
        testIDPrefix="registro-paciente-tratamiento"
        ayuda={tratamiento?.detalle}
      />
      <InputField
        label="Dosis"
        placeholder="Ej. 850 mg cada 12 h"
        value={form.dosis}
        onChangeText={(v) => cambiar('dosis', v)}
        leftIcon="pill"
        error={errors.dosis}
        testID="registro-paciente-dosis"
      />

      <Text style={styles.section}>Contacto de emergencia</Text>
      <InputField
        label="Nombre del contacto"
        value={form.nombreEmergencia}
        onChangeText={(v) => cambiar('nombreEmergencia', v)}
        leftIcon="user"
        autoCapitalize="words"
        error={errors.nombreEmergencia}
        testID="registro-paciente-emergencia-nombre"
      />
      <InputField
        label="Teléfono del contacto"
        value={form.numeroEmergencia}
        onChangeText={(v) => cambiar('numeroEmergencia', v.replace(/\D/g, ''))}
        leftIcon="phone"
        keyboardType="number-pad"
        maxLength={8}
        error={errors.numeroEmergencia}
        testID="registro-paciente-emergencia-numero"
      />

      <Text style={styles.section}>Foto de perfil</Text>
      <View style={styles.fotoRow}>
        <TouchableOpacity style={styles.fotoCircle} onPress={elegirFoto} activeOpacity={0.8} testID="registro-paciente-foto"
          accessibilityRole="button"
          accessibilityLabel="Elegir foto de perfil">
          {form.foto ? (
            <Image source={{ uri: form.foto.uri }} style={styles.fotoImg} />
          ) : (
            <Icon name="user" size={32} color={COLORS.textSecondary} />
          )}
        </TouchableOpacity>
        <View style={styles.fotoInfo}>
          <CustomButton
            title={form.foto ? 'Cambiar foto' : 'Elegir foto'}
            onPress={elegirFoto}
            variant="secondary"
            size="sm"
            style={styles.fotoBtn}
            testID="registro-paciente-foto-elegir"
          />
          <Text style={styles.fotoNota}>Obligatoria. JPG o PNG.</Text>
        </View>
      </View>
      {errors.foto ? (
        <Text style={styles.errorTexto} testID="registro-paciente-foto-error">{errors.foto}</Text>
      ) : null}

      {errorEnvio ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTexto} testID="registro-paciente-error">{errorEnvio}</Text>
        </View>
      ) : null}

      <CustomButton
        title="Enviar solicitud"
        onPress={handleEnviar}
        iconLeft="send"
        loading={enviando}
        style={styles.submitBtn}
        testID="registro-paciente-enviar"
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
  fotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  fotoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fotoImg: {
    width: 90,
    height: 90,
  },
  fotoInfo: {
    flex: 1,
    gap: 6,
    alignItems: 'flex-start',
  },
  fotoBtn: {
    width: 'auto',
    minWidth: 120,
  },
  fotoNota: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
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
  },
  submitBtn: {
    marginTop: 16,
  },
});
