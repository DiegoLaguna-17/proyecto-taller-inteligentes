// Fase Móvil 2: config, 404 de ruta vs recurso, registro de desarrollo, perfil, edición, registro de paciente y resúmenes de Inicio.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test/api/'; // con el sufijo /api y barra final a propósito
process.env.EXPO_PUBLIC_NLP_URL = 'http://nlp.test';
delete process.env.EXPO_PUBLIC_USE_MOCK;

const { normalizarBase, API_BASE_URL } = await import('./config.ts');
const { solicitar, ErrorApi, MENSAJES } = await import('./http.ts');
const P = await import('./paciente.ts');
const E = await import('./edicionPaciente.ts');
const R = await import('./registroPaciente.ts');
const C = await import('./catalogos.ts');
const H = await import('./historial.ts');
const V = await import('./validaciones.ts');

type Llamada = { url: string; metodo: string; cuerpo: unknown };
const original = globalThis.fetch;
const llamadas: Llamada[] = [];
function simular(f: (l: Llamada) => Response) {
  llamadas.length = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const cuerpo = init?.body instanceof FormData ? init.body : init?.body ? JSON.parse(String(init.body)) : undefined;
    const l = { url, metodo: init?.method ?? 'GET', cuerpo };
    llamadas.push(l);
    return f(l);
  }) as unknown as typeof fetch;
}
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
test.afterEach(() => { globalThis.fetch = original; delete (globalThis as { __DEV__?: boolean }).__DEV__; });

// ------------------------------------------------------------ config
test('config: quita el sufijo /api y las barras finales de la URL base', () => {
  assert.equal(normalizarBase('http://h:8000/api'), 'http://h:8000');
  assert.equal(normalizarBase('http://h:8000/api/'), 'http://h:8000');
  assert.equal(normalizarBase('  http://h:8000/API  '), 'http://h:8000');
  assert.equal(normalizarBase('http://h:8000///'), 'http://h:8000');
  assert.equal(normalizarBase('http://h:8000'), 'http://h:8000');
  assert.equal(normalizarBase('http://h:8000/apix'), 'http://h:8000/apix'); // solo el sufijo exacto
  assert.equal(normalizarBase(undefined), '');
  assert.equal(normalizarBase(''), '');
  assert.equal(API_BASE_URL, 'http://api.test'); // la variable de este archivo terminaba en /api/
});

// ------------------------------------------------------------ 404 y registro de desarrollo
test('404 de ruta inexistente (FastAPI) -> error de configuración, sin detalles técnicos', async () => {
  simular(() => json({ detail: 'Not Found' }, 404));
  await assert.rejects(
    solicitar({ base: 'http://srv', ruta: '/api/api/login', mensajes: { 404: 'No se encontró tu perfil.' } }),
    (e: InstanceType<typeof ErrorApi>) =>
      e.codigo === 'ruta' && e.estado === 404 && e.message === MENSAJES.ruta && !/api\/api|login|Not Found/.test(e.message),
  );
});

test('404 de recurso: usa el mensaje propio, {message} o {error} del backend, o el genérico', async () => {
  simular(() => json({ message: 'No se encontró el paciente solicitado' }, 404));
  await assert.rejects(solicitar({ base: 'http://srv', ruta: '/x' }), (e: InstanceType<typeof ErrorApi>) => e.codigo === 'http' && /paciente solicitado/.test(e.message));
  simular(() => json({ error: 'Paciente no encontrado' }, 404));
  await assert.rejects(solicitar({ base: 'http://srv', ruta: '/x' }), (e: InstanceType<typeof ErrorApi>) => e.message === 'Paciente no encontrado');
  simular(() => json({ message: 'x' }, 404));
  await assert.rejects(solicitar({ base: 'http://srv', ruta: '/x', mensajes: { 404: 'Propio.' } }), (e: InstanceType<typeof ErrorApi>) => e.message === 'Propio.');
  simular(() => new Response('', { status: 404 }));
  await assert.rejects(solicitar({ base: 'http://srv', ruta: '/x' }), (e: InstanceType<typeof ErrorApi>) => e.message === MENSAJES.noEncontrado);
});

