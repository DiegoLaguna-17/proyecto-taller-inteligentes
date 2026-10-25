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
Ejecuta el siguiente comando para iniciar el empaquetador de Expo:

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

## Credenciales de prueba por Rol

En la pantalla de inicio de sesión puedes escribir manualmente cualquiera de las siguientes credenciales o presionar los botones de **acceso rápido** ubicados debajo del formulario:

| Rol | Correo electrónico | Contraseña | Pantallas y Flujos Disponibles |
| :--- | :--- | :--- | :--- |
| **Paciente** | `carlos@email.com` | `12345` | **Inicio** (última toma, alertas y botón *Registrar toma* con resultado de clasificación), **Historial** (selector de período, curva de tendencia en SVG y lista de registros), **ChatBot** (asistente clínico con sugerencias interactivas), **Perfil**. |
| **Médico** | `doctor@email.com` | `12345` | **Pacientes** (búsqueda y filtros, métricas de tasa en rango), **Detalle de Paciente** (curva, telemetría y generar reporte), **Alertas** (banner push interactivo y alertas críticas), **Reportes** (previsualización clínica y descarga de PDF), **Perfil**. |
| **Administrador** | `admin@email.com` | `12345` | **Solicitudes** (lista de solicitudes pendientes), **Detalle de Solicitud** (acreditación profesional y aprobación/rechazo), **Usuarios** (modal para cambiar roles y activar/desactivar cuentas), **Auditoría** (KPIs de seguridad y logs firmados con SHA-256), **Perfil**. |

---

## Flujo de Solicitud de Registro

Desde la pantalla de inicio de sesión, presiona **"Solicitar registro"** para acceder al formulario:
- Alterna entre el perfil **Paciente** y **Médico** (el rol médico despliega el campo obligatorio de *Matrícula profesional*).
- Al presionar **"Enviar solicitud"**, se presenta la confirmación para revisión del administrador y la opción de volver al inicio de sesión.

