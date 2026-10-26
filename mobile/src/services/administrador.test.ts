// Fase Móvil 4: servicios y vistas del administrador (sin red real).
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
delete process.env.EXPO_PUBLIC_USE_MOCK;

const A = await import('./administrador.ts');
const V = await import('./administradorVista.ts');
const { ErrorApi, MENSAJES } = await import('./http.ts');

type Llamada = { url: string; metodo: string; cuerpo: unknown };
const original = globalThis.fetch;
const llamadas: Llamada[] = [];
function simular(f: (l: Llamada) => Response) {
  llamadas.length = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const l = { url, metodo: init?.method ?? 'GET', cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined };
    llamadas.push(l);
    return f(l);
  }) as unknown as typeof fetch;
}
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
test.afterEach(() => { globalThis.fetch = original; delete (globalThis as { __DEV__?: boolean }).__DEV__; });

// ------------------------------------------------------------ formas reales del backend
const medicoBackend = {
  id: 4, nombre: 'Dra. Ana Rojas', fechaNac: '1985-05-10', telefono: 'No registrado', correo: 'ana@x.test',
  matricula: 'https://cdn.test/matricula.pdf', departamento: 'La Paz', carnet: 'N/A', admitidoPor: 'Sistema',
};
const pacienteBackend = {
  id: 7, nombre: 'Luis Paz', ci: 'luis@x.test', fechaNac: '02/11/1976', genero: 'Masculino', peso: '80.5', altura: '1.76',
  actividadFisica: 'MODERADO', telefono: '71234567', correo: 'No registrado', nombre_emergencia: 'Rosa', numero_emergencia: '72345678',
  medico: 'Dra. Silva', foto_perfil: 'https://cdn.test/l.jpg', afecciones: [{ afeccion: 'Diabetes Tipo 2' }],
  tratamientos: [{ titulo: 'Metformina', desc: 'Oral', dosis: '850' }], admitidoPor: 'Admin Uno', embarazo: false, semanas_embarazo: null,
};
const adminBackend = { id: 3, nombre: 'Mari Rivas', correo: 'mari@x.test', fechaNac: '01/01/1985', telefono: '70000000', cargo: 'Seguridad', fechaIn: '10/10/2024', admitidoPor: 'Sistema' };

test('rutas de las listas del administrador', async () => {
  simular(() => json([]));
  await A.obtenerMedicosSolicitantes();
  await A.obtenerMedicosActivos();
  await A.obtenerPacientesSolicitantes();
  await A.obtenerPacientesActivos();
  await A.obtenerAdministradores(5);
  assert.deepEqual(llamadas.map((l) => l.url.replace('http://api.test', '')), [
    '/api/administradores/medicos/solicitantes',
    '/api/administradores/medicos/activos',
    '/api/administradores/pacientes/solicitantes',
    '/api/administradores/pacientes/activos',
    '/api/administradores/obtenerAdmins/5',
  ]);
  assert.ok(llamadas.every((l) => l.metodo === 'GET'));
});

test('médicos: fecha ISO a dd/mm/aaaa, relleno como vacío, URLs de documentos', async () => {
  simular(() => json([medicoBackend]));
  const [m] = await A.obtenerMedicosSolicitantes();
  assert.equal(m.clave, 'Médico-4');
  assert.equal(m.activo, false);
  assert.equal(m.fechaNac, '10/05/1985');
  assert.equal(m.telefono, null);
  assert.equal(m.matriculaUrl, 'https://cdn.test/matricula.pdf');
  assert.equal(m.carnetUrl, null);
  assert.equal(m.admitidoPor, null); // "Sistema" es relleno
  assert.equal(m.resumen, 'La Paz');
});

test('pacientes: correo desde ci si falta, afección, médico asignado y tratamientos', async () => {
  simular(() => json([pacienteBackend]));
  const [p] = await A.obtenerPacientesActivos();
  assert.equal(p.clave, 'Paciente-7');
  assert.equal(p.activo, true);
  assert.equal(p.correo, 'luis@x.test'); // "No registrado" cae a ci
  assert.equal(p.fechaNac, '02/11/1976');
  assert.equal(p.medico, 'Dra. Silva');
  assert.deepEqual(p.afecciones, ['Diabetes Tipo 2']);
  assert.deepEqual(p.tratamientos, [{ titulo: 'Metformina', descripcion: 'Oral', dosis: '850' }]);
  assert.equal(p.resumen, 'Diabetes Tipo 2');
});

