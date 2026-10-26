// La base guarda la altura en METROS (numeric(4,2), máx. 99.99). El usuario la escribe y la ve en centímetros.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
delete process.env.EXPO_PUBLIC_USE_MOCK;

const V = await import('./validaciones.ts');
const R = await import('./registroPaciente.ts');
const E = await import('./edicionPaciente.ts');
const P = await import('./paciente.ts');

test('cm -> m con dos decimales', () => {
  assert.equal(V.alturaCmAMetros('170'), '1.70');
  assert.equal(V.alturaCmAMetros('155'), '1.55');
  assert.equal(V.alturaCmAMetros('199'), '1.99');
  assert.equal(V.alturaCmAMetros('50'), '0.50');
  assert.equal(V.alturaCmAMetros('250'), '2.50');
  assert.equal(V.alturaCmAMetros(' 165 '), '1.65');
});

test('redondeo al centímetro entero (medio hacia arriba) y coma decimal', () => {
  assert.equal(V.alturaCmAMetros('170.4'), '1.70');
  assert.equal(V.alturaCmAMetros('170.5'), '1.71');
  assert.equal(V.alturaCmAMetros('169.99'), '1.70');
  assert.equal(V.alturaCmAMetros('165,4'), '1.65');
});

test('límites del rango: 50 a 250 cm (0.50 a 2.50 m)', () => {
  for (const ok of ['50', '250', '170', '49.99'.replace('49.99', '50.00'), '250.00']) assert.ok(V.esAlturaCm(ok), ok);
  for (const mal of ['49', '49.99', '250.01', '251', '0', '', 'abc', '1.70', '1,70', '-170', '170cm', '1.234']) {
    assert.ok(!V.esAlturaCm(mal), `"${mal}" no debe ser válida`);
  }
});

test('ninguna altura válida puede desbordar numeric(4,2): siempre entre 0.50 y 2.50 con dos decimales', () => {
  for (let cm = V.ALTURA_MIN_CM; cm <= V.ALTURA_MAX_CM; cm++) {
    const m = V.alturaCmAMetros(String(cm));
    assert.match(m, /^\d\.\d{2}$/, `${cm} -> ${m}`);
    assert.ok(Number(m) >= 0.5 && Number(m) <= 2.5 && Number(m) <= 99.99, `${cm} -> ${m}`);
  }
});

test('metros -> cm (como los devuelve el backend), incluidos los casos de coma flotante', () => {
  assert.equal(V.alturaMetrosACm('1.7'), '170');
  assert.equal(V.alturaMetrosACm('1.70'), '170');
  assert.equal(V.alturaMetrosACm('1,75'), '175');
  assert.equal(V.alturaMetrosACm('1.15'), '115'); // 1.15 * 100 = 114.99999999999999
  assert.equal(V.alturaMetrosACm('1.1'), '110');
  assert.equal(V.alturaMetrosACm(null), '');
  assert.equal(V.alturaMetrosACm(''), '');
  assert.equal(V.alturaMetrosACm('abc'), '');
});

test('round-trip cm -> m -> cm sin cambiar el valor, para todo el rango', () => {
  for (let cm = V.ALTURA_MIN_CM; cm <= V.ALTURA_MAX_CM; cm++) {
    assert.equal(V.alturaMetrosACm(V.alturaCmAMetros(String(cm))), String(cm), `cm=${cm}`);
  }
});

// ------------------------------------------------------------ registro de paciente
const completa: import('./registroPaciente.ts').SolicitudPaciente = {
  nombreCompleto: 'Carlos Ruiz', correo: 'carlos@x.test', contrasena: 'clave-larga-1', fechaNac: '1990-05-23', telefono: '70000000',
  genero: 'Masculino', embarazada: false, semanas: '', peso: '72.5', altura: '170', idMedico: 2, idActividad: 1, enfermedadId: 3,
  tratamientoId: 4, dosis: '850', nombreEmergencia: 'María', numeroEmergencia: '71111111',
  foto: { uri: 'file:///x/perfil.jpg', nombre: 'perfil.jpg', tipo: 'image/jpeg' },
};
const hoy = new Date(2026, 9, 27);