test('registro de desarrollo: solo método, ruta, estado y ms; nunca cuerpos ni contraseñas', async () => {
  const lineas: string[] = [];
  const log = console.log;
  console.log = (...a: unknown[]) => lineas.push(a.join(' '));
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  try {
    simular(() => json({ ok: true }));
    await solicitar({ base: 'http://srv', ruta: '/api/login', metodo: 'POST', cuerpo: { correo: 'a@b.c', contrasena: 'SECRETO', codigo: '123456' } });
    simular(() => json({ error: 'x', detail: 'SECRETO a@b.c' }, 401));
    await assert.rejects(solicitar({ base: 'http://srv', ruta: '/api/verify-otp', metodo: 'POST', cuerpo: { codigo: '123456' } }));
  } finally {
    console.log = log;
  }
  assert.equal(lineas.length, 2);
  assert.match(lineas[0], /^\[http\] POST \/api\/login -> 200 \(\d+ ms\)$/);
  assert.match(lineas[1], /^\[http\] POST \/api\/verify-otp -> 401 \(\d+ ms\)$/);
  assert.ok(!lineas.join('\n').match(/SECRETO|a@b\.c|123456|srv/));
});

test('sin __DEV__ (producción) no se registra nada', async () => {
  const lineas: string[] = [];
  const log = console.log;
  console.log = (...a: unknown[]) => lineas.push(a.join(' '));
  try {
    simular(() => json({}));
    await solicitar({ base: 'http://srv', ruta: '/x' });
  } finally {
    console.log = log;
  }
  assert.equal(lineas.length, 0);
});

test('multipart: FormData sin Content-Type propio (fetch pone el boundary)', async () => {
  let cabeceras: Record<string, string> = {};
  globalThis.fetch = (async (_u: string, init?: RequestInit) => {
    cabeceras = init?.headers as Record<string, string>;
    return json({});
  }) as unknown as typeof fetch;
  const fd = new FormData();
  fd.append('a', '1');
  await solicitar({ base: 'http://srv', ruta: '/x', metodo: 'POST', cuerpo: fd });
  assert.equal(cabeceras['Content-Type'], undefined);
  assert.equal(cabeceras.Accept, 'application/json');
});

// ------------------------------------------------------------ perfil
const perfilBackend = {
  nombre: 'Ana Pérez', id: '7', fechaNac: '15/03/1990', genero: 'Femenino', altura: 1.65, peso: 60.5, telefono: '70000000',
  correo: 'ana@x.test', nombre_emergencia: 'Luis', numero_emergencia: '71111111', foto_perfil: 'https://cdn.test/f.jpg',
  nombre_medico: 'Dra. Silva', fecha_registro: '2026-01-01', admitidoPor: 'Admin', actividadFisica: { nivel: 'Moderada', descripcion: 'Moderada' },
  afecciones: ['Diabetes Tipo 2'], tratamientos: [{ titulo: 'Metformina', descripcion: 'd', dosis: '850' }], embarazo: false,
  semanas_embarazo: null, registro_embarazo: null,
};

test('obtenerPerfil: ruta con el id_paciente y normalización del contrato real', async () => {
  simular(() => json(perfilBackend));
  const p = await P.obtenerPerfil(3);
  assert.equal(llamadas[0].url, 'http://api.test/api/pacientes/perfil/3');
  assert.equal(llamadas[0].metodo, 'GET');
  assert.deepEqual(p, {
    nombre: 'Ana Pérez', idUsuario: 7, fechaNac: '15/03/1990', genero: 'Femenino', altura: '1.65', peso: '60.5', telefono: '70000000',
    correo: 'ana@x.test', nombreEmergencia: 'Luis', numeroEmergencia: '71111111', fotoPerfil: 'https://cdn.test/f.jpg',
    nombreMedico: 'Dra. Silva', nivelActividad: 'Moderada', afecciones: ['Diabetes Tipo 2'],
    tratamientos: [{ titulo: 'Metformina', descripcion: 'd', dosis: '850' }], embarazo: false,
  });
});