test('administradores y perfilAdmin', async () => {
  simular(() => json([adminBackend]));
  const [a] = await A.obtenerAdministradores(1);
  assert.deepEqual([a.clave, a.cargo, a.fechaIngreso, a.fechaNac, a.admitidoPor], ['Administrador-3', 'Seguridad', '10/10/2024', '01/01/1985', null]);
  simular(() => json({ id: 3, nombre: 'Mari Rivas', correo: 'mari@x.test', fechaNac: '01/01/1985', telefono: 'No registrado', cargo: 'N/A', fechaIn: '10/10/2024', admitidoPor: 'No' }));
  const p = await A.obtenerPerfilAdmin(9);
  assert.equal(llamadas[0].url, 'http://api.test/api/administradores/perfilAdmin/9');
  assert.deepEqual(p, { idAdmin: 3, nombre: 'Mari Rivas', correo: 'mari@x.test', fechaNac: '01/01/1985', telefono: null, cargo: null, fechaIngreso: '10/10/2024', admitidoPor: 'No' });
});

test('listas: respuesta que no es lista -> respuesta inesperada; 404 de perfil y 500 sin filtrar', async () => {
  simular(() => json({ algo: 1 }));
  await assert.rejects(A.obtenerMedicosActivos(), (e: InstanceType<typeof ErrorApi>) => e.codigo === 'respuesta');
  simular(() => json({ message: 'No se encontró el administrador' }, 404));
  await assert.rejects(A.obtenerPerfilAdmin(1), (e: InstanceType<typeof ErrorApi>) => e.message === 'No se encontró tu perfil de administrador.');
  simular(() => json({ error: 'Error interno inesperado del servidor', code: 'INTERNAL_SERVER_ERROR' }, 500));
  await assert.rejects(A.obtenerPacientesActivos(), (e: InstanceType<typeof ErrorApi>) => e.message === MENSAJES.servidor);
});

// ------------------------------------------------------------ activar
test('activar: PUT con {idAdmin} numérico en la ruta del médico y del paciente', async () => {
  simular(() => json({ mensaje: 'Usuario activado correctamente' }));
  await A.activarUsuario('Médico', 4, 3);
  await A.activarUsuario('Paciente', 7, 3);
  assert.deepEqual(llamadas.map((l) => [l.metodo, l.url.replace('http://api.test', ''), l.cuerpo]), [
    ['PUT', '/api/administradores/medico/activar/4', { idAdmin: 3 }],
    ['PUT', '/api/administradores/paciente/activar/7', { idAdmin: 3 }],
  ]);
  assert.equal(typeof (llamadas[0].cuerpo as { idAdmin: unknown }).idAdmin, 'number');
});

test('activar: sin id de administrador válido no se llama a la red', async () => {
  simular(() => json({}));
  for (const malo of [0, -1, NaN, 1.5]) {
    await assert.rejects(A.activarUsuario('Médico', 4, malo), (e: InstanceType<typeof ErrorApi>) => e.estado === 400 && /administrador/.test(e.message));
  }
  assert.equal(llamadas.length, 0);
});

test('activar: 400, 404 y 500 con mensajes seguros (el 500 trae "detalles" con la excepción)', async () => {
  simular(() => json({ error: 'No hay administrador' }, 400));
  await assert.rejects(A.activarUsuario('Médico', 4, 3), (e: InstanceType<typeof ErrorApi>) => /identificar al administrador/.test(e.message));
  simular(() => json({ error: 'Médico no encontrado' }, 404));
  await assert.rejects(A.activarUsuario('Médico', 99, 3), (e: InstanceType<typeof ErrorApi>) => e.message === 'No se encontró la cuenta a activar.');
  simular(() => json({ error: 'Error del servidor', detalles: 'insert violates constraint "usuario_correo_key" Key (correo)=(ana@x.test)' }, 500));
  await assert.rejects(A.activarUsuario('Paciente', 7, 3), (e: InstanceType<typeof ErrorApi>) => e.message === MENSAJES.servidor && !/ana@|usuario_correo/.test(e.message));
});

// ------------------------------------------------------------ vistas: solicitudes y usuarios
const med = A.normalizarMedicosAdmin([medicoBackend, { ...medicoBackend, id: 5, nombre: 'Beto Díaz' }], false);
const pac = A.normalizarPacientesAdmin([pacienteBackend], false);
const act = [...A.normalizarMedicosAdmin([{ ...medicoBackend, id: 9, nombre: 'Carla Ruiz' }], true), ...A.normalizarPacientesAdmin([{ ...pacienteBackend, id: 9 }], true), ...A.normalizarAdministradores([adminBackend])];

