# Recorridos E2E con Maestro (Expo Go en Android)

Decisión y riesgos: [ADR-0012](adr/0012-interruptor-otp-pruebas-e2e.md). Diseño: `design.md` § Pruebas E2E y interruptor de OTP. Los recorridos viven en `mobile/.maestro/`.

> **Estado.** Los flujos están escritos y su YAML es válido, pero **todavía no se han ejecutado en un teléfono**: no se declara que pasen. Solo se pueden ejecutar con el teléfono y Maestro instalados.

## 1. Qué necesitas instalar (no se instala nada por ti)

| Herramienta | Para qué | Notas |
|---|---|---|
| **Java 17 o superior** | Maestro corre sobre la JVM | `java -version` |
| **adb** (Android platform-tools) | Hablar con el teléfono por USB y el túnel `adb reverse` | Suele estar en `%LOCALAPPDATA%\Android\Sdk\platform-tools`; los scripts lo buscan en el `PATH`, en `ANDROID_HOME`/`ANDROID_SDK_ROOT` y en esa ruta |
| **Maestro CLI** | Ejecutar los flujos | Instalación oficial: <https://docs.maestro.dev>. Los scripts lo buscan en el `PATH` y en `%USERPROFILE%\.maestro\bin` |
| **Expo Go** actualizada en el teléfono | Abrir la app (SDK 58) | Play Store |
| **Node 22.18+** y `npm install` en `mobile/` | Metro | Ya requerido por el proyecto |
| **Docker** | Solo para la suite B (backend real local) | `docker compose` |

Comprueba lo que ya tienes: `java -version`, `adb version`, `maestro --version`.

## 2. Conectar el teléfono

1. En el teléfono: Ajustes → Acerca del teléfono → toca 7 veces «Número de compilación» → Opciones de desarrollador → **Depuración USB**.
2. Conéctalo por USB y acepta el aviso «¿Permitir depuración USB?».
3. `adb devices` debe mostrar el dispositivo en estado **`device`** (no `unauthorized` ni `offline`). Debe haber **un solo** dispositivo.

## 3. Cómo se abre la app (Expo Go)

Con Expo Go **no se usa `launchApp` con un appId propio** (la documentación de Maestro para React Native lo indica: la app corre dentro del contenedor de Expo). Los flujos declaran `appId: host.exp.exponent` (el paquete de Expo Go en Android) y abren la app con `openLink` y la URL de desarrollo en la variable `EXPO_URL` (`exp://<IP de la PC>:8081`). Las pantallas propias de Expo Go (aviso de primera vez, menú de desarrollo) se descartan con `runFlow` + `when: visible` solo si aparecen. La URL **nunca** se escribe en el repositorio.

### Dos modalidades de conexión

**A. Por la red (URL manual).** La app se abre con `exp://<IP de la PC>:8081`. Depende de que la red permita que el teléfono vea la PC (la red de una universidad suele bloquearlo). La IP la ves con `ipconfig` (IPv4 de la red con puerta de enlace).

**B. Por el cable (`adb reverse`).** Para el backend (8000) y el chatbot (8001) se crean túneles USB y la app usa `http://127.0.0.1:8000` y `http://127.0.0.1:8001` (sin barra final ni `/api`):

```powershell
adb reverse tcp:8000 tcp:8000
adb reverse tcp:8001 tcp:8001
adb reverse --list        # deben aparecer los dos
```

Receta que funcionó en el equipo del autor (comparte internet del teléfono con la PC y a veces está en la red de la universidad): Metro se arranca con `npx expo start -c --port 8081` (**sin** `--localhost` y con el 8081 fijo), la app se abre con la URL manual `exp://<IP de la PC>:8081`, y el backend y el chatbot se alcanzan por USB con `adb reverse`.

### Síntomas conocidos

