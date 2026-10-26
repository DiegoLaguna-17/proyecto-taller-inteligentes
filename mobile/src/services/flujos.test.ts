// Pruebas de los flujos con fetch simulado: auth, registro de toma, historial y chatbot (sin red real).
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test/';
process.env.EXPO_PUBLIC_NLP_URL = 'http://nlp.test';
delete process.env.EXPO_PUBLIC_USE_MOCK;

const { iniciarSesion, verificarOtp, rolDeBackend } = await import('./auth.ts');
const { registrarToma, fechaLocal, horaLocal } = await import('./registroToma.ts');
const { obtenerRegistros } = await import('./glucosa.ts');
const { consultarChatbot } = await import('./chatbot.ts');
const { ErrorApi } = await import('./http.ts');
const H = await import('./historial.ts');

type Llamada = { url: string; metodo: string; cuerpo: unknown };
const original = globalThis.fetch;
const llamadas: Llamada[] = [];

function simular(respuestas: (l: Llamada) => Response) {
  llamadas.length = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const l = { url, metodo: init?.method ?? 'GET', cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined };
    llamadas.push(l);
    return respuestas(l);
  }) as unknown as typeof fetch;
}
const json = (c: unknown, s = 200, h: Record<string, string> = {}) =>
  new Response(JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json', ...h } });

test.afterEach(() => { globalThis.fetch = original; });

// ------------------------------ auth ------------------------------
test('login: cuerpo exacto, URL sin barra doble y devuelve id_usuario', async () => {
  simular(() => json({ id_usuario: 7, id_rol: 3, message: 'OTP enviado al correo' }));
  const r = await iniciarSesion('  a@b.c ', 'clave');
  assert.deepEqual(r, { id_usuario: 7 });
  assert.deepEqual(llamadas[0], { url: 'http://api.test/api/login', metodo: 'POST', cuerpo: { correo: 'a@b.c', contrasena: 'clave' } });
});

test('login 401: mensaje genérico que no revela si falló el correo o la contraseña', async () => {
  for (const motivo of ['Correo no encontrado', 'Contraseña incorrecta']) {
    simular(() => json({ error: motivo }, 401));
    await assert.rejects(iniciarSesion('a@b.c', 'x'), (e: InstanceType<typeof ErrorApi>) => e.message === 'Correo o contraseña incorrectos.');
  }
});

test('verify-otp: devuelve id_usuario, id_rol y rol; mapea el rol como el front web', async () => {
  simular(() => json({ id_usuario: 7, rol: 'administrador', id_rol: 2, message: 'Login exitoso' }));
  assert.deepEqual(await verificarOtp(7, ' 123456 '), { id_usuario: 7, id_rol: 2, rol: 'admin' });
  assert.deepEqual(llamadas[0].cuerpo, { id_usuario: 7, codigo: '123456' });
  assert.equal(rolDeBackend('medico'), 'medico');
  assert.equal(rolDeBackend('paciente'), 'paciente');
  assert.equal(rolDeBackend('cualquier-otro'), 'paciente');
});

test('verify-otp: código incorrecto (401) y perfil inexistente (id_rol 0)', async () => {
  simular(() => json({ error: 'Código incorrecto o expirado' }, 401));
  await assert.rejects(verificarOtp(7, '000000'), (e: InstanceType<typeof ErrorApi>) => e.message === 'Código incorrecto o expirado.');
  simular(() => json({ id_usuario: 7, rol: 'paciente', id_rol: 0 }));
  await assert.rejects(verificarOtp(7, '123456'), (e: InstanceType<typeof ErrorApi>) => /perfil/.test(e.message));
});

// ------------------------- registro de toma -------------------------
const adulto = { id_paciente: 5, id_medico: 9, edad: 45, embarazo: false, enfermedades: ['Diabetes Tipo 2'] };
const ahora = new Date(2026, 9, 26, 8, 5, 9); // 26-oct-2026 08:05:09 local

test('fecha y hora locales con ceros', () => {
  assert.equal(fechaLocal(ahora), '2026-10-26');
  assert.equal(horaLocal(ahora), '08:05:09');
});

test('toma NORMAL: guarda con el cuerpo exacto y NO llama a registrarAlerta', async () => {
  simular(() => json({ message: 'ok', registro_glucosa: { id_registro: 41 } }));
  const r = await registrarToma({ datos: adulto, idMomento: 1, valor: 110, ahora });
  assert.deepEqual(r, { estado: 'NORMAL', idRegistro: 41, alerta: 'no_aplica' });
  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0], {
    url: 'http://api.test/api/pacientes/registrarGlucosa',
    metodo: 'POST',
    cuerpo: { id_paciente: 5, id_momento: 1, nivel_glucosa: 110, fecha: '2026-10-26', hora: '08:05:09' },
  });
});