test('obtenerPerfil: campos ausentes no rompen; 404 {message}; 500 sin filtrar el texto', async () => {
  simular(() => json({ nombre: 'Solo Nombre' }));
  const p = await P.obtenerPerfil(1);
  assert.equal(p.idUsuario, null);
  assert.deepEqual(p.afecciones, []);
  assert.equal(p.fotoPerfil, null);
  simular(() => json({ message: 'No se encontró el paciente solicitado' }, 404));
  await assert.rejects(P.obtenerPerfil(99), (e: InstanceType<typeof ErrorApi>) => e.message === 'No se encontró tu perfil de paciente.');
  simular(() => json({ error: 'Error interno del servidor', code: 'INTERNAL_SERVER_ERROR' }, 500));
  await assert.rejects(P.obtenerPerfil(1), (e: InstanceType<typeof ErrorApi>) => e.message === MENSAJES.servidor);
});

test('obtenerSemanasEmbarazo: semanas_actuales numérico o null', async () => {
  simular(() => json({ semanas_actuales: 22 }));
  assert.equal(await P.obtenerSemanasEmbarazo(3), 22);
  assert.equal(llamadas[0].url, 'http://api.test/api/pacientes/obtenerDatosEmbarazo/3');
  simular(() => json({ semanas_actuales: null }));
  assert.equal(await P.obtenerSemanasEmbarazo(3), null);
});

// ------------------------------------------------------------ edición
const perfil = P.normalizarPerfil(perfilBackend);
const hoy = new Date(2026, 9, 27);

test('edición: formulario inicial desde el perfil y validaciones', () => {
  const f = E.formDesdePerfil(perfil, hoy);
  assert.equal(f.nombre, 'Ana Pérez');
  assert.equal(f.fechaTerminacion, '2026-10-27');
  assert.deepEqual(E.validarEdicion(f, perfil, hoy), {});
  const mal = { ...f, nombre: 'ab', correo: 'x', telefono: '123', altura: '0', peso: 'abc', nombreEmergencia: ' ', numeroEmergencia: '1' };
  assert.deepEqual(Object.keys(E.validarEdicion(mal, perfil, hoy)).sort(),
    ['altura', 'correo', 'nombre', 'nombreEmergencia', 'numeroEmergencia', 'peso', 'telefono']);
});

test('edición: sin cambios no hay nada que guardar', () => {
  assert.equal(E.hayCambios(E.formDesdePerfil(perfil, hoy), perfil), false);
  assert.equal(E.hayCambios({ ...E.formDesdePerfil(perfil, hoy), telefono: '70000001' }, perfil), true);
});

test('PUT actualizarPaciente: cuerpo exacto con los siete campos requeridos; sin embarazo si no cambió', async () => {
  simular(() => json({ usuario: {}, paciente: {} }));
  const f = { ...E.formDesdePerfil(perfil, hoy), telefono: '70000001', peso: '61,5' };
  await P.actualizarPaciente(7, E.construirActualizacion(f, perfil));
  assert.equal(llamadas[0].url, 'http://api.test/api/pacientes/actualizarPaciente/7');
  assert.equal(llamadas[0].metodo, 'PUT');
  assert.deepEqual(llamadas[0].cuerpo, {
    nombre: 'Ana Pérez', altura: '1.65', peso: '61.5', telefono: '70000001', correo: 'ana@x.test',
    nombre_emergencia: 'Luis', numero_emergencia: '71111111',
  });
});

test('embarazo: empieza -> embarazo y semanas; termina -> embarazo=false y fecha; sin cambio -> nada', () => {
  const f = E.formDesdePerfil(perfil, hoy);
  const empieza = { ...f, embarazo: true, semanas: '12' };
  assert.deepEqual(Object.keys(E.validarEdicion({ ...f, embarazo: true, semanas: '' }, perfil, hoy)), ['semanas']);
  assert.deepEqual(Object.keys(E.validarEdicion({ ...f, embarazo: true, semanas: '43' }, perfil, hoy)), ['semanas']);
  const c1 = E.construirActualizacion(empieza, perfil);
  assert.equal(c1.embarazo, true);
  assert.equal(c1.semanas_embarazo, 12);
  assert.equal(c1.fecha_terminacion, undefined);

  const embarazada = { ...perfil, embarazo: true };
  const termina = { ...E.formDesdePerfil(embarazada, hoy), embarazo: false, fechaTerminacion: '2026-10-20' };
  const c2 = E.construirActualizacion(termina, embarazada);
  assert.equal(c2.embarazo, false);
  assert.equal(c2.fecha_terminacion, '2026-10-20');
  assert.equal(c2.semanas_embarazo, undefined);
  assert.ok('fechaTerminacion' in E.validarEdicion({ ...termina, fechaTerminacion: '2026-13-40' }, embarazada, hoy));
  assert.ok('fechaTerminacion' in E.validarEdicion({ ...termina, fechaTerminacion: '2026-12-01' }, embarazada, hoy)); // futura

  // sigue embarazada y no cambia el estado: no se envía nada de embarazo (evita duplicar seguimientos)
  const sigue = E.construirActualizacion(E.formDesdePerfil(embarazada, hoy), embarazada);
  assert.deepEqual(Object.keys(sigue).sort(), ['altura', 'correo', 'nombre', 'nombre_emergencia', 'numero_emergencia', 'peso', 'telefono']);
});