| Síntoma | Causa y salida |
|---|---|
| Spinner infinito al abrir el proyecto que Expo Go autodetecta | La autodetección no funcionó: abre la URL manual `exp://<IP de la PC>:8081` (los flujos ya lo hacen con `openLink`) |
| `exp://127.0.0.1:8081` no responde | No lo uses con Expo Go en este equipo; usa la IP de la PC en la red |
| Metro no responde con `--localhost` | No uses `--localhost`: arranca con `npx expo start -c --port 8081` (lo hace `iniciar-expo.ps1`) |
| La app no llega al backend o al chatbot tras desconectar el cable | El túnel `adb reverse` se pierde al desconectar el USB: vuelve a ejecutarlo (los scripts lo repiten) |
| `ejecutar-suite.ps1` dice «Metro no responde en http://…/status» aunque Metro sí responde | **Problema conocido (corregido).** En Windows PowerShell 5.1, `Invoke-WebRequest` devuelve `Content` como arreglo de bytes (`{112, 97, 99, 107…}`), no como texto, y la comparación con `packager-status:running` fallaba. Ahora el script convierte los bytes a texto (UTF-8) y también acepta un `200` con la cabecera `X-React-Native-Project-Root`. Para comprobarlo a mano: `Invoke-WebRequest -UseBasicParsing http://<IP de la PC>:8081/status` debe dar `StatusCode 200` |
| `ejecutar-suite.ps1` falla con `InvalidPathException: Illegal char <:> at index 8: Paciente: iniciar sesión…` (`TestDebugReporter.createFlowDir`) | **Problema conocido (corregido).** Maestro crea una carpeta de reporte con el `name` de cada flujo y Windows no admite `: \ / * ? " < > \|` ni nombres que terminen en espacio o punto. Los `name` ahora usan « - » en lugar de dos puntos, y el script comprueba los nombres de todos los flujos y subflujos antes de ejecutar y falla indicando archivo y nombre. **Regla para flujos nuevos:** en `name` no uses esos caracteres ni termines en espacio o punto (las tildes y las eñes sí valen) y mantén los nombres únicos; las etiquetas, los `takeScreenshot` y los nombres de archivo siguen la misma regla |
| `adb devices` muestra `unauthorized` | Acepta la autorización de depuración en el teléfono |
| Los flujos no encuentran un elemento | Revisa que Metro se arrancó en el modo correcto (simulado o real) y que la app terminó de cargar |

## 4. Scripts (PowerShell, desde `mobile/`)

Todos reciben la URL de Expo con `-ExpoUrl exp://<IP de la PC>:8081` o, si no se pasa, intentan **detectar la IPv4 de la PC en tiempo de ejecución sin guardarla en ningún archivo**; si no pueden, piden el parámetro. Antes de lanzar Maestro comprueban que `adb devices` ve un dispositivo en estado `device` y que Metro responde en `GET /status` (con un tiempo de espera de 5 s; el mensaje de error indica la URL `http://…/status` que se probó); si no, fallan con un mensaje claro.

| Script | Qué hace |
|---|---|
| `.maestro\scripts\iniciar-expo.ps1 -Modo simulado\|real [-ConOtpSimulado]` | Arranca Metro (`npx expo start -c --port 8081`). `simulado` activa `EXPO_PUBLIC_USE_MOCK=true`; `real` crea los `adb reverse` y fija las URLs `127.0.0.1`. Falla si el 8081 está ocupado. **Deja esa ventana abierta.** |
| `.maestro\scripts\ejecutar-suite.ps1 -Suite A\|B [-ExpoUrl ...] [-Flujo nombre] [-Etiquetas tag] [-ConOtpSimulado]` | Ejecuta la suite con `maestro test`, con reporte JUnit y artefactos en `.maestro\reports\` |
| `npm run e2e:expo-mock`, `e2e:expo-real`, `e2e:mock`, `e2e:real` | Atajos a los anteriores (sin dependencias nuevas) |

Si PowerShell bloquea los scripts, usa `powershell -ExecutionPolicy Bypass -File ...` (los atajos de `npm` ya lo hacen).

## 5. Suite A — modo simulado (la principal)

No llama a ningún servidor ni escribe en nada real. Pasos:

1. Ventana 1: `cd mobile` y `powershell -ExecutionPolicy Bypass -File .maestro\scripts\iniciar-expo.ps1 -Modo simulado`.
2. Ventana 2: `powershell -ExecutionPolicy Bypass -File .maestro\scripts\ejecutar-suite.ps1 -Suite A -ExpoUrl exp://<IP de la PC>:8081`.