test('hipoglucemia: guarda y registra la alerta tipo 1 con el id_registro devuelto', async () => {
  simular((l) => (l.url.endsWith('registrarGlucosa') ? json({ registro_glucosa: { id_registro: 42 } }) : json({ message: 'ok' })));
  const r = await registrarToma({ datos: adulto, idMomento: 3, valor: 60, ahora });
  assert.deepEqual(r, { estado: 'HIPOGLUCEMIA', idRegistro: 42, alerta: 'enviada' });
  assert.deepEqual(llamadas[1], {
    url: 'http://api.test/api/registro/registrarAlerta',
    metodo: 'POST',
    cuerpo: { id_tipo_alerta: 1, id_registro: 42, id_medico: 9, fecha_alerta: '2026-10-26' },
  });
});

test('hiperglucemia: alerta tipo 2 (adulto diabético, ayunas 131)', async () => {
  simular((l) => (l.url.endsWith('registrarGlucosa') ? json({ registro_glucosa: { id_registro: 43 } }) : json({})));
  const r = await registrarToma({ datos: adulto, idMomento: 1, valor: 131, ahora });
  assert.equal(r.estado, 'HIPERGLUCEMIA');
  assert.equal((llamadas[1].cuerpo as { id_tipo_alerta: number }).id_tipo_alerta, 2);
});

test('PARAM_INVALIDO: se guarda, NO se envía alerta', async () => {
  simular(() => json({ registro_glucosa: { id_registro: 44 } }));
  const r = await registrarToma({ datos: { ...adulto, edad: 4 }, idMomento: 1, valor: 100, ahora });
  assert.deepEqual(r, { estado: 'PARAM_INVALIDO', idRegistro: 44, alerta: 'no_aplica' });
  assert.equal(llamadas.length, 1);
});

test('si falla el guardado: error y ninguna alerta', async () => {
  simular(() => json({ error: 'duplicate key ...' }, 500));
  await assert.rejects(registrarToma({ datos: adulto, idMomento: 3, valor: 60, ahora }), (e: InstanceType<typeof ErrorApi>) => e.estado === 500);
  assert.equal(llamadas.length, 1);
});

test('si falla la alerta: la toma queda guardada y se informa alerta fallida', async () => {
  simular((l) => (l.url.endsWith('registrarGlucosa') ? json({ registro_glucosa: { id_registro: 45 } }) : json({ error: 'x' }, 500)));
  const r = await registrarToma({ datos: adulto, idMomento: 3, valor: 60, ahora });
  assert.deepEqual(r, { estado: 'HIPOGLUCEMIA', idRegistro: 45, alerta: 'fallida' });
});

test('sin médico asignado: no se puede alertar y se informa alerta fallida', async () => {
  simular(() => json({ registro_glucosa: { id_registro: 46 } }));
  const r = await registrarToma({ datos: { ...adulto, id_medico: null }, idMomento: 3, valor: 60, ahora });
  assert.equal(r.alerta, 'fallida');
  assert.equal(llamadas.length, 1);
});

// ------------------------------ historial ------------------------------
const reg = (id: number, fecha: string, v: number | null, alerta: string | null = null) =>
  ({ id, fecha, hora: '10:00', nivelGlucosa: v, momentoDia: 'AYUNAS', observaciones: null, tipo_alerta: alerta });
const hoy = new Date(2026, 9, 26, 12, 0, 0);

test('obtenerRegistros: normaliza el contrato real del backend', async () => {
  simular(() => json([
    { id: 1, fecha: '2026-10-26', hora: '08:30', nivelGlucosa: 112.0, momentoDia: 'AYUNAS', quienTomoMuestra: null, observaciones: null, idAlerta: null, tipo_alerta: null, placeholderRetro: null, respuesta: null },
  ]));
  const r = await obtenerRegistros(5);
  assert.equal(llamadas[0].url, 'http://api.test/api/pacientes/registros/5');
  assert.deepEqual(r, [{ id: 1, fecha: '2026-10-26', hora: '08:30', nivelGlucosa: 112, momentoDia: 'AYUNAS', observaciones: null, tipo_alerta: null }]);
});

test('periodos: Diario = hoy; Semanal = 7 días con hoy; Mensual = 30 días; ignora fechas futuras', () => {
  const datos = [
    reg(1, '2026-10-27', 300), // futuro
    reg(2, '2026-10-26', 100),
    reg(3, '2026-10-20', 110), // límite semanal (hoy-6)
    reg(4, '2026-10-19', 120), // fuera de la semana
    reg(5, '2026-09-27', 130), // límite mensual (hoy-29)
    reg(6, '2026-09-26', 140), // fuera del mes
  ];
  assert.deepEqual(H.filtrarPorPeriodo(datos, 'Diario', hoy).map((r) => r.id), [2]);
  assert.deepEqual(H.filtrarPorPeriodo(datos, 'Semanal', hoy).map((r) => r.id), [2, 3]);
  assert.deepEqual(H.filtrarPorPeriodo(datos, 'Mensual', hoy).map((r) => r.id), [2, 3, 4, 5]);
  assert.deepEqual(H.rangoPeriodo('Semanal', hoy), { desde: '2026-10-20', hasta: '2026-10-26' });
});

