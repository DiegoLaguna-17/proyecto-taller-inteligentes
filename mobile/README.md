# GlucoTracker - App Móvil

Aplicación móvil para el monitoreo clínico de niveles de glucosa en pacientes con diabetes, desarrollada con **React Native** y **Expo SDK 58**. Cuenta con navegación y pantallas personalizadas para tres roles: **Paciente**, **Médico** y **Administrador**.

---

## Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

1. **Node.js** (versión 18 o superior recomendada): [Descargar Node.js](https://nodejs.org/)
2. **Expo Go** en tu dispositivo móvil:
   - [Android - Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iOS - Apple App Store](https://apps.apple.com/app/expo-go/id982107779)
3. Tu computadora y tu teléfono móvil deben estar conectados a la **misma red Wi-Fi** (o usar la opción `--tunnel` explicada más abajo).

---

## Pasos para reproducir y probar con Expo Go

### 1. Navegar a la carpeta del proyecto móvil
Abre tu terminal en la raíz del repositorio y entra a la carpeta `mobile`:

```bash
cd mobile
```

### 2. Instalar las dependencias
Instala los paquetes necesarios del proyecto:

```bash
npm install
```

> [!NOTE]
> Las fuentes Manrope (`@expo-google-fonts/manrope`), `react-native-svg` y las librerías de interfaz ya se encuentran registradas en el `package.json`.

### 3. Iniciar el servidor de desarrollo de Expo
Crea antes `mobile/.env` (ver "Conexión con el backend" más abajo). Ejecuta el siguiente comando para iniciar el empaquetador de Expo:

```bash
npx expo start
```

### 4. Abrir la app en tu teléfono
Una vez que aparezca el código QR en la terminal:
- **En Android:** Abre la aplicación **Expo Go** y selecciona **"Scan QR Code"** para escanear el código QR.
- **En iOS:** Abre la app nativa de la **Cámara**, apunta al código QR y presiona la notificación que abre **Expo Go**.

---

## Comandos alternativos útiles

### Si tienes problemas de conexión entre PC y móvil (Tunnel)
Si tu teléfono no detecta el servidor local en la misma red Wi-Fi, utiliza el modo túnel de Expo usando Ngrok:

```bash
npx expo start --tunnel ngrok
```

### Limpiar la caché de Metro Bundler
Si realizaste cambios o actualizaste dependencias y deseas reiniciar la caché:

```bash
npx expo start -c --tunnel ngrok
```

---

## Conexión con el backend (Docker)

La app habla con **dos** servicios que se levantan con Docker Compose desde la raíz del repositorio (ver el README raíz, "Levantar todo con Docker"):

```bash
docker compose up -d        # backend :8000 y NLP :8001 (el ML no se publica ni se usa desde la app)
```

### 1. Variables de entorno

```bash
cd mobile
cp .env.example .env        # en Windows: copy .env.example .env
```

| Variable | Qué es | Ejemplo |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Backend de negocio (login, glucosa, historial, perfil). **Sin sufijo `/api`** | `http://TU-IP-LOCAL:8000` |
| `EXPO_PUBLIC_NLP_URL` | Servicio NLP (chatbot), URL **propia** | `http://TU-IP-LOCAL:8001` |
| `EXPO_PUBLIC_USE_MOCK` | `true` = modo simulado (ver abajo); cualquier otro valor = backend real | `false` |
| `EXPO_PUBLIC_CHAT_ANIMACION` | `escritura` = la respuesta del chatbot se revela por palabras (máx. 4 s) con «escribiendo…»; `inmediato` = todo de golpe y sin esperas. Siempre inmediato si el teléfono tiene «reducir movimiento» | `escritura` |

**La URL va SIN `/api`** (la app ya agrega `/api/...`). Ejemplo correcto: `EXPO_PUBLIC_API_URL=http://192.168.1.50:8000`; incorrecto: `http://192.168.1.50:8000/api` (formato del front web). Con el sufijo, la app pediría `/api/api/login` y el servidor respondería 404; `config.ts` lo quita solo, pero escríbela bien. Si ves "No se encontró el servicio solicitado… revisa la dirección del servidor", casi siempre es la URL base.

`mobile/.env` está en `.gitignore`: **nunca subas tu IP real**. Expo lee estas variables al arrancar: reinicia `npx expo start` (con `-c` si no las toma) cada vez que las cambies.

### 2. Apuntar a la PC (no sirve `localhost`)

En el celular `localhost` es el propio celular. Pon la **IP local de la PC** que corre Docker, con el celular en la **misma red Wi-Fi**:

1. En la PC: `ipconfig` (Windows) o `ifconfig`/`ip a` (Linux/macOS) y toma la "Dirección IPv4" de la red Wi-Fi.
2. Escríbela en `mobile/.env` (`EXPO_PUBLIC_API_URL=http://<esa IP>:8000`, `EXPO_PUBLIC_NLP_URL=http://<esa IP>:8001`). Si cambiaste `BACKEND_PORT` o `NLP_PORT` en el compose, usa esos puertos.
3. Si el celular no llega a la PC, revisa el firewall de Windows para los puertos 8000 y 8001 (red privada). Con `docker compose ps` comprueba que los servicios estén `healthy`.
4. Las llamadas son `http://` (solo desarrollo). En producción hará falta HTTPS (ver Open Questions de design.md).

### 3. Probar con Expo Go

1. `docker compose up -d` y `docker compose ps` (backend y NLP `healthy`).
2. `cd mobile && npm install && npx expo start`, y escanea el QR con Expo Go.
3. Inicia sesión con una cuenta real: correo y contraseña → te llega un **código de 6 dígitos por correo** → ingrésalo. (El backend envía el correo con las credenciales de su propio `backend/.env`.)
4. Sin cuenta o sin Supabase/correo reales, usa el modo simulado.

### Qué está conectado y qué queda deshabilitado

| Pantalla / flujo | Estado | Servicio |
|---|---|---|
| Inicio de sesión (correo + contraseña + OTP) | **Conectado** | backend: `POST /api/login`, `POST /api/verify-otp` |
| Nombre real del paciente tras el login | **Conectado** | backend: `GET /api/pacientes/perfil/{id}` (si falla, texto genérico) |
| Inicio del paciente (última toma, hoy, aviso, médico) | **Conectado** | backend: `GET /api/pacientes/registros/{id}` y el perfil |
| Registro de toma de glucosa (con alerta al médico si no es normal) | **Conectado** | backend: `GET /api/general/momentos`, `GET /api/registro/datosGlucosa/{id}`, `POST /api/pacientes/registrarGlucosa`, `POST /api/registro/registrarAlerta`; clasificación **en el celular** |
| Historial del paciente (periodos, promedio, gráfico) | **Conectado** | backend: `GET /api/pacientes/registros/{id}` |
| Perfil y ficha clínica del paciente (con semanas de embarazo) | **Conectado** | backend: `GET /api/pacientes/perfil/{id}`, `GET /api/pacientes/obtenerDatosEmbarazo/{id}` |
| Editar mis datos (paciente) | **Conectado** | backend: `PUT /api/pacientes/actualizarPaciente/{id_usuario}` |
| Solicitud de registro de **paciente** (con foto) | **Conectado** | backend: `GET /api/general/niveles`, `/enfermedades`, `/tratamientos`, `GET /api/medicos/ver`, `POST /api/pacientes/registrarPaciente` (multipart) |
| Chatbot | **Conectado** | NLP: `POST /api/chatbot/consulta` (solo envía el texto de la consulta) |
| Lista de pacientes del médico (búsqueda, filtros, estado por alertas activas) | **Conectado** | backend: `GET /api/medicos/misPacientes/{id_medico}`, `GET /api/medicos/alertasActivas/{id_medico}` |
| Detalle del paciente (datos, última toma, curva, registros, tratamientos) | **Conectado** | backend: datos de `misPacientes` y `GET /api/pacientes/registros/{id_paciente}` |
| Alertas activas y resueltas, y respuesta del médico | **Conectado** | backend: `GET /api/medicos/alertasActivas/{id}`, `GET /api/medicos/alertasResueltas/{id}`, `POST /api/medicos/responder/alerta` |
| Reportes (promedio, tiempo en rango 70-180, hipo/hiper, distribución; 7 o 30 días) y **PDF** | **Conectado**; el PDF se genera **en el celular** (no llama al backend) y se comparte con la hoja del sistema | backend: `GET /api/pacientes/registros/{id_paciente}` |
| Perfil y ficha del médico, y edición (teléfono, correo, departamento, carnet) | **Conectado** | backend: `GET /api/medicos/perfil/{id_usuario}`, `PUT /api/medicos/actualizar/{id_medico}` (multipart) |
| Solicitud de registro de **médico** (matrícula PDF y carnet imagen) | **Conectado** | backend: `GET /api/general/especialidades`, `POST /api/medicos/registrar` (multipart) |
| Perfil y ficha del administrador | **Conectado** | backend: `GET /api/administradores/perfilAdmin/{id_usuario}` |
| Administrador: solicitudes de pacientes y médicos (filtros) | **Conectado** | backend: `GET /api/administradores/{pacientes,medicos}/solicitantes` |
| Administrador: detalle de solicitud, documentos y **activar cuenta** | **Conectado** | backend: `PUT /api/administradores/{medico,paciente}/activar/{id}` con `{idAdmin}`; matrícula y carnet son URL de Storage que se abren con el navegador |
| Administrador: usuarios activos e inactivos (médicos, pacientes, administradores) | **Conectado** | backend: `GET .../{medicos,pacientes}/activos`, `GET .../obtenerAdmins/{id_admin}` y los solicitantes |
| Administrador: auditoría (filtros, KPIs, "Ver más") | **Conectado** | backend: `GET /api/general/auditoria` |

**Ninguna pantalla queda simulada** (`grep -rn "SIMULADO:" src/screens` no devuelve nada). `utils/mockData.ts` solo alimenta el **modo simulado** (`EXPO_PUBLIC_USE_MOCK=true`).

**Acciones deshabilitadas porque el backend no las ofrece** (se muestran con aviso, no se inventan):

| Acción | Motivo |
|---|---|
| Rechazar una solicitud | El backend solo tiene "activar"; el rechazo del front web solo simula el éxito |
| Cambiar el rol, desactivar o eliminar un usuario | No hay endpoints |
| Exportar la auditoría (CSV/PDF) | No hay endpoint |
| Agregar administradores | Existe `POST /administradores/agregar`, pero la app no tiene esa pantalla |

Tras la Fase Móvil 5 se **retiraron** los elementos estáticos que parecían funcionar y no hacían nada: el menú «Configuración y Seguridad» del perfil (notificaciones, biometría y portal médico no tienen servicio), el banner «Protocolo de Glucemia Activo / Ver Guía» del médico, el botón de exportar del historial del paciente, el botón «Cambiar» de la hora de la toma (siempre se usa la hora del dispositivo) y la campana del encabezado (no tiene destino). En la Fase Chatbot-Front también se retiraron del chatbot la tarjeta «Guía de carbohidratos», el botón de dictado y las marcas de «leído».

> [!WARNING]
> El backend **no emite ni exige token** (riesgo RB-01 en `docs/risks.md`): la app guarda solo `id_usuario`, `id_rol` y `rol` en el almacenamiento seguro del dispositivo y los borra al cerrar sesión. No lo expongas fuera de tu red con datos reales.

### Chatbot: efecto de escritura
El servicio NLP responde completo (no hay streaming): el efecto es solo de presentación. Mientras se espera aparece «escribiendo…» (tres puntos) y, al llegar la respuesta, se revela por palabras con un tope de **4 s** en total aunque el texto sea largo; tocar la respuesta la completa. Solo se anima la última respuesta recibida. El aviso médico («Consulta siempre a tu médico tratante…») se muestra siempre completo al terminar. Se desactiva con `EXPO_PUBLIC_CHAT_ANIMACION=inmediato` y es inmediato si el sistema tiene «reducir movimiento». La lógica está en `src/services/revelado.ts` (pura, con pruebas en `revelado.test.ts`). **No verificable sin celular:** la animación real, el scroll y el teclado.

### PDF del reporte del médico
Pantalla **Reportes** → **Descargar PDF**. Se genera en el dispositivo con `expo-print` (HTML → PDF) y se comparte o guarda con `expo-sharing` (hoja del sistema). Contiene nombre, edad y condición del paciente, periodo (7 o 30 días), resumen (promedio, mínimo, máximo, % en rango, hipoglucemias, hiperglucemias y n.º de lecturas), tabla de lecturas, alertas, fecha de generación y la leyenda de que es informativo y no reemplaza el criterio clínico. **No** incluye teléfono, correo, documento ni observaciones. Sin lecturas en el periodo el botón queda deshabilitado (no se genera un PDF vacío). No usa `POST /api/paciente/pdf` (motivos en design.md § Fase Móvil 5). El contenido se prueba con `src/services/reportePdf.test.ts`; **compartirlo en un celular no se pudo verificar sin dispositivo**.

### Umbrales clínicos
Todos viven en `src/services/umbrales.ts`: hipoglucemia (< 70), rango meta **70-180 mg/dL** (decisión del producto: consenso de tiempo en rango; antes el paciente veía 70-140), captura 20-600 y tres tomas diarias. Cambiar el rango es tocar un solo lugar. No cambian las alertas: las decide la clasificación por edad y tipo de `clasificacionGlucosa.ts` (pendiente de revisión clínica).

### Medidas y revisión de vistas
`src/utils/medidas.ts` reúne espaciados, radios, alturas y tamaños de fuente (cuerpo 14-16, títulos hasta 24, cifras hasta 40) y las funciones puras de escalado. El contenido se centra y no pasa de 600 dp de ancho (tablets), la barra inferior respeta la zona segura, los textos del sistema no crecen más de 1,3× y las cifras grandes se ajustan al ancho. Para revisar el aspecto sin celular: `EXPO_PUBLIC_USE_MOCK=true npx expo export --platform web` y abrir `dist` con un servidor estático (las dependencias `react-native-web`, `react-dom` y `@expo/metro-runtime` son solo para esta revisión). Las capturas de la fase están en `docs/integracion/capturas/`.

### Clasificación de glucosa en el celular

La app clasifica cada toma (hipoglucemia, normal, hiperglucemia) con una copia fiel de `glucosa.service.ts` del front web (`src/services/clasificacionGlucosa.ts`). Es una decisión del equipo con riesgos conocidos (lógica duplicada, rangos distintos de los que usa el chatbot, y tres rarezas del original que se conservaron a propósito); el detalle está en `design.md` § App móvil: integración. Si no se puede clasificar (por ejemplo, edad menor de 6 o tipo de paciente no reconocido), la toma se guarda **sin alerta** y la pantalla lo avisa.

> [!WARNING]
> **Datos de pacientes sin autenticación real (RB-01).** Las pantallas del médico leen pacientes y alertas con el `id_medico` de la sesión, pero el backend **no autentica**: cualquier cliente de la red puede pedir los datos de cualquier médico cambiando el id. Es aceptable **solo en una red local de desarrollo**; no expongas el backend fuera de ella con datos reales.

> [!WARNING]
> **Activar cuentas sin autenticación real (RB-01).** Las pantallas del administrador permiten **activar cuentas de médicos y pacientes** y leer la auditoría, pero el backend no autentica a quien llama: `activar` acepta cualquier `idAdmin` y cualquier cliente de la red puede hacerlo o leer los datos. Es aceptable **solo en una red local de desarrollo**; no expongas el backend fuera de ella.

### Notas sobre las pantallas del administrador

- **Activar** es lo único que el backend permite sobre una solicitud: pone la cuenta en estado activo y guarda qué administrador la activó. La app pide confirmación y bloquea el doble envío.
- **Documentos del médico:** matrícula (PDF) y carnet (imagen) son URL públicas de Storage. El carnet se previsualiza y ambos se abren con el navegador del teléfono (solo URL `http(s)`); no se instaló ninguna dependencia.
- **Usuarios:** "Inactivos" son las cuentas **pendientes de activación** (no existe desactivar). Los ids de médico, paciente y administrador se repiten entre sí; la app distingue las cuentas por rol.
- **Auditoría:** se oculta el nombre de las personas, la IP se enmascara (`a.b.c.xxx`) y los números de las rutas se sustituyen por `{id}`. **El servidor devuelve como máximo 1000 registros sin ordenar** (límite de Supabase en una consulta sin paginar), por lo que puede faltar actividad reciente; la app lo avisa y muestra los eventos de 20 en 20 en el teléfono.

### Notas sobre las pantallas del médico

- **El estado de cada paciente sale de sus alertas activas.** `misPacientes` no devuelve lecturas; "En riesgo" significa "tiene al menos una alerta activa".
- **Responder una alerta** pide confirmación y la pasa a "Resueltas". El backend no impide responder dos veces la misma alerta (duplicaría la respuesta): la app bloquea el doble envío.
- **Registro de médico:** la matrícula es un **PDF de hasta 5 MB** y el carnet una imagen **JPG o PNG de hasta 2 MB**; todo se valida en el celular antes de enviar, porque el backend sube los archivos antes de revisar el resto. El teléfono tiene 8 dígitos. El backend no guarda un estado "pendiente": si no puedes iniciar sesión tras registrarte, tu cuenta puede estar pendiente de aprobación.
- **Edición del médico:** solo se envían los campos que cambiaron y no están vacíos (el backend borra el dato si recibe una cadena vacía).
- **No hay pantalla para que el médico registre una toma a un paciente** (existe `POST /api/medicos/registrar/glucosa` en el backend, pero no se creó la pantalla).

### Notas sobre el registro y la edición del paciente

- **La foto de perfil es obligatoria**: así lo exige el backend (`registrarPaciente` responde 400 sin ella). Se elige de la galería (JPG o PNG) con `expo-image-picker`.
- **Teléfonos de 7 u 8 dígitos** y fecha de nacimiento como `AAAA-MM-DD` (reglas pendientes de confirmar con el equipo). **La altura se escribe en centímetros (50 a 250)**, pero la base la guarda en **metros** (`numeric(4,2)`): la app la envía como `1.70` y la convierte de vuelta al mostrarla.
- **Editar datos** envía siempre los siete campos que exige el backend (nombre, altura, peso, teléfono, correo y contacto de emergencia) aunque solo cambies uno, y los datos de embarazo solo si cambia el estado. Cambiar el correo cambia el correo de inicio de sesión.
- **Si el envío falla en el celular:** en la terminal de `npx expo start` (solo en desarrollo) verás `[http] POST … -> FALLO Nombre: mensaje`, `[registro-paciente] adjunto: tipo=… bytes=…` y, si no llegó al servidor, `sonda sin archivo: OK/FALLO`. La sonda envía un multipart sin archivo y sin datos personales: si responde OK (400 del servidor), la red y el multipart funcionan y el problema está en el archivo. Nunca se registran correos, contraseñas, rutas de archivo ni contenido.
- **Errores 500 del servidor:** el backend devuelve la causa en `error`/`details`, que la app oculta al usuario. En desarrollo, la terminal de Expo muestra `[http] POST … -> 500 error="…" details="…"` con correos, teléfonos, números largos, contraseñas, hashes, filas de Postgres, URLs y rutas de archivos reemplazados por `<dato>`, truncado a 300 caracteres. Nunca se registra el cuerpo de la petición. En producción no se registra nada.
- **Nota técnica:** en Expo SDK 58 el `fetch` global no admite archivos locales en un `FormData`; por eso los envíos multipart usan `XMLHttpRequest`.
- Las contraseñas solo existen en el formulario y se descartan al enviar; el almacenamiento seguro guarda únicamente `id_usuario`, `id_rol` y `rol`.

## Modo simulado (sin backend)

Con `EXPO_PUBLIC_USE_MOCK=true` la app no llama a ningún servidor: vuelven las credenciales fijas y los botones de **acceso rápido** por rol, y el registro, el historial y el chatbot usan datos locales. Útil para demostrar sin Docker.

| Rol | Correo electrónico | Contraseña | Pantallas y Flujos Disponibles |
| :--- | :--- | :--- | :--- |
| **Paciente** | `carlos@email.com` | `12345` | **Inicio**, **Historial**, **ChatBot**, **Perfil**, registro de toma. |
| **Médico** | `doctor@email.com` | `12345` | **Pacientes**, **Detalle de Paciente**, **Alertas**, **Reportes**, **Perfil**. |
| **Administrador** | `admin@email.com` | `12345` | **Solicitudes**, **Detalle de Solicitud**, **Usuarios**, **Auditoría**, **Perfil**. |

Estas credenciales **no existen en el backend real**: sin la bandera, no entran.

## Pruebas

```bash
npm test                    # node --test (Node >= 22.18, sin dependencias nuevas): clasificación, umbrales y medidas, PDF, robustez, cliente HTTP, config, perfil, edición, registro (multipart), administrador y flujos con fetch simulado
npx tsc --noEmit            # tipado
npx expo export --platform android --output-dir "$TMPDIR/export"   # comprueba que el bundle compila sin dispositivo
```

Qué **no** cubren: el OTP real por correo, el registro real de glucosa, el `PUT` de edición, el `POST` de registro de paciente y de médico, `responder/alerta` y la edición del médico en Supabase, la **activación real de cuentas**, los selectores de fotos y de PDF y el comportamiento en un celular (requieren cuenta, correo, Supabase y dispositivo reales).

## Identificadores de prueba (`testID`)

Estables y en español, para pruebas de interfaz (p. ej. Maestro o Detox). No afectan al diseño ni a la lógica.

| Pantalla | `testID` | Elemento |
| :--- | :--- | :--- |
| Login | `login-correo` | Campo de correo |
| | `login-contrasena` | Campo de contraseña |
| | `login-ingresar` | Botón "Iniciar sesión" |
| | `login-error` | Mensaje de error del paso 1 (aparece bajo el correo) |
| | `login-otp` | Campo del código de 6 dígitos |
| | `login-verificar` | Botón "Verificar código" |
| | `login-otp-error` | Mensaje de error del paso del código |
| | `login-volver` | Botón "Volver" del paso del código |
| | `login-solicitar-registro` | Enlace "Solicitar registro" |
| | `login-mock-paciente`, `login-mock-medico`, `login-mock-admin` | Accesos rápidos (solo con `EXPO_PUBLIC_USE_MOCK=true`) |
| Registro de toma | `registro-cargando` | Indicador de carga de momentos y datos del paciente |
| | `registro-error-carga`, `registro-reintentar` | Error de carga y botón "Reintentar" |
| | `registro-valor` | Campo del nivel de glucosa (dígitos) |
| | `registro-menos`, `registro-mas` | Botones − y + del valor |
| | `registro-momento-ayunas`, `registro-momento-despues`, `registro-momento-dormir` | Selector de momento |
| | `registro-enviar` | Botón "Guardar toma" |
| | `registro-error` | Mensaje de error (validación o servidor) |
| | `registro-confirmacion`, `registro-confirmar`, `registro-cancelar` | Modal de confirmación y sus botones |
| | `registro-resultado` | Modal de resultado |
| | `registro-resultado-estado`, `registro-resultado-mensaje` | Etiqueta de clasificación y texto del resultado |
| | `registro-resultado-cerrar` | Botón "Volver al inicio" del modal |
| Historial | `historial-periodo-diario`, `historial-periodo-semanal`, `historial-periodo-mensual` | Selector de periodo |
| | `historial-vista-grafico`, `historial-vista-lista` | Cambio de vista |
| | `historial-rango`, `historial-promedio`, `historial-desviacion`, `historial-tir` | Rango, promedio, desviación y TIR |
| | `historial-cargando`, `historial-vacio`, `historial-error`, `historial-reintentar` | Estados de carga, vacío y error |
| | `historial-toma-<id>` | Cada registro de la lista |
| Inicio (paciente) | `inicio-fecha`, `inicio-saludo` | Fecha de hoy y saludo con el nombre real |
| | `inicio-en-rango` | Etiqueta "En rango hoy" / "Fuera de rango hoy" |
| | `inicio-registrar-toma` | Botón "Registrar toma" |
| | `inicio-cargando`, `inicio-vacio`, `inicio-error`, `inicio-reintentar` | Estados de carga, vacío y error |
| | `inicio-ultima-toma`, `inicio-ultima-valor` | Tarjeta y valor de la última toma |
| | `inicio-aviso` | Aviso preventivo (solo si hay lecturas fuera de rango en 3 días) |
| | `inicio-actividad`, `inicio-tomas-hoy`, `inicio-promedio-hoy`, `inicio-ver-desglose` | Actividad de hoy |
| | `inicio-lecturas-anteriores`, `inicio-medico` | Lecturas anteriores y médico asignado |
| Perfil | `perfil-foto`, `perfil-nombre`, `perfil-correo`, `perfil-telefono` | Cabecera del perfil |
| | `perfil-ficha`, `perfil-ficha-error` | Ficha clínica y su error |
| | `perfil-condicion`, `perfil-tratamientos`, `perfil-medico`, `perfil-embarazo`, `perfil-en-rango` | Datos de la ficha |
| | `perfil-editar`, `perfil-cerrar-sesion` | Botones "Editar mis datos" y "Cerrar sesión" |
| | `perfil-cargando`, `perfil-reintentar`, `login-aviso` | Perfil cargando o con error y reintento; aviso en el login (sesión guardada que ya no es válida) |
| Editar datos | `editar-nombre`, `editar-correo`, `editar-telefono`, `editar-altura`, `editar-peso` | Campos personales y medidas |
| | `editar-emergencia-nombre`, `editar-emergencia-numero` | Contacto de emergencia |
| | `editar-embarazo-si`, `editar-embarazo-no`, `editar-semanas`, `editar-fecha-terminacion` | Embarazo |
| | `editar-<campo>-error` | Mensaje de error de cada campo (p. ej. `editar-correo-error`) |
| | `editar-aviso`, `editar-guardar`, `editar-cancelar` | Aviso, guardar y cancelar |
| | `editar-confirmacion` (`-mensaje`, `-confirmar`, `-cancelar`) | Modal de confirmación |
| | `editar-resultado` (`-mensaje`, `-confirmar`) | Modal de éxito o error |
| Solicitud de registro (paciente) | `registro-paciente-cargando`, `registro-paciente-error-carga`, `registro-paciente-reintentar` | Carga de catálogos |
| | `registro-paciente-form` | Formulario |
| | `registro-paciente-nombre`, `-correo`, `-contrasena`, `-fecha-nac`, `-telefono`, `-peso`, `-altura`, `-dosis`, `-semanas` | Campos de texto (prefijo `registro-paciente`) |
| | `registro-paciente-emergencia-nombre`, `registro-paciente-emergencia-numero` | Contacto de emergencia |
| | `registro-paciente-genero-Masculino`, `registro-paciente-genero-Femenino`, `registro-paciente-embarazada-si`, `registro-paciente-embarazada-no` | Género y embarazo |
| | `registro-paciente-medico-<id>`, `-actividad-<id>`, `-afeccion-<id>`, `-tratamiento-<id>` | Opciones de catálogo (prefijo `registro-paciente`) |
| | `registro-paciente-foto`, `registro-paciente-foto-elegir`, `registro-paciente-foto-error` | Foto de perfil |
| | `registro-paciente-<campo>-error` | Error de cada campo (p. ej. `registro-paciente-correo-error`) |
| | `registro-paciente-error`, `registro-paciente-enviar` | Error general y botón "Enviar solicitud" |
| | `registro-paciente-exito`, `registro-paciente-exito-cerrar` | Modal de éxito |
| Pacientes del médico | `medico-buscar`, `medico-filtro-todos`, `medico-filtro-riesgo`, `medico-filtro-estables` | Búsqueda y filtros |
| | `medico-actualizar`, `medico-subtitulo`, `medico-metricas`, `medico-metrica-total`, `medico-metrica-urgentes` | Recarga, subtítulo y métricas |
| | `medico-cargando`, `medico-vacio`, `medico-sin-resultados`, `medico-error`, `medico-reintentar`, `medico-error-alertas` | Estados |
| | `medico-paciente-<id>` | Tarjeta de cada paciente |
| Detalle del paciente | `detalle-volver`, `detalle-cabecera`, `detalle-nombre`, `detalle-condicion`, `detalle-telefono`, `detalle-ultima-toma` | Cabecera |
| | `detalle-telemetria`, `detalle-ultima-valor`, `detalle-curva`, `detalle-periodo-semanal`, `detalle-periodo-mensual`, `detalle-curva-vacia` | Telemetría y curva |
| | `detalle-registros`, `detalle-registro-<id>`, `detalle-tratamientos`, `detalle-reporte` | Registros, tratamientos y botón de reporte |
| | `detalle-cargando`, `detalle-vacio`, `detalle-error`, `detalle-reintentar` | Estados |
| Alertas | `alertas-pestana-activas`, `alertas-pestana-resueltas`, `alertas-filtro-todas`, `alertas-filtro-hipo`, `alertas-filtro-hiper` | Pestañas y filtros |
| | `alertas-banner`, `alertas-banner-cerrar`, `alertas-exito`, `alertas-alerta-<id>` | Aviso, éxito y tarjetas |
| | `alertas-cargando`, `alertas-vacio`, `alertas-error-carga`, `alertas-reintentar` | Estados |
| | `alertas-modal`, `alertas-modal-paciente`, `alertas-modal-respuesta`, `alertas-respuesta`, `alertas-enviar` | Modal de detalle y respuesta |
| | `alertas-confirmacion-texto`, `alertas-confirmar`, `alertas-revisar`, `alertas-ver-paciente`, `alertas-cerrar`, `alertas-error` | Confirmación y errores |
| Reportes | `reportes-cambiar-paciente`, `reportes-paciente`, `reportes-rango`, `reportes-modal-pacientes`, `reportes-paciente-<id>`, `reportes-modal-cerrar` | Selección de paciente y rango |
| | `reportes-metricas`, `reportes-promedio`, `reportes-tir`, `reportes-hipo`, `reportes-hiper`, `reportes-distribucion` | Métricas |
| | `reportes-cargando`, `reportes-vacio`, `reportes-sin-pacientes`, `reportes-error`, `reportes-reintentar`, `reportes-pdf`, `reportes-pdf-aviso`, `reportes-pdf-error` | Estados y PDF (`reportes-pdf` se habilita con lecturas en el periodo) |
| Perfil del médico | `perfil-medico-ficha`, `perfil-medico-error`, `perfil-medico-especialidad`, `perfil-medico-departamento`, `perfil-medico-matricula`, `perfil-medico-carnet`, `medico-editar` | Ficha y botón de edición |
| Edición del médico | `medico-editar-telefono`, `medico-editar-correo`, `medico-editar-departamento`, `medico-editar-carnet`, `medico-editar-carnet-vista`, `medico-editar-carnet-error` | Campos y carnet |
| | `medico-editar-aviso`, `medico-editar-guardar`, `medico-editar-cancelar` | Aviso y botones |
| | `medico-editar-confirmacion` (`-mensaje`, `-confirmar`, `-cancelar`), `medico-editar-resultado` (`-mensaje`, `-confirmar`) | Modales |
| Solicitud de registro (médico) | `registro-medico-cargando`, `registro-medico-error-carga`, `registro-medico-reintentar`, `registro-medico-form` | Carga de especialidades |
| | `registro-medico-nombre`, `registro-medico-correo`, `registro-medico-contrasena`, `registro-medico-fecha-nac`, `registro-medico-telefono`, `registro-medico-departamento` | Campos de texto |
| | `registro-medico-especialidad-<id>` | Opciones de especialidad |
| | `registro-medico-matricula`, `registro-medico-matricula-nombre`, `registro-medico-matricula-error`, `registro-medico-carnet`, `registro-medico-carnet-nombre`, `registro-medico-carnet-error` | Archivos |
| | `registro-medico-error`, `registro-medico-enviar` | Error general y botón "Enviar solicitud" |
| Solicitudes (administrador) | `solicitud-banner`, `solicitud-pendientes`, `solicitud-filtro-todos`, `solicitud-filtro-pacientes`, `solicitud-filtro-medicos` | Aviso y filtros |
| | `solicitud-<rol>-<id>` (p. ej. `solicitud-medico-4`, `solicitud-paciente-2`; en minúsculas y sin tildes, con `normalizarTestId`) | Tarjeta de cada solicitud |
| | `solicitud-cargando`, `solicitud-vacio`, `solicitud-error`, `solicitud-reintentar` | Estados |
| Detalle de solicitud | `solicitud-volver`, `solicitud-datos`, `solicitud-nombre` | Cabecera y datos |
| | `solicitud-documentos`, `solicitud-abrir-matricula`, `solicitud-sin-matricula`, `solicitud-carnet-vista`, `solicitud-abrir-carnet`, `solicitud-sin-carnet`, `solicitud-doc-error` | Documentos del médico |
| | `solicitud-activar`, `solicitud-rechazar`, `solicitud-rechazar-aviso` | Acciones (rechazar deshabilitado) |
| | `solicitud-confirmacion` (`-mensaje`, `-confirmar`, `-cancelar`), `solicitud-resultado` (`-mensaje`, `-confirmar`) | Modales de confirmación y resultado |
| Usuarios (administrador) | `admin-buscar`, `admin-filtro-todos`, `admin-filtro-activos`, `admin-filtro-inactivos` | Búsqueda y filtros |
| | `admin-usuario-<rol>-<id>` (p. ej. `admin-usuario-medico-4`, normalizado) | Tarjeta de cada usuario |
| | `admin-cargando`, `admin-vacio`, `admin-error`, `admin-reintentar`, `admin-parcial` | Estados |
| | `admin-modal`, `admin-modal-nombre`, `admin-modal-aviso`, `admin-modal-error`, `admin-modal-cerrar`, `admin-cerrar` | Modal de gestión |
| | `admin-activar`, `admin-activar-confirmar`, `admin-activar-cancelar` | Activar una cuenta pendiente |
| Auditoría | `auditoria-actualizar`, `auditoria-fecha`, `auditoria-filtro-todos`, `auditoria-filtro-accesos`, `auditoria-filtro-modificaciones` | Recarga y filtros |
| | `auditoria-kpis`, `auditoria-kpi-hoy`, `auditoria-kpi-errores`, `auditoria-kpi-total`, `auditoria-cantidad`, `auditoria-truncado` | KPIs y aviso de límite |
| | `auditoria-evento-<id>`, `auditoria-ver-mas` | Eventos y carga parcial |
| | `auditoria-cargando`, `auditoria-vacio`, `auditoria-error`, `auditoria-reintentar`, `auditoria-exportar`, `auditoria-exportar-aviso` | Estados y exportación deshabilitada |
| Perfil del administrador | `perfil-admin-ficha`, `perfil-admin-error`, `perfil-admin-cargo`, `perfil-admin-ingreso`, `perfil-admin-admitido` | Ficha |
| Chatbot | `chat-entrada` | Campo de la consulta |
| | `chat-enviar` | Botón de envío |
| | `chat-mensaje-usuario-<n>`, `chat-mensaje-asistente-<n>` | Mensajes del chat (`<n>` = posición en la conversación, desde 0) |
| | `chat-cargando`, `chat-escribiendo` | Contenedor y indicador «escribiendo…» (solo mientras se espera la respuesta) |
| | `chat-respuesta`, `chat-aviso-medico` | Texto de la respuesta del asistente y aviso médico final (siempre completo al terminar) |
| | `chat-sugerencia-<1..3>` | Consultas sugeridas: envían una pregunta completa al servicio |
| | `chat-error` | Mensaje de error (422, 429, red, servicio no disponible) |
| | `chat-aviso` | Aviso fijo de que el asistente no reemplaza al médico |

## Flujo de Solicitud de Registro

Desde la pantalla de inicio de sesión, presiona **"Solicitar registro"** para acceder al formulario:
- Alterna entre el perfil **Paciente** y **Médico** (el rol médico despliega el campo obligatorio de *Matrícula profesional*).
- Al presionar **"Enviar solicitud"**, se presenta la confirmación para revisión del administrador y la opción de volver al inicio de sesión.