| Flujo | Etiquetas | Qué recorre |
|---|---|---|
| `01-paciente-login` | smoke, paciente, login | Login con credenciales simuladas |
| `02-paciente-glucosa-normal` | paciente, glucosa | Registro de 100 mg/dL en ayunas |
| `03-paciente-glucosa-baja-alerta` | paciente, glucosa, alerta | 60 mg/dL con el aviso de alerta al médico |
| `04-paciente-historial` | paciente, historial | Gráfico, lista y periodo mensual |
| `05-paciente-chatbot` | paciente, chatbot, smoke | Pregunta, respuesta y aviso médico visible |
| `06-medico-pacientes-detalle` | smoke, medico | Lista de pacientes y detalle |
| `07-medico-toma-con-riesgo` | medico, ml | Toma `111` → «17,1 %», versión y leyenda; `118` → «0,0 %»; `119` → «100,0 %» |
| `08-medico-toma-sin-riesgo` | medico, ml | `112` a `117`: solo título y leyenda; sin `ml-riesgo-valor` ni versión |
| `09-medico-toma-ml-apagado` | medico, ml | `110`: sin `riesgo_ml`, el bloque no existe |
| `10-medico-toma-baja-alerta-y-riesgo` | medico, ml, alerta | `61`: el aviso de la alerta va primero y el bloque de riesgo aparece |
| `11-medico-responde-alerta` | medico, alerta | Detalle, respuesta, confirmación y éxito |
| `12-admin-solicitudes-activar-auditoria` | admin, smoke | Solicitudes, detalle, activar (simulado) y auditoría |
| `13-registro-paciente-validaciones` | registro, paciente | Formulario vacío: se muestran los errores y no se envía |
| `14-registro-medico-validaciones` | registro, medico | Ídem para médico |
| `15-login-otp-simulado` | otp, login | OTP simulado (código `123456`); **solo con** `-ConOtpSimulado` en ambos scripts |

**Casos del riesgo (última cifra de la glucosa):** `0` sin `riesgo_ml` · `1` con riesgo (17,1 %) · `2` un faltante · `3` varios faltantes · `4` sin faltantes · `5` no aplica el tipo · `6` momento no cubierto · `7` no disponible · `8` riesgo 0 · `9` riesgo 1. El bloque solo muestra título, porcentaje, versión y leyenda: los `testID` `ml-riesgo-motivo`, `-faltantes` y `-supuestos` **ya no existen** y no se usan.

## 6. Suite B — backend real local, SOLO LECTURA

1. Levanta el backend de prueba (sin OTP, chatbot con proveedor falso): `docker compose -f docker-compose.yml -f docker-compose.prueba.yml up -d --build`.
2. Crea las credenciales de **cuentas de prueba** (nunca reales ni de un paciente real): copia `mobile\.maestro\env.e2e.ejemplo` a `mobile\.maestro\.env.e2e.local` (ignorado por git) y complétalo, o define `PACIENTE_CORREO`, `PACIENTE_CLAVE`, `MEDICO_CORREO` y `MEDICO_CLAVE` como variables de entorno de PowerShell.
3. Ventana 1: `powershell -ExecutionPolicy Bypass -File .maestro\scripts\iniciar-expo.ps1 -Modo real`.
4. Ventana 2: `powershell -ExecutionPolicy Bypass -File .maestro\scripts\ejecutar-suite.ps1 -Suite B -ExpoUrl exp://<IP de la PC>:8081`.

Flujos: `01-paciente-login-historial`, `02-paciente-chatbot-proveedor-falso` y `03-medico-pacientes-detalle`. **Prohibido en esta suite:** registrar glucosa, activar cuentas, editar y responder alertas; el script se niega a correr si un flujo usa controles que escriben.

**Advertencias:**
- **El login real escribe una fila de auditoría en Supabase** (el backend la inserta en cada login, también con la app normal). No es algo que controlen los flujos; si el equipo no lo acepta, no ejecutes la suite B.
- Maestro puede mostrar en su salida el valor de las variables `-e` (correo y contraseña): usa **solo cuentas de prueba**.
- El `docker-compose.prueba.yml` desactiva el OTP (`OTP_ACTIVADO=false`): **no lo uses fuera de pruebas** (ADR-0012).

## 7. Ejecutar un flujo, por etiqueta, y ver reportes

```powershell
# un solo flujo (basta un fragmento del nombre)
powershell -ExecutionPolicy Bypass -File .maestro\scripts\ejecutar-suite.ps1 -Suite A -ExpoUrl exp://<IP de la PC>:8081 -Flujo 07-medico
# por etiqueta (--include-tags)
powershell -ExecutionPolicy Bypass -File .maestro\scripts\ejecutar-suite.ps1 -Suite A -ExpoUrl exp://<IP de la PC>:8081 -Etiquetas smoke
```

