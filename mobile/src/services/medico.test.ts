// Fase Móvil 3: servicios del médico, vistas puras, edición, registro y archivos (sin red real).
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
delete process.env.EXPO_PUBLIC_USE_MOCK;

const M = await import('./medico.ts');
const V = await import('./medicoVista.ts');
const EM = await import('./edicionMedico.ts');
const RM = await import('./registroMedico.ts');
const A = await import('./archivos.ts');
const C = await import('./catalogos.ts');
const { ErrorApi, MENSAJES } = await import('./http.ts');

type Llamada = { url: string; metodo: string; cuerpo: unknown; cabeceras: Record<string, string> };
const original = globalThis.fetch;
const llamadas: Llamada[] = [];
function simular(f: (l: Llamada) => Response) {
  llamadas.length = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const cuerpo = init?.body instanceof FormData ? init.body : init?.body ? JSON.parse(String(init.body)) : undefined;
    const l = { url, metodo: init?.method ?? 'GET', cuerpo, cabeceras: (init?.headers ?? {}) as Record<string, string> };
    llamadas.push(l);
    return f(l);
  }) as unknown as typeof fetch;
}
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });

// XMLHttpRequest simulado (en node no existe): los multipart deben ir por aquí
const xhrs: { metodo: string; url: string; cabeceras: Record<string, string>; cuerpo: unknown }[] = [];
let respuestaXhr = { status: 200, texto: '{}' };
class XhrFalso {
  status = 0; responseText = ''; timeout = 0;
  onload: (() => void) | null = null; onerror: (() => void) | null = null; ontimeout: (() => void) | null = null;
  private m = ''; private u = ''; private h: Record<string, string> = {};
  open(m: string, u: string) { this.m = m; this.u = u; }
  setRequestHeader(k: string, v: string) { this.h[k] = v; }
  getResponseHeader() { return null; }
  send(c: unknown) {
    xhrs.push({ metodo: this.m, url: this.u, cabeceras: this.h, cuerpo: c });
    queueMicrotask(() => { this.status = respuestaXhr.status; this.responseText = respuestaXhr.texto; this.onload?.(); });
  }
}
test.beforeEach(() => { xhrs.length = 0; respuestaXhr = { status: 200, texto: '{}' }; });
test.afterEach(() => {
  globalThis.fetch = original;
  delete (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
});

// ------------------------------------------------------------ perfil
test('perfil del médico: ruta con el id_usuario, relleno del backend como vacío, URLs de matrícula y carnet', async () => {
  simular(() => json({
    id: 4, nombre: 'Dra. Ana Rojas', fechaNac: '10/05/1985', telefono: 'No registrado', correo: 'ana@x.test', matricula: 'N/A',
    carnet: 'https://cdn.test/carnet.jpg', especialidad: 'Sin especialidad', departamento: 'La Paz', admitidoPor: 'Sistema',
  }));
  const p = await M.obtenerPerfilMedico(9);
  assert.equal(llamadas[0].url, 'http://api.test/api/medicos/perfil/9');
  assert.deepEqual(p, {
    idMedico: 4, nombre: 'Dra. Ana Rojas', fechaNac: '10/05/1985', telefono: null, correo: 'ana@x.test', matriculaUrl: null,
    carnetUrl: 'https://cdn.test/carnet.jpg', especialidad: null, departamento: 'La Paz',
  });
});

test('perfil del médico: 404 {message} y 500 sin filtrar', async () => {
  simular(() => json({ message: 'No se encontró el médico' }, 404));
  await assert.rejects(M.obtenerPerfilMedico(1), (e: InstanceType<typeof ErrorApi>) => e.message === 'No se encontró tu perfil de médico.');
  simular(() => json({ error: 'Error interno del servidor', code: 'INTERNAL_SERVER_ERROR' }, 500));
  await assert.rejects(M.obtenerPerfilMedico(1), (e: InstanceType<typeof ErrorApi>) => e.message === MENSAJES.servidor);
});

// ------------------------------------------------------------ pacientes
const pacientesBackend = [
  { id: 11, nombre: 'Luis Paz', ci: 'luis@x.test', fechaNac: '02/11/1976', genero: 'Masculino', peso: '80.5', altura: '1.76', actividadFisica: 'MODERADO',
    telefono: '71234567', correo: 'luis@x.test', nombre_emergencia: 'Rosa', numero_emergencia: '72345678', foto_perfil: 'https://cdn.test/l.jpg',
    afecciones: [{ afeccion: 'Diabetes Tipo 2' }], tratamientos: [{ titulo: 'Metformina', desc: 'Oral', dosis: '850' }] },
  { id: 12, nombre: 'Sin Datos', fechaNac: null, telefono: 'No registrado', afecciones: [], tratamientos: [] },
];

test('misPacientes: ruta con el id_medico y normalización (altura en metros se conserva como texto)', async () => {
  simular(() => json(pacientesBackend));
  const r = await M.obtenerPacientesMedico(3);
  assert.equal(llamadas[0].url, 'http://api.test/api/medicos/misPacientes/3');
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].afecciones, ['Diabetes Tipo 2']);
  assert.deepEqual(r[0].tratamientos, [{ titulo: 'Metformina', descripcion: 'Oral', dosis: '850' }]);
  assert.equal(r[0].altura, '1.76');
  assert.equal(r[0].peso, '80.5');
  assert.equal(r[1].telefono, null);
  assert.equal(r[1].fechaNac, null);
});