test('PUT: 400, 404 y 500 sin filtrar details', async () => {
  const cuerpo = E.construirActualizacion(E.formDesdePerfil(perfil, hoy), perfil);
  simular(() => json({ error: 'Faltan datos obligatorios' }, 400));
  await assert.rejects(P.actualizarPaciente(7, cuerpo), (e: InstanceType<typeof ErrorApi>) => /Faltan datos/.test(e.message));
  simular(() => json({ error: 'Paciente no encontrado' }, 404));
  await assert.rejects(P.actualizarPaciente(7, cuerpo), (e: InstanceType<typeof ErrorApi>) => e.message === 'No se encontró tu cuenta de paciente.');
  simular(() => json({ error: 'Error al actualizar paciente', details: 'duplicate key value violates unique constraint "usuario_correo_key"' }, 500));
  await assert.rejects(P.actualizarPaciente(7, cuerpo), (e: InstanceType<typeof ErrorApi>) => e.message === MENSAJES.servidor && !/duplicate|usuario_correo/.test(e.message));
});

// ------------------------------------------------------------ registro de paciente
const foto = { uri: 'file:///tmp/perfil.jpg', nombre: 'perfil.jpg', tipo: 'image/jpeg' };
const completa: import('./registroPaciente.ts').SolicitudPaciente = {
  nombreCompleto: 'Carlos Ruiz', correo: 'carlos@x.test', contrasena: 'clave-larga-1', fechaNac: '1990-05-23', telefono: '70000000',
  genero: 'Masculino', embarazada: false, semanas: '', peso: '72,5', altura: '165', idMedico: 2, idActividad: 1, enfermedadId: 3,
  tratamientoId: 4, dosis: '850 mg', nombreEmergencia: 'María', numeroEmergencia: '71111111', foto,
};

test('registro de paciente: solicitud completa es válida; vacía marca todos los obligatorios, incluida la foto', () => {
  assert.deepEqual(R.validarSolicitudPaciente(completa, hoy), {});
  const errores = R.validarSolicitudPaciente(R.SOLICITUD_VACIA, hoy);
  assert.deepEqual(Object.keys(errores).sort(), [
    'altura', 'contrasena', 'correo', 'dosis', 'enfermedadId', 'fechaNac', 'foto', 'genero', 'idActividad', 'idMedico',
    'nombreCompleto', 'nombreEmergencia', 'numeroEmergencia', 'peso', 'telefono', 'tratamientoId',
  ]);
  assert.match(errores.foto, /obligatoria/);
});

test('registro de paciente: reglas de campos (fecha, teléfono, contraseña, semanas)', () => {
  const e = R.validarSolicitudPaciente({ ...completa, fechaNac: '2999-01-01', telefono: '1234567890', contrasena: '1234567' }, hoy);
  assert.deepEqual(Object.keys(e).sort(), ['contrasena', 'fechaNac', 'telefono']);
  assert.ok('fechaNac' in R.validarSolicitudPaciente({ ...completa, fechaNac: '1990-02-31' }, hoy));
  assert.ok('fechaNac' in R.validarSolicitudPaciente({ ...completa, fechaNac: '23/05/1990' }, hoy));
  assert.ok('semanas' in R.validarSolicitudPaciente({ ...completa, genero: 'Femenino', embarazada: true, semanas: '' }, hoy));
  assert.deepEqual(R.validarSolicitudPaciente({ ...completa, genero: 'Femenino', embarazada: true, semanas: '20' }, hoy), {});
  // un hombre con "embarazada" activado por error no exige semanas
  assert.deepEqual(R.validarSolicitudPaciente({ ...completa, embarazada: true, semanas: '' }, hoy), {});
});