test('solicitudes: unificación ordenada, filtros y conteos', () => {
  const todos = V.unificarSolicitudes(pac, med);
  assert.deepEqual(todos.map((s) => s.nombre), ['Beto Díaz', 'Dra. Ana Rojas', 'Luis Paz']);
  assert.deepEqual(V.conteoSolicitudes(todos), { todos: 3, pacientes: 1, medicos: 2 });
  assert.deepEqual(V.filtrarSolicitudes(todos, 'pacientes').map((s) => s.rol), ['Paciente']);
  assert.equal(V.filtrarSolicitudes(todos, 'medicos').length, 2);
  assert.equal(V.filtrarSolicitudes(todos, 'todos').length, 3);
});

test('usuarios: los ids se solapan entre roles pero la clave es única; búsqueda y filtro de estado', () => {
  const todos = [...act, ...pac];
  assert.equal(new Set(todos.map((u) => u.clave)).size, todos.length);
  assert.equal(act.find((u) => u.rol === 'Médico')!.id, act.find((u) => u.rol === 'Paciente')!.id); // ambos id 9
  assert.deepEqual(V.conteoUsuarios(todos), { todos: 4, activos: 3, inactivos: 1 });
  assert.deepEqual(V.filtrarUsuarios(todos, '', 'inactivos').map((u) => u.rol), ['Paciente']);
  assert.equal(V.filtrarUsuarios(todos, 'carla', 'todos').length, 1);
  assert.equal(V.filtrarUsuarios(todos, 'MARI@X', 'todos').length, 1); // por correo, sin distinguir mayúsculas
  assert.equal(V.filtrarUsuarios(todos, 'médico', 'activos').length, 1); // por rol
  assert.equal(V.filtrarUsuarios(todos, 'zzz', 'todos').length, 0);
});

test('URL de documentos: solo http(s)', () => {
  assert.ok(V.esUrlAbrible('https://cdn.test/a.pdf') && V.esUrlAbrible('http://cdn.test/a.jpg'));
  for (const mal of [null, undefined, '', 'N/A', 'file:///data/x.pdf', 'javascript:alert(1)', 'intent://x#Intent;end', 'ftp://x/y', 'https://']) {
    assert.ok(!V.esUrlAbrible(mal as string), String(mal));
  }
});

test('fechas de nacimiento a dd/mm/aaaa', () => {
  assert.equal(V.normalizarFechaNac('1985-05-10'), '10/05/1985');
  assert.equal(V.normalizarFechaNac('1985-05-10T00:00:00'), '10/05/1985');
  assert.equal(V.normalizarFechaNac('10/05/1985'), '10/05/1985');
  for (const mal of [null, undefined, '', 'N/A', 'No registrado', 12]) assert.equal(V.normalizarFechaNac(mal), null);
});

// ------------------------------------------------------------ auditoría
const filaAuditoria = (id: number, extra: object = {}) => ({
  id, id_usuario: 5, rol: 'paciente', id_rol: 7, endpoint: '/api/pacientes/perfil/7', operacion: 'GET', exito: true, codigo_http: 200,
  ip_origen: '192.168.1.45', fecha: '2026-10-29T14:05:00', usuario: { nombre_completo: 'Luis Paz' }, ...extra,
});

test('auditoría: ruta, sin nombres, IP enmascarada y números de la ruta sustituidos', async () => {
  simular(() => json([filaAuditoria(1)]));
  const r = await A.obtenerAuditoria();
  assert.equal(llamadas[0].url, 'http://api.test/api/general/auditoria');
  assert.equal(r[0].ip, '192.168.1.xxx');
  assert.equal(r[0].endpoint, '/api/pacientes/perfil/{id}');
  const texto = JSON.stringify(r);
  assert.ok(!/Luis|Paz|nombre_completo|192\.168\.1\.45|\/7\b/.test(texto), texto);
});

test('enmascarado de IP y de rutas', () => {
  assert.equal(V.enmascararIp('10.0.12.200'), '10.0.12.xxx');
  assert.equal(V.enmascararIp('172.31.0.1'), '172.31.0.xxx');
  assert.equal(V.enmascararIp('2001:db8:85a3::8a2e:370:7334'), '2001:db8:xxxx');
  assert.equal(V.enmascararIp('::1'), '1:xxxx');
  // IPv4 mapeada en IPv6: no puede filtrarse la dirección completa
  assert.equal(V.enmascararIp('::ffff:172.31.0.1'), '172.31.0.xxx');
  assert.equal(V.enmascararIp('::ffff:192.168.1.45'), '192.168.1.xxx');
  assert.ok(!/\d+\.\d+\.\d+\.\d+/.test(V.enmascararIp('::ffff:10.1.2.3')));
  for (const raro of [null, undefined, 5, 'host', '']) assert.equal(V.enmascararIp(raro), 'xxx');
  assert.equal(V.sanitizarEndpoint('/api/medicos/alertasActivas/12'), '/api/medicos/alertasActivas/{id}');
  assert.equal(V.sanitizarEndpoint('/api/pacientes/registros/7?token=abc'), '/api/pacientes/registros/{id}');
  assert.equal(V.sanitizarEndpoint('/api/login'), '/api/login');
});