test('misPacientes: respuesta que no es una lista -> respuesta inesperada', async () => {
  simular(() => json({ algo: 1 }));
  await assert.rejects(M.obtenerPacientesMedico(3), (e: InstanceType<typeof ErrorApi>) => e.codigo === 'respuesta');
});

// ------------------------------------------------------------ alertas
const alertaBackend = (id: number, extra: object = {}) => ({
  id, nivel: 'Hipoglucemia', idpaciente: 11, paciente: 'Luis Paz', fecha: '2026-10-27', hora: '13:10', glucosa: 62, momento: 'AYUNAS', observaciones: 'Mareo', ...extra,
});

test('alertas activas y resueltas: rutas y normalización (la resuelta trae el mensaje)', async () => {
  simular((l) => json(l.url.includes('Resueltas') ? [alertaBackend(2, { nivel: 'Hiperglucemia', glucosa: 215, mensaje: 'Medir de nuevo' })] : [alertaBackend(1)]));
  const a = await M.obtenerAlertasActivas(3);
  const r = await M.obtenerAlertasResueltas(3);
  assert.deepEqual(llamadas.map((l) => l.url.replace('http://api.test', '')), ['/api/medicos/alertasActivas/3', '/api/medicos/alertasResueltas/3']);
  assert.deepEqual(a[0], { id: 1, nivel: 'Hipoglucemia', idPaciente: 11, paciente: 'Luis Paz', fecha: '2026-10-27', hora: '13:10', glucosa: 62, momento: 'AYUNAS', observaciones: 'Mareo', mensaje: '' });
  assert.equal(r[0].mensaje, 'Medir de nuevo');
});

test('responder alerta: cuerpo exacto (enteros, fecha local, mensaje recortado) en la ruta correcta', async () => {
  simular(() => json({ message: 'Alerta respondida y actualizada correctamente' }));
  await M.responderAlerta({ idMedico: 3, idAlerta: 25, mensaje: '  Medir de nuevo en 2 horas.  ', hoy: new Date(2026, 9, 28, 23, 59) });
  assert.equal(llamadas[0].url, 'http://api.test/api/medicos/responder/alerta');
  assert.equal(llamadas[0].metodo, 'POST');
  assert.deepEqual(llamadas[0].cuerpo, { id_medico: 3, fecha_registro: '2026-10-28', mensaje: 'Medir de nuevo en 2 horas.', alertas_id_alerta: 25 });
  assert.equal(typeof (llamadas[0].cuerpo as { id_medico: unknown }).id_medico, 'number');
});

test('responder alerta: 400, 404 y 500 con mensajes seguros', async () => {
  const llamar = () => M.responderAlerta({ idMedico: 3, idAlerta: 25, mensaje: 'ok' });
  simular(() => json({ error: 'Todos los campos son requeridos' }, 400));
  await assert.rejects(llamar(), (e: InstanceType<typeof ErrorApi>) => /Faltan datos/.test(e.message));
  simular(() => json({ error: 'insert or update on table "retroalimentacion" violates foreign key constraint', detalle: 'Luis Paz' }, 500));
  await assert.rejects(llamar(), (e: InstanceType<typeof ErrorApi>) => e.message === MENSAJES.servidor && !/retroalimentacion|Luis/.test(e.message));
});