test('multipart: nombres exactos del backend, booleanos como texto, rol fijo y sin contraseña en otros campos', () => {
  const campos = Object.fromEntries(R.camposSolicitud(completa));
  assert.deepEqual(campos, {
    nombre_completo: 'Carlos Ruiz', correo: 'carlos@x.test', contrasena: 'clave-larga-1', rol: 'paciente', fecha_nac: '1990-05-23',
    telefono: '70000000', id_medico: '2', id_actividad: '1', genero: 'Masculino', peso: '72.5', altura: '1.65', enfermedad_id: '3',
    tratamiento_id: '4', dosis_: '850 mg', nombre_emergencia: 'María', numero_emergencia: '71111111', embarazada: 'false',
  });
  const emb = Object.fromEntries(R.camposSolicitud({ ...completa, genero: 'Femenino', embarazada: true, semanas: '20' }));
  assert.equal(emb.embarazada, 'true');
  assert.equal(emb.semanas, '20');
  assert.equal(Object.fromEntries(R.camposSolicitud({ ...completa, embarazada: true, semanas: '9' })).embarazada, 'false'); // solo mujeres
  const fd = R.construirFormData(completa);
  assert.equal(fd.get('rol'), 'paciente');
  assert.ok(fd.has('foto_perfil'));
});

test('POST registrarPaciente: multipart a la ruta correcta; 400 y 500 con mensajes seguros', async () => {
  simular(() => json({ message: 'Usuario y paciente registrados correctamente' }));
  await R.enviarSolicitudPaciente(completa);
  assert.equal(llamadas[0].url, 'http://api.test/api/pacientes/registrarPaciente');
  assert.equal(llamadas[0].metodo, 'POST');
  assert.ok(llamadas[0].cuerpo instanceof FormData);
  simular(() => json({ error: 'Archivo de perfil faltante' }, 400));
  await assert.rejects(R.enviarSolicitudPaciente(completa), (e: InstanceType<typeof ErrorApi>) => /foto/.test(e.message));
  simular(() => json({ error: 'duplicate key value violates unique constraint "usuario_correo_key"' }, 500));
  await assert.rejects(R.enviarSolicitudPaciente(completa), (e: InstanceType<typeof ErrorApi>) => e.message === MENSAJES.servidor && !/duplicate/.test(e.message));
});

// ------------------------------------------------------------ catálogos (formas reales)
test('catálogos: normalizan las formas reales del backend', async () => {
  simular((l) => {
    if (l.url.endsWith('/niveles')) return json([{ id_nivel_actividad: 1, descripcion: 'Baja' }]);
    if (l.url.endsWith('/enfermedades')) return json([{ id_enfermedad: 2, nombre_enfermedad: 'Diabetes Tipo 2' }]);
    if (l.url.endsWith('/tratamientos')) return json([{ id_tratamiento: 3, nombre_tratamiento: 'Metformina', descripcion: 'Oral' }]);
    return json([{ id_medico: 4, usuario: { nombre_completo: 'Dra. Silva' } }, { id_medico: 5, usuario: null }, { sin_id: true }]);
  });
  assert.deepEqual(await C.obtenerNiveles(), [{ id: 1, etiqueta: 'Baja' }]);
  assert.deepEqual(await C.obtenerEnfermedades(), [{ id: 2, etiqueta: 'Diabetes Tipo 2' }]);
  assert.deepEqual(await C.obtenerTratamientos(), [{ id: 3, etiqueta: 'Metformina', detalle: 'Oral' }]);
  assert.deepEqual(await C.obtenerMedicos(), [{ id: 4, etiqueta: 'Dra. Silva' }, { id: 5, etiqueta: 'Médico sin nombre' }]);
  assert.deepEqual(llamadas.map((l) => l.url.replace('http://api.test', '')),
    ['/api/general/niveles', '/api/general/enfermedades', '/api/general/tratamientos', '/api/medicos/ver']);
});