Cada ejecución genera `.maestro\reports\<suite>-<fecha>.xml` (JUnit, `maestro test --format junit --output ...`) y una carpeta con las capturas y los registros (`--test-output-dir`). Las capturas de los pasos clave (`takeScreenshot`) quedan en `.maestro\screenshots\`. Estas carpetas están **ignoradas por git**.

## 8. Limitaciones de Expo Go

- No hay `launchApp` con un paquete propio ni `clearState` útil: borrar el estado limpiaría Expo Go entero. Por eso cada flujo **cierra la sesión** al empezar (`subflows/preparar.yaml`) y al terminar.
- El teclado de Android puede tapar controles (síntoma: «Element not found: Id matching regex: login-ingresar» con el botón ausente de la jerarquía mientras se ve el teclado). Tras escribir, los flujos cierran el teclado con `hideKeyboard`, hacen `scrollUntilVisible` hasta el botón y esperan que sea visible antes de tocarlo; `hideKeyboard` en Android puede equivaler a «atrás», por eso solo se usa justo después de `inputText`.
- El primer arranque descarga el paquete de JavaScript: la espera inicial es larga (hasta 2 min).
- Los textos de las pantallas propias de Expo Go dependen del idioma del teléfono (`Continue`/`Continuar`, `Go home`/`Ir al inicio`).
- La conexión depende de la red (ver § 3).

## 8.1 Rutas y estado de partida

**Regla.** Cada flujo parte del login (`subflows/preparar.yaml`) y termina volviendo a una pantalla con barra de pestañas antes de cerrar sesión: `cerrar-sesion.yaml` llama primero a `subflows/volver-a-pestanas.yaml`. Los flujos que terminan dentro de una pantalla interna también lo llaman al final.

| Rol | Pestañas (`nav-…`) | Pantallas internas (SIN barra de pestañas) | Cómo se vuelve |
|---|---|---|---|
| Paciente | `nav-inicio`, `nav-historial`, `nav-chatbot`, `nav-perfil` | Registro de toma; edición de datos | Tras el modal de resultado, `registro-resultado-cerrar`; `header-volver` |
| Médico | `nav-pacientes`, `nav-alertas`, `nav-reportes`, `nav-perfil` | Detalle del paciente; registro de toma por el médico; edición del médico | `detalle-volver`; `header-volver`; el modal de resultado se cierra con `medico-toma-resultado-confirmar` y **deja en el detalle** |
| Administrador | `nav-solicitudes`, `nav-usuarios`, `nav-auditoria`, `nav-perfil` | Detalle de solicitud | `solicitud-volver` |

En las pantallas internas `nav-<pestaña>` **no existe** y el avatar del encabezado (`header-perfil`) no ayuda: con un paciente seleccionado, la pantalla interna tiene prioridad sobre la pestaña activa. Por eso el médico que termina en el detalle no llega a Perfil sin volver antes.

`volver-a-pestanas.yaml` hace hasta 4 intentos con esperas cortas: cierra modales por `testID` (`medico-toma-resultado-confirmar`, `registro-resultado-cerrar`, `alertas-cerrar`, `solicitud-resultado-confirmar`, `admin-modal-cerrar`, `reportes-modal-cerrar`, `perfil-cerrar-sesion-confirmacion-cancelar`, `editar-resultado-confirmar`, `medico-editar-resultado-confirmar`, `registro-paciente-exito-cerrar`, `alertas-banner-cerrar`), toca el botón atrás de la app (`header-volver`, `detalle-volver`, `solicitud-volver`) y, solo en el último intento, «atrás» del sistema. Si ya se ve la barra o el login, no hace nada; si no lo consigue, falla a los 8 s.

| Flujo | Pantalla final | ¿Riesgo? | Arreglo |
|---|---|---|---|
| 01 login | Inicio (pestaña) | No | — |
| 02, 03 glucosa | Inicio, tras `registro-resultado-cerrar` | No | — |
| 04 historial, 05 chatbot | Pestaña | No | — |
| 06 pacientes y detalle | **Detalle del paciente** | **Sí** | `volver-a-pestanas` al final y dentro de `cerrar-sesion` |
| 07, 08, 09, 10 toma del médico | **Detalle del paciente** | **Sí** | Ídem |
| 11 responde alerta | Pestaña Alertas | No | — |
| 12 administrador | Pestaña Auditoría | No | — |
| 13, 14 registro | Formulario sin sesión | No (se reabre la app) | `preparar.yaml` |
| 15 OTP | Pestaña | No | — |
| real 01, 02 | Perfil / Chatbot | No | — |
| real 03 | Pestaña Alertas (vuelve del detalle con `detalle-volver`) | No | — |

**`testID` que faltaban:** `header-volver` (botón atrás de las subpantallas). **Esperas inseguras revisadas:** aserciones sobre elementos de la parte baja (mensaje de error de los formularios, bloque de riesgo dentro del modal, telemetría del detalle) → ahora van tras `scrollUntilVisible`; texto bajo el teclado → `hideKeyboard`; la lista del chatbot se desplaza al final, así que se comprueban la respuesta y el aviso y, subiendo, el primer mensaje.

**Regla de scroll.** *Toda aserción sobre un elemento que no esté en la primera pantalla va precedida de `scrollUntilVisible`* (dirección `DOWN` por defecto, `UP` si está arriba, con `timeout` corto). Los errores de los formularios de registro están al final, sobre el botón «Enviar solicitud».

## 8.2 Velocidad (opcional)

- **`EXPO_PUBLIC_MOCK_LATENCIA` (ms, solo modo simulado):** espera artificial de los servicios simulados. Hoy los servicios simulados **no tenían ninguna espera** (el valor actual es 0), así que fijarla en 0 no acelera nada; sirve para imitar una red lenta. `iniciar-expo.ps1 -Modo simulado` la fija en 0.
- **`scripts\animaciones.ps1 -Desactivar` / `-Restaurar`:** pone en 0 `window_animation_scale`, `transition_animation_scale` y `animator_duration_scale` con `adb` (guarda los previos en `.maestro\reports\animaciones-previas.json`). Úsalo solo con un teléfono de pruebas. **Para revertir:** `-Restaurar`, o a mano en Opciones de desarrollador (Escala de animación de ventana, de transición y de duración del animador, ponerlas en 1x).
- **`npm run e2e:mock-rapido`:** suite A con `-Rapido` (desactiva las animaciones y las restaura al terminar, aunque falle).
- **Subconjuntos:** `-Etiquetas smoke|paciente|medico|admin|registro|ml|chatbot` (ver tabla de flujos).
- **Estimación (sin ejecutar):** la última ejecución de 05 a 10 sumó unos 13 min. Sin animaciones se espera un ahorro del orden del 20 al 30 %; el mayor ahorro posible (propuesta, **no aplicada**) es fusionar 07 a 10 en una sola sesión de médico: cada flujo repite abrir la app, iniciar sesión y abrir el detalle (≈ 30 a 40 s), unos 2 a 3 min en total, a costa de que un fallo temprano oculte los casos siguientes (se pierde aislamiento). Tampoco se evita ya el reinicio de sesión entre flujos porque cada uno parte de un estado conocido.

## 9. Pasar a un APK propio más adelante

Con un APK de desarrollo o de producción (EAS) ya no hace falta `openLink` ni `host.exp.exponent`: se cambia el `appId` de los flujos por el paquete de la app (el de `app.json`) y `subflows/abrir-app.yaml` pasa a ser `- launchApp` (con `clearState: true` si se quiere partir limpio). Los `testID` y el resto de los flujos no cambian.

## 10. Qué no se pudo verificar sin teléfono ni Maestro

Que los flujos pasen; el manejo real de las pantallas de Expo Go; los tiempos de carga; y el comportamiento de `scrollUntilVisible` con el teclado abierto.

**Contra la documentación oficial de Maestro.** Confirmado: todos los comandos usados existen (`openLink`, `runFlow`, `tapOn`, `inputText`, `eraseText`, `pressKey`, `scrollUntilVisible`, `extendedWaitUntil`, `assertVisible`, `assertNotVisible`, `takeScreenshot`); `runFlow` con `file` + `env` y con `commands`; `when: visible: "texto"`; el selector `id` admite expresiones regulares (la documentación usa `id: ".*floating_action_button.*"`); `-e VAR=valor` y `${VAR}`; `--include-tags`/`--exclude-tags`; `--format junit --output` y `--test-output-dir`; `openLink` con la URL de desarrollo para Expo Go. **No confirmado en lo que revisé:** que `when: visible` acepte un selector `id` en forma de mapa (la página dice que se define con «uno o más Selectors»), la base de las rutas relativas de `runFlow: file` (se asume la carpeta del flujo que llama) y la clave `flows` de `config.yaml`. **No existe un comando de validación de sintaxis de Maestro confirmado en la documentación**: los flujos se comprobaron como YAML válido (28 archivos) y se revisaron a mano.