test('respuesta del médico: de 3 a 500 caracteres', () => {
  assert.ok(M.validarRespuesta('') !== null);
  assert.ok(M.validarRespuesta('  ab ') !== null);
  assert.equal(M.validarRespuesta('abc'), null);
  assert.equal(M.validarRespuesta('x'.repeat(500)), null);
  assert.match(M.validarRespuesta('x'.repeat(501)) ?? '', /500/);
});

// ------------------------------------------------------------ vistas puras
const pacs = M.normalizarPacientes([
  { id: 1, nombre: 'Ana Gómez', fechaNac: '15/03/1980' }, { id: 2, nombre: 'Beto Ruiz' }, { id: 30, nombre: 'Carla Díaz' },
]);
const alertas = M.normalizarAlertas([
  alertaBackend(1, { idpaciente: 1, fecha: '2026-10-26', hora: '10:00', nivel: 'Hiperglucemia', glucosa: 200 }),
  alertaBackend(2, { idpaciente: 1, fecha: '2026-10-27', hora: '09:00', glucosa: 60 }),
  alertaBackend(3, { idpaciente: 30, fecha: '2026-10-27', hora: '08:00', nivel: 'Otro', glucosa: 150 }),
]);

test('estado de pacientes por alertas activas: la más reciente manda', () => {
  const e = V.estadoPacientes(pacs, alertas);
  assert.equal(e[0].alertasActivas, 2);
  assert.equal(e[0].alerta?.id, 2); // 27-oct 09:00 es más reciente que 26-oct 10:00
  assert.equal(e[1].alerta, null);
  assert.equal(e[2].alerta?.id, 3);
  assert.deepEqual(V.resumenPacientes(e), { total: 3, enRiesgo: 2, estables: 1 });
});

test('filtros y búsqueda de pacientes (por nombre o id)', () => {
  const e = V.estadoPacientes(pacs, alertas);
  assert.deepEqual(V.filtrarPacientes(e, '', 'riesgo').map((x) => x.paciente.id), [1, 30]);
  assert.deepEqual(V.filtrarPacientes(e, '', 'estables').map((x) => x.paciente.id), [2]);
  assert.deepEqual(V.filtrarPacientes(e, 'ruiz', 'todos').map((x) => x.paciente.id), [2]);
  assert.deepEqual(V.filtrarPacientes(e, '30', 'todos').map((x) => x.paciente.id), [30]);
  assert.deepEqual(V.filtrarPacientes(e, 'zzz', 'todos'), []);
});

test('clasificación de la alerta por el texto del tipo o, si no se reconoce, por el valor', () => {
  assert.equal(V.clasificacionDeAlerta({ nivel: 'Hipoglucemia', glucosa: 200 }), 'Riesgo Hipo');
  assert.equal(V.clasificacionDeAlerta({ nivel: 'HIPERGLUCEMIA', glucosa: 50 }), 'Riesgo Hiper');
  assert.equal(V.clasificacionDeAlerta({ nivel: 'Otro', glucosa: 60 }), 'Riesgo Hipo');
  assert.equal(V.clasificacionDeAlerta({ nivel: '', glucosa: null }), 'Riesgo Hiper');
  assert.deepEqual(V.filtrarAlertas(alertas, 'hipo').map((a) => a.id), [2]);
  assert.deepEqual(V.filtrarAlertas(alertas, 'hiper').map((a) => a.id), [1, 3]); // la 3 no trae un tipo reconocible y 150 no es < 70
  assert.equal(V.filtrarAlertas(alertas, 'todas').length, 3);
});

test('edad desde dd/mm/aaaa e iniciales', () => {
  const hoy = new Date(2026, 9, 28);
  assert.equal(V.edadDesdeFechaNac('28/10/1990', hoy), 36);
  assert.equal(V.edadDesdeFechaNac('29/10/1990', hoy), 35);
  assert.equal(V.edadDesdeFechaNac('15/03/1980', hoy), 46);
  assert.equal(V.edadDesdeFechaNac(null, hoy), null);
  assert.equal(V.edadDesdeFechaNac('1990-10-28', hoy), null);
  assert.equal(V.iniciales('Ana María Gómez'), 'AM');
  assert.equal(V.iniciales('  '), '?');
});

const reg = (id: number, fecha: string, v: number | null) => ({ id, fecha, hora: '10:00', nivelGlucosa: v, momentoDia: 'AYUNAS', observaciones: null, tipo_alerta: null });
const hoy = new Date(2026, 9, 28);