test('promedio, desviación y tiempo en rango; lista vacía -> null; ignora lecturas nulas', () => {
  const datos = [reg(1, '2026-10-26', 100), reg(2, '2026-10-26', 120), reg(3, '2026-10-26', 65), reg(4, '2026-10-26', 195), reg(5, '2026-10-26', null)];
  assert.equal(H.promedio(datos), 120); // (100+120+65+195)/4 = 120
  assert.equal(H.desviacion(datos), 48); // sqrt((20^2 + 0 + 55^2 + 75^2) / 4) = sqrt(2262.5) = 47.6
  assert.equal(H.porcentajeEnRango(datos), 50); // 100 y 120 dentro del rango meta (70-180); 65 y 195 fuera
  assert.equal(H.promedio([]), null);
  assert.equal(H.desviacion([]), null);
  assert.equal(H.porcentajeEnRango([]), null);
  assert.equal(H.promedio([reg(1, '2026-10-26', 99.5), reg(2, '2026-10-26', 100)]), 100); // redondeo
});

test('clasificación para mostrar, etiquetas y fechas', () => {
  assert.equal(H.clasificacionDeRegistro(reg(1, '2026-10-26', 100, 'Hiperglucemia')), 'Riesgo Hiper');
  assert.equal(H.clasificacionDeRegistro(reg(1, '2026-10-26', 100, 'hipoglucemia')), 'Riesgo Hipo');
  assert.equal(H.clasificacionDeRegistro(reg(1, '2026-10-26', 65)), 'Riesgo Hipo');
  assert.equal(H.clasificacionDeRegistro(reg(1, '2026-10-26', 100)), 'Normal');
  assert.equal(H.etiquetaMomento('DESPUES DE COMER'), 'Después de comer');
  assert.equal(H.etiquetaMomento('ANTES DE DORMIR'), 'Antes de dormir');
  assert.equal(H.etiquetaMomento(null), 'Sin momento');
  assert.equal(H.fechaCorta('2026-10-05'), '5 Oct');
  assert.equal(H.etiquetaDia('2026-10-26'), 'L26'); // lunes
  assert.equal(H.etiquetaRango('Semanal', hoy), '20 Oct - 26 Oct, 2026');
  assert.equal(H.etiquetaRango('Diario', hoy), '26 Oct, 2026');
});

// ------------------------------- chatbot -------------------------------
test('chatbot: envía solo {texto} a la URL del NLP y devuelve la respuesta completa', async () => {
  simular(() => json({ respuesta: 'Come algo.\n\nConsulta siempre a tu médico tratante para cambios en tu medicación.' }));
  const r = await consultarChatbot('¿Qué como?');
  assert.match(r, /médico tratante/);
  assert.deepEqual(llamadas[0], { url: 'http://nlp.test/api/chatbot/consulta', metodo: 'POST', cuerpo: { texto: '¿Qué como?' } });
  assert.deepEqual(Object.keys(llamadas[0].cuerpo as object), ['texto']);
});

test('chatbot: 422, 429 (con espera), 401, 503 y red caída -> mensajes amables sin la consulta', async () => {
  const consulta = 'MI CONSULTA PRIVADA';
  const casos: [number, RegExp][] = [[422, /no es válida/], [429, /muchas consultas/], [401, /iniciar sesión/], [503, /no está disponible/], [502, /no está disponible/], [504, /tardó demasiado/]];
  for (const [estado, patron] of casos) {
    simular(() => json({ detail: `eco: ${consulta}` }, estado, estado === 429 ? { 'retry-after': '30' } : {}));
    await assert.rejects(consultarChatbot(consulta), (e: InstanceType<typeof ErrorApi>) => patron.test(e.message) && !e.message.includes(consulta));
  }
  simular(() => json({ detail: 'x' }, 429, { 'retry-after': '30' }));
  await assert.rejects(consultarChatbot('a'), (e: InstanceType<typeof ErrorApi>) => /30 s/.test(e.message));
  globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
  await assert.rejects(consultarChatbot(consulta), (e: InstanceType<typeof ErrorApi>) => e.codigo === 'red' && !e.message.includes(consulta));
});

test('chatbot: respuesta sin texto -> respuesta inesperada', async () => {
  simular(() => json({ respuesta: '   ' }));
  await assert.rejects(consultarChatbot('hola'), (e: InstanceType<typeof ErrorApi>) => e.codigo === 'respuesta');
});