// ------------------------------------------------------------ validaciones y resúmenes de Inicio
test('validaciones básicas', () => {
  assert.ok(V.esTelefono('7000000') && V.esTelefono('70000000') && !V.esTelefono('700000') && !V.esTelefono('700000000') && !V.esTelefono('7000a000'));
  assert.ok(V.esNumeroPositivo('72,5', 500) && V.esNumeroPositivo('165', 999) && !V.esNumeroPositivo('0', 500) && !V.esNumeroPositivo('501', 500) && !V.esNumeroPositivo('1.234', 500));
  assert.ok(V.esFechaIso('2024-02-29') && !V.esFechaIso('2023-02-29'));
  assert.ok(V.esCorreo('a@b.co') && !V.esCorreo('a@b') && !V.esCorreo('a b@c.d'));
});

const reg = (id: number, fecha: string, hora: string, v: number, m = 'AYUNAS', alerta: string | null = null) =>
  ({ id, fecha, hora, nivelGlucosa: v, momentoDia: m, observaciones: null, tipo_alerta: alerta });
const ahora = new Date(2026, 9, 27, 14, 0);

test('Inicio: resumen con lecturas reales (hoy, anteriores, promedio, fuera de rango en 3 días)', () => {
  const datos = [
    reg(5, '2026-10-27', '12:30', 130, 'DESPUES DE COMER'),
    reg(4, '2026-10-27', '08:00', 100),
    reg(3, '2026-10-26', '23:15', 60, 'ANTES DE DORMIR', 'hipoglucemia'),
    reg(2, '2026-10-25', '09:00', 200, 'AYUNAS', 'hiperglucemia'),
    reg(1, '2026-10-20', '09:00', 99),
  ];
  const r = H.resumenInicio(datos, ahora);
  assert.equal(r.ultima?.id, 5);
  assert.deepEqual(r.anteriores.map((x) => x.id), [4, 3]);
  assert.equal(r.deHoy.length, 2);
  assert.equal(r.promedioHoy, 115);
  assert.equal(r.enRangoHoy, true);
  assert.equal(r.fueraDeRango3d, 2); // 26-oct (hipo) y 25-oct (hiper); la del 20 queda fuera
  const fuera = H.resumenInicio([reg(1, '2026-10-27', '08:00', 190)], ahora); // 190 > 180: fuera del rango meta
  assert.equal(fuera.enRangoHoy, false);
});

test('Inicio: sin lecturas, sin tomas hoy, lecturas sin valor y fechas futuras', () => {
  const vacio = H.resumenInicio([], ahora);
  assert.deepEqual([vacio.ultima, vacio.anteriores, vacio.deHoy, vacio.promedioHoy, vacio.enRangoHoy, vacio.fueraDeRango3d], [null, [], [], null, null, 0]);
  const r = H.resumenInicio([{ ...reg(9, '2026-10-28', '08:00', 100) }, { ...reg(8, '2026-10-26', '08:00', 100), nivelGlucosa: null }, reg(7, '2026-10-26', '07:00', 90)], ahora);
  assert.equal(r.ultima?.id, 7); // ignora la futura y la lectura sin valor
  assert.equal(r.enRangoHoy, null);
});

test('Inicio: "hace cuánto", etiquetas de fecha y fecha larga', () => {
  assert.equal(H.haceCuanto('2026-10-27', '14:00:00', ahora), 'Hace un momento (14:00)');
  assert.equal(H.haceCuanto('2026-10-27', '13:15:00', ahora), 'Hace 45 min (13:15)');
  assert.equal(H.haceCuanto('2026-10-27', '12:00:00', ahora), 'Hace 2 horas (12:00)');
  assert.equal(H.haceCuanto('2026-10-27', '13:00:00', ahora), 'Hace 1 hora (13:00)');
  assert.equal(H.haceCuanto('2026-10-25', '14:00:00', ahora), 'Hace 2 días (14:00)');
  assert.equal(H.etiquetaFechaHora('2026-10-27', '08:30:00', ahora), 'Hoy, 08:30');
  assert.equal(H.etiquetaFechaHora('2026-10-26', '23:15:00', ahora), 'Ayer, 23:15');
  assert.equal(H.etiquetaFechaHora('2026-10-05', '14:00:00', ahora), '5 Oct, 14:00');
  assert.equal(H.fechaLarga(ahora), 'Martes, 27 de Octubre');
});