test('métricas del reporte (70-180 incluidos): límites, promedio, hipo/hiper y distribución', () => {
  const datos = [reg(1, '2026-10-28', 69), reg(2, '2026-10-28', 70), reg(3, '2026-10-27', 180), reg(4, '2026-10-27', 181), reg(5, '2026-10-26', 100), reg(6, '2026-10-26', null)];
  const m = V.metricasReporte(datos, hoy, 7);
  assert.equal(m.total, 5);
  assert.equal(m.hipo, 1);
  assert.equal(m.hiper, 1);
  assert.equal(m.tir, 60); // 70, 180 y 100
  assert.equal(m.promedio, 120); // (69+70+180+181+100)/5 = 120
  assert.deepEqual([m.pctBajo, m.pctRango, m.pctAlto], [20, 60, 20]);
});

test('métricas del reporte: rango de 7 y 30 días, y sin lecturas', () => {
  const datos = [reg(1, '2026-10-28', 100), reg(2, '2026-10-22', 100), reg(3, '2026-10-21', 100), reg(4, '2026-09-29', 100), reg(5, '2026-09-28', 100)];
  assert.equal(V.metricasReporte(datos, hoy, 7).total, 2); // 22 a 28 de octubre
  assert.equal(V.metricasReporte(datos, hoy, 30).total, 4); // 29-sep a 28-oct
  const vacio = V.metricasReporte([], hoy, 30);
  assert.deepEqual([vacio.total, vacio.promedio, vacio.tir, vacio.hipo, vacio.hiper], [0, null, null, 0, 0]);
});

// ------------------------------------------------------------ archivos
test('archivos: tipos y límites (PDF ≤ 5 MB, imagen ≤ 2 MB, justo en el límite)', () => {
  const pdf = (bytes?: number) => ({ uri: 'file:///m.pdf', nombre: 'matricula.pdf', tipo: 'application/pdf', bytes });
  const img = (tipo: string, bytes?: number) => ({ uri: 'file:///c.jpg', nombre: 'carnet.jpg', tipo, bytes });
  assert.equal(A.validarArchivo(pdf(5 * A.MB), 'pdf', 'Matrícula'), null);
  assert.match(A.validarArchivo(pdf(5 * A.MB + 1), 'pdf', 'Matrícula') ?? '', /5 MB/);
  assert.match(A.validarArchivo(img('image/jpeg'), 'pdf', 'Matrícula') ?? '', /PDF/);
  assert.equal(A.validarArchivo(img('image/png', 2 * A.MB), 'imagen', 'Carnet'), null);
  assert.match(A.validarArchivo(img('image/jpeg', 2 * A.MB + 1), 'imagen', 'Carnet') ?? '', /2 MB/);
  assert.match(A.validarArchivo(img('image/gif', 100), 'imagen', 'Carnet') ?? '', /JPG o PNG/);
  assert.match(A.validarArchivo(pdf(1), 'imagen', 'Carnet') ?? '', /JPG o PNG/);
  assert.match(A.validarArchivo(null, 'pdf', 'Matrícula') ?? '', /obligatorio/);
  assert.equal(A.validarArchivo(pdf(undefined), 'pdf', 'Matrícula'), null); // sin tamaño informado no se puede comprobar
});

test('archivos: MIME completo y deducido de la extensión', () => {
  assert.equal(A.mimeDeArchivo('image/jpg', 'x.jpg'), 'image/jpeg');
  assert.equal(A.mimeDeArchivo(undefined, 'file:///a/b/carnet.PNG?x=1'), 'image/png');
  assert.equal(A.mimeDeArchivo('', 'doc.pdf'), 'application/pdf');
  assert.equal(A.mimeDeArchivo(null, 'a.heic'), '');
});

// ------------------------------------------------------------ edición del médico
const perfilMedico = M.normalizarPerfilMedico({ id: 4, nombre: 'Ana', telefono: '71234567', correo: 'ana@x.test', departamento: 'La Paz', especialidad: 'Endocrinología' });
const carnetNuevo = { uri: 'file:///c.jpg', nombre: 'carnet.jpg', tipo: 'image/jpeg', bytes: 100000 };