const evs = A.normalizarAuditoria([
  filaAuditoria(1, { fecha: '2026-10-29T10:00:00', rol: 'login', endpoint: '/api/login', operacion: 'POST' }),
  filaAuditoria(2, { fecha: '2026-10-29T12:00:00', operacion: 'POST', endpoint: '/api/pacientes/registrarGlucosa', exito: false, codigo_http: 500 }),
  filaAuditoria(3, { fecha: '2026-10-28T09:00:00' }),
  filaAuditoria(4, { fecha: 'no es una fecha' }),
  filaAuditoria(5, { fecha: null, rol: 'login', endpoint: '/api/verify-otp', operacion: 'POST' }),
]);
const hoy = new Date(2026, 9, 29, 15, 0);

test('auditoría: clasificación, orden (fechas inválidas al final) y filtros', () => {
  assert.deepEqual(evs.map((e) => V.clasificarEvento(e)), ['acceso', 'modificacion', 'consulta', 'consulta', 'acceso']);
  assert.deepEqual(V.ordenarEventos(evs).map((e) => e.id), [2, 1, 3, 4, 5]);
  assert.deepEqual(V.filtrarEventos(evs, 'accesos', false, hoy).map((e) => e.id), [1, 5]);
  assert.deepEqual(V.filtrarEventos(evs, 'modificaciones', false, hoy).map((e) => e.id), [2]);
  assert.deepEqual(V.filtrarEventos(evs, 'todos', true, hoy).map((e) => e.id), [1, 2]); // solo hoy: sin fecha válida queda fuera
  assert.deepEqual(V.filtrarEventos(evs, 'accesos', true, hoy).map((e) => e.id), [1]);
});

test('auditoría: KPIs reales y etiquetas de fecha', () => {
  assert.deepEqual(V.kpisAuditoria(evs, hoy), { hoy: 2, erroresHoy: 1, total: 5 });
  assert.deepEqual(V.kpisAuditoria([], hoy), { hoy: 0, erroresHoy: 0, total: 0 });
  assert.equal(V.etiquetaFechaEvento(evs[0], hoy), 'Hoy, 10:00');
  assert.equal(V.etiquetaFechaEvento(evs[2], hoy), 'Ayer, 09:00');
  assert.equal(V.etiquetaFechaEvento(evs[3], hoy), 'Sin fecha');
  assert.equal(V.etiquetaFechaEvento(evs[4], hoy), 'Sin fecha');
});

test('auditoría: carga parcial en el cliente (páginas de 20)', () => {
  const muchos = Array.from({ length: 45 }, (_, i) => i);
  assert.deepEqual([V.paginar(muchos, 1).visibles.length, V.paginar(muchos, 1).hayMas], [20, true]);
  assert.deepEqual([V.paginar(muchos, 2).visibles.length, V.paginar(muchos, 2).hayMas], [40, true]);
  assert.deepEqual([V.paginar(muchos, 3).visibles.length, V.paginar(muchos, 3).hayMas], [45, false]);
  assert.deepEqual([V.paginar([], 1).visibles.length, V.paginar([], 1).hayMas], [0, false]);
  assert.equal(V.paginar(muchos, 0).visibles.length, 20); // páginas < 1 se tratan como 1
});

test('auditoría: respuesta que no es lista, y filas sin id se descartan', () => {
  assert.throws(() => A.normalizarAuditoria({ a: 1 }), (e: InstanceType<typeof ErrorApi>) => e.codigo === 'respuesta');
  assert.equal(A.normalizarAuditoria([{ rol: 'x' }, null, filaAuditoria(1)]).length, 1);
});

// ------------------------------------------------------------ privacidad
test('en desarrollo no se registran nombres, correos ni IP del administrador', async () => {
  simular((l) => json(l.url.includes('auditoria') ? [filaAuditoria(1)] : [pacienteBackend]));
  const lineas: string[] = [];
  const log = console.log;
  console.log = (...a: unknown[]) => lineas.push(a.join(' '));
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  try {
    await A.obtenerPacientesActivos();
    await A.obtenerAuditoria();
  } finally {
    console.log = log;
  }
  const todo = lineas.join('\n');
  assert.match(todo, /\[http\] GET \/api\/general\/auditoria -> 200/);
  assert.ok(!/Luis|luis@|192\.168|71234567/.test(todo), todo);
});