test('registro: la altura viaja en metros en los campos y en el FormData', () => {
  assert.deepEqual(R.validarSolicitudPaciente(completa, hoy), {});
  assert.equal(Object.fromEntries(R.camposSolicitud(completa)).altura, '1.70');
  assert.equal(R.construirFormData(completa).get('altura'), '1.70');
  assert.equal(R.construirFormData({ ...completa, altura: '155' }).get('altura'), '1.55');
  assert.equal(R.construirFormData({ ...completa, altura: '199' }).get('altura'), '1.99');
  // el peso no cambia de formato
  assert.equal(R.construirFormData(completa).get('peso'), '72.5');
});

test('registro: rango y mensajes claros; escribir metros por error se rechaza', () => {
  for (const mal of ['49', '251', '1.70', '1,70', '', 'abc']) {
    const e = R.validarSolicitudPaciente({ ...completa, altura: mal }, hoy);
    assert.ok('altura' in e, mal);
    assert.match(e.altura, /centímetros, entre 50 y 250/);
  }
  assert.deepEqual(R.validarSolicitudPaciente({ ...completa, altura: '50' }, hoy), {});
  assert.deepEqual(R.validarSolicitudPaciente({ ...completa, altura: '250' }, hoy), {});
});

// ------------------------------------------------------------ edición
const perfil = (altura: string | null) => P.normalizarPerfil({
  nombre: 'Ana Pérez', id: '7', fechaNac: '15/03/1990', genero: 'Femenino', altura, peso: 60.5, telefono: '70000000',
  correo: 'ana@x.test', nombre_emergencia: 'Luis', numero_emergencia: '71111111', embarazo: false,
});

test('edición: el perfil trae metros y el formulario muestra centímetros', () => {
  assert.equal(E.formDesdePerfil(perfil('1.7'), hoy).altura, '170');
  assert.equal(E.formDesdePerfil(perfil('1.70'), hoy).altura, '170');
  assert.equal(E.formDesdePerfil(P.normalizarPerfil({ nombre: 'A', altura: 1.55 }), hoy).altura, '155'); // el backend puede mandar un número
  assert.equal(E.formDesdePerfil(perfil(null), hoy).altura, '');
});

test('edición: perfil -> formulario -> envío sin tocar la altura NO es un cambio y conserva el valor', () => {
  for (const original of ['1.7', '1.70', '1.55', '1.99', '0.50', '2.5']) {
    const p = perfil(original);
    const f = E.formDesdePerfil(p, hoy);
    assert.equal(E.hayCambios(f, p), false, original);
    assert.deepEqual(E.validarEdicion(f, p, hoy), {}, original);
    assert.equal(Number(E.construirActualizacion(f, p).altura), Number(original), original);
  }
});

test('edición: un cambio de altura se detecta y se envía en metros con dos decimales', () => {
  const p = perfil('1.70');
  const f = { ...E.formDesdePerfil(p, hoy), altura: '171' };
  assert.equal(E.hayCambios(f, p), true);
  assert.equal(E.construirActualizacion(f, p).altura, '1.71');
  assert.equal(E.construirActualizacion({ ...f, altura: '155' }, p).altura, '1.55');
});

test('edición: rango y mensaje de altura', () => {
  const p = perfil('1.70');
  const base = E.formDesdePerfil(p, hoy);
  for (const mal of ['49', '251', '1.70', '']) {
    const e = E.validarEdicion({ ...base, altura: mal }, p, hoy);
    assert.match(e.altura, /centímetros, entre 50 y 250/, mal);
  }
});

test('PUT y POST reales (fetch simulado) llevan la altura en metros', async () => {
  const original = globalThis.fetch;
  const vistos: { url: string; cuerpo: unknown }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    vistos.push({ url, cuerpo: init?.body instanceof FormData ? init.body : JSON.parse(String(init?.body)) });
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  try {
    const p = perfil('1.70');
    await P.actualizarPaciente(7, E.construirActualizacion({ ...E.formDesdePerfil(p, hoy), altura: '172' }, p));
    await R.enviarSolicitudPaciente(completa);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal((vistos[0].cuerpo as { altura: string }).altura, '1.72');
  assert.equal((vistos[1].cuerpo as FormData).get('altura'), '1.70');
});