test('edición del médico: solo campos cambiados y no vacíos; sin cambios no hay nada que enviar', () => {
  const f = EM.formDesdePerfilMedico(perfilMedico);
  assert.deepEqual(f, { telefono: '71234567', correo: 'ana@x.test', departamento: 'La Paz', carnet: null });
  assert.equal(EM.hayCambiosMedico(f, perfilMedico), false);
  assert.deepEqual(EM.construirActualizacionMedico({ ...f, telefono: '71234568' }, perfilMedico), { telefono: '71234568' });
  assert.deepEqual(EM.construirActualizacionMedico({ ...f, departamento: 'Cochabamba', correo: 'nueva@x.test' }, perfilMedico), { correo: 'nueva@x.test', departamento: 'Cochabamba' });
  assert.deepEqual(EM.construirActualizacionMedico({ ...f, departamento: '   ' }, perfilMedico), {}); // nunca se envía vacío
  assert.deepEqual(EM.construirActualizacionMedico({ ...f, carnet: carnetNuevo }, perfilMedico), { carnet: carnetNuevo });
});

test('edición del médico: el relleno del backend no se copia al formulario y se valida', () => {
  const sinDatos = M.normalizarPerfilMedico({ id: 4, nombre: 'Ana', telefono: 'No registrado', correo: 'No registrado', departamento: 'N/A' });
  const f = EM.formDesdePerfilMedico(sinDatos);
  assert.deepEqual([f.telefono, f.correo, f.departamento], ['', '', '']);
  assert.deepEqual(Object.keys(EM.validarEdicionMedico(f)).sort(), ['correo', 'departamento', 'telefono']);
  const ok = EM.formDesdePerfilMedico(perfilMedico);
  assert.deepEqual(EM.validarEdicionMedico(ok), {});
  assert.ok('telefono' in EM.validarEdicionMedico({ ...ok, telefono: '7123456' })); // 8 dígitos exactos
  assert.match(EM.validarEdicionMedico({ ...ok, carnet: { ...carnetNuevo, bytes: 3 * A.MB } }).carnet, /2 MB/);
  assert.match(EM.validarEdicionMedico({ ...ok, carnet: { ...carnetNuevo, tipo: 'application/pdf' } }).carnet, /JPG o PNG/);
});

test('PUT actualizar médico: multipart por XMLHttpRequest, sin Content-Type, solo los campos enviados', async () => {
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = XhrFalso;
  globalThis.fetch = (async () => { throw new Error('el multipart no debe usar fetch'); }) as unknown as typeof fetch;
  respuestaXhr = { status: 200, texto: '{"message":"Datos actualizados correctamente"}' };
  await M.actualizarMedico(4, { telefono: '71234568', carnet: carnetNuevo });
  assert.equal(xhrs.length, 1);
  assert.equal(xhrs[0].metodo, 'PUT');
  assert.equal(xhrs[0].url, 'http://api.test/api/medicos/actualizar/4');
  assert.equal(xhrs[0].cabeceras['Content-Type'], undefined);
  const fd = xhrs[0].cuerpo as FormData;
  assert.deepEqual([...fd.keys()].sort(), ['carnet', 'telefono']);
  assert.equal(fd.get('telefono'), '71234568');
  assert.equal(fd.has('correo'), false);
});

test('PUT actualizar médico: 404 {message} y 500 {message, error} sin filtrar', async () => {
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = XhrFalso;
  respuestaXhr = { status: 404, texto: '{"message":"Médico no encontrado"}' };
  await assert.rejects(M.actualizarMedico(4, { telefono: '71234568' }), (e: InstanceType<typeof ErrorApi>) => e.message === 'No se encontró tu cuenta de médico.');
  respuestaXhr = { status: 500, texto: '{"message":"Error al actualizar los datos","error":"duplicate key (correo)=(ana@x.test)"}' };
  await assert.rejects(M.actualizarMedico(4, { correo: 'ana@x.test' }), (e: InstanceType<typeof ErrorApi>) => e.message === MENSAJES.servidor && !/duplicate|ana@/.test(e.message));
});

// ------------------------------------------------------------ solicitud de registro de médico
const matricula = { uri: 'file:///m.pdf', nombre: 'matricula.pdf', tipo: 'application/pdf', bytes: 1 * A.MB };
const solicitud: import('./registroMedico.ts').SolicitudMedico = {
  nombreCompleto: 'Ana Rojas', correo: 'ana.rojas@x.test', contrasena: 'clave-larga-1', fechaNac: '1985-05-10', telefono: '71234567',
  departamento: 'La Paz', idEspecialidad: 3, matricula, carnet: carnetNuevo,
};

