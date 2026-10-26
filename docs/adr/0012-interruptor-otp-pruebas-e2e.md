# 12. Interruptor de OTP para pruebas y recorridos E2E con Maestro

* **Estado:** Propuesto (pendiente de revisión del equipo)
* **Fecha de decisión:** 2026-11-04
* **Autores:** Equipo GlucoTracker (rama `feature/pruebas-e2e`)

## Contexto y Problema
Para probar la app en un celular con recorridos automáticos (Maestro sobre Expo Go) hace falta entrar sin esperar un código que llega por correo. Hoy `POST /api/login` valida correo y contraseña, genera un OTP, lo guarda en memoria, lo envía por correo y responde solo `id_usuario` e `id_rol`; el cliente debe llamar luego a `POST /api/verify-otp`, que devuelve el `rol`. **El OTP es hoy el único control real de acceso** (ningún endpoint exige token, RB-01), así que cualquier forma de saltarlo debe ser explícita, apagada por defecto y imposible de activar por descuido.

## Decisión
1. **Variable `OTP_ACTIVADO` del backend** (por defecto **`true`**). Con `true` no cambia nada: respuesta, correo y OTP idénticos a los actuales.
2. **Con `false`**, `POST /api/login` valida las credenciales igual que siempre (mismos 401 y mismos mensajes) y, **en lugar de generar y enviar el OTP**, responde con `id_usuario`, `id_rol` y además **`rol`** (campo aditivo; sin correo y sin OTP). El cliente no necesita `verify-otp`, que **no cambia**.
3. **Protecciones:**
   * Al arrancar con `OTP_ACTIVADO=false` el backend registra un **WARNING** claro (no es un error, pero no debe pasar desapercibido).
   * `OTP_ACTIVADO=true` explícito en `backend/.env.example` y en `docker-compose.yml` (principal). Como Compose tiene prioridad sobre `backend/.env`, el compose principal **no se puede apagar** desde el `.env` del backend.
   * `OTP_ACTIVADO=false` **solo** en `docker-compose.prueba.yml` (el override sin secretos que ya existe, ADR-0010).
   * Una **prueba automática falla** si algún compose principal o algún `.env.example` fija `OTP_ACTIVADO=false`.
4. **App móvil:** el login acepta ambas respuestas. Si trae `id_rol` y `rol`, crea la sesión y entra **sin pantalla de OTP**; si no, sigue el flujo con OTP. El modo simulado puede reproducir ambos comportamientos con `EXPO_PUBLIC_SIN_OTP` (solo tiene efecto con `EXPO_PUBLIC_USE_MOCK=true`; con `false` simula el paso del OTP y acepta el código `123456`, y sin la variable conserva el acceso directo de siempre). Con el backend real la app **no decide**: obedece lo que responde el servidor.
5. **Recorridos E2E (Maestro):** viven en `mobile/.maestro/` (ver design.md § Pruebas E2E). La suite A corre en modo simulado y es la única que escribe (de mentira); la suite B contra el backend real local es **solo de lectura**. Ninguna credencial de prueba se versiona: se pasan con `-e` o con un archivo local ignorado por git.

## Alternativas Consideradas
1. **Un OTP fijo (p. ej. `000000`) en pruebas:** descartada; sigue exigiendo el segundo paso y deja un código válido conocido en el servidor.
2. **Leer el OTP del correo o del log:** descartada; frágil y filtra un secreto a un registro.
3. **Una cuenta que salta el OTP:** descartada; es una puerta trasera permanente dentro de la base real.
4. **Solo modo simulado en la app (sin tocar el backend):** insuficiente; no probaría el login real ni la lectura contra el backend.
5. **Interruptor por entorno con prueba que lo impide en la configuración principal (elegida).**

## Consecuencias
* **Positivas:** se pueden probar los cuatro roles en un teléfono sin correo; el comportamiento por defecto no cambia; el cambio al backend de Adrian es mínimo y aditivo (`auth.py`, `config.py`, `main.py`).
* **Riesgos aceptados:** con `OTP_ACTIVADO=false` cualquiera que conozca un correo y su contraseña entra sin segundo factor y, como no hay token (RB-01), el acceso sigue siendo por id. **No debe activarse fuera de pruebas ni en un servicio expuesto.** Si alguien arranca el backend con `OTP_ACTIVADO=false` por su cuenta (variable de entorno o `backend/.env` sin usar el compose principal), el único aviso es el WARNING del log.
* **Cómo se desactiva:** quitar el override (`docker compose up` sin `-f docker-compose.prueba.yml`), borrar `OTP_ACTIVADO` de `backend/.env` o ponerlo en `true`, y recrear el backend. Con la variable ausente vale `true`.

## Relación con otras ADR
* **ADR-0010:** reutiliza `docker-compose.prueba.yml` como único lugar donde se relaja algo.
* **ADR-0011:** no cambia; el riesgo de ML se sigue viendo solo en el registro del médico.