test('registro de médico: solicitud completa válida; vacía marca todos los campos y ambos archivos', () => {
  assert.deepEqual(RM.validarSolicitudMedico(solicitud, hoy), {});
  assert.deepEqual(Object.keys(RM.validarSolicitudMedico(RM.SOLICITUD_MEDICO_VACIA, hoy)).sort(),
    ['carnet', 'contrasena', 'correo', 'departamento', 'fechaNac', 'idEspecialidad', 'matricula', 'nombreCompleto', 'telefono']);
});

test('registro de médico: reglas de archivos, fecha, teléfono y contraseña', () => {
  const e = RM.validarSolicitudMedico({ ...solicitud, matricula: { ...matricula, tipo: 'image/jpeg' }, carnet: { ...carnetNuevo, bytes: 3 * A.MB }, fechaNac: '2999-01-01', telefono: '1234567', contrasena: '1234567' }, hoy);
  assert.deepEqual(Object.keys(e).sort(), ['carnet', 'contrasena', 'fechaNac', 'matricula', 'telefono']);
  assert.match(e.matricula, /PDF/);
  assert.match(e.carnet, /2 MB/);
});

test('registro de médico: nombres exactos del multipart, sin estado ni fecha_solicitud', () => {
  assert.deepEqual(Object.fromEntries(RM.camposSolicitudMedico(solicitud)), {
    nombre_completo: 'Ana Rojas', correo: 'ana.rojas@x.test', contrasena: 'clave-larga-1', telefono: '71234567', fecha_nac: '1985-05-10',
    id_especialidad: '3', departamento: 'La Paz',
  });
  const fd = RM.construirFormDataMedicoRegistro(solicitud);
  assert.ok(fd.has('matriculaProfesional') && fd.has('carnetProfesional'));
  assert.equal(fd.has('estado'), false);
  assert.equal(fd.has('fecha_solicitud'), false);
});

test('POST registrar médico: por XMLHttpRequest, sin Content-Type; 400 y 500 con mensajes seguros', async () => {
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = XhrFalso;
  globalThis.fetch = (async () => { throw new Error('el multipart no debe usar fetch'); }) as unknown as typeof fetch;
  await RM.enviarSolicitudMedico(solicitud);
  assert.equal(xhrs[0].metodo, 'POST');
  assert.equal(xhrs[0].url, 'http://api.test/api/medicos/registrar');
  assert.equal(xhrs[0].cabeceras['Content-Type'], undefined);
  respuestaXhr = { status: 400, texto: '{"error":"Archivo de matrícula faltante"}' };
  await assert.rejects(RM.enviarSolicitudMedico(solicitud), (e: InstanceType<typeof ErrorApi>) => /matrícula o el carnet/.test(e.message));
  respuestaXhr = { status: 500, texto: '{"error":"duplicate key value violates unique constraint \\"usuario_correo_key\\" Key (correo)=(ana.rojas@x.test)"}' };
  await assert.rejects(RM.enviarSolicitudMedico(solicitud), (e: InstanceType<typeof ErrorApi>) => e.message === MENSAJES.servidor && !/ana\.rojas|duplicate/.test(e.message));
});

test('especialidades: forma real del backend', async () => {
  simular(() => json([{ id_especialidad: 1, nombre: 'Endocrinología' }, { id_especialidad: 2, nombre: 'Medicina interna' }, { nombre: 'sin id' }]));
  assert.deepEqual(await C.obtenerEspecialidades(), [{ id: 1, etiqueta: 'Endocrinología' }, { id: 2, etiqueta: 'Medicina interna' }]);
  assert.equal(llamadas[0].url, 'http://api.test/api/general/especialidades');
});

// ------------------------------------------------------------ privacidad
test('en desarrollo no se registran nombres, correos ni glucosas de pacientes', async () => {
  simular(() => json(pacientesBackend));
  const lineas: string[] = [];
  const log = console.log;
  console.log = (...a: unknown[]) => lineas.push(a.join(' '));
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  try {
    await M.obtenerPacientesMedico(3);
    simular(() => json([alertaBackend(1)]));
    await M.obtenerAlertasActivas(3);
  } finally {
    console.log = log;
  }
  const todo = lineas.join('\n');
  assert.match(todo, /\[http\] GET \/api\/medicos\/misPacientes\/3 -> 200/);
  assert.ok(!/Luis|luis@|71234567|Rosa|62|Mareo/.test(todo.replace(/\/misPacientes\/3|\/alertasActivas\/3|\(\d+ ms\)/g, '')), todo);
});
