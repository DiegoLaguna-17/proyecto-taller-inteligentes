# 10. Contenerización con Docker Compose

* **Estado:** Aceptado
* **Fecha de decisión:** 2026-10-26
* **Autores:** Equipo GlucoTracker (decisión tomada por el equipo; propuesta y aprobada en la fase Docker)

## Contexto y Problema
El backend tiene hoy tres servicios independientes (ADR-0006, ADR-0008) que se levantan a mano, cada uno en su propio entorno virtual y puerto:

| Servicio | Carpeta | Puerto | Dependencias clave |
|---|---|---|---|
| Backend de negocio | `backend/app` | 8000 | fastapi 0.115.0, pydantic 2.9.2, supabase 2.16.0 |
| Servicio NLP (chatbot) | `backend/nlp_service` | 8001 | fastapi 0.162.0, pydantic 2.14.1, google-genai |
| Servicio de ML | `backend/ml_service` | 8002 | fastapi 0.162.0, scikit-learn 1.5.2, numpy 2.4.6, scipy 1.15.3 |

Las versiones **chocan entre sí** (por eso son servicios separados) y el modelo de ML depende de versiones exactas de librerías (RT-06). Hace falta una forma reproducible de levantar los tres con un solo comando, que sirva también para Azure (ADR-0003), y que respete tres reglas ya decididas: el `.pkl` del modelo no entra en git, el servicio de ML no tiene ingreso público (ADR-0008) y los servicios no comparten código ni configuración.

## Alternativas Consideradas
1. **Una sola imagen con los tres servicios:**
   * Pros: un solo Dockerfile.
   * Contras: obliga a resolver las versiones contradictorias (fastapi 0.115.0 frente a 0.162.0, pydantic 2.9.2 frente a 2.14.1), rompe el aislamiento de ADR-0006 y ADR-0008 y haría que un cambio en un servicio reconstruya los otros.
2. **Sin contenedores (venvs locales y scripts):**
   * Pros: nada nuevo que aprender.
   * Contras: no reproducible entre máquinas (hoy ya hubo fallos por venvs con paquetes distintos), no garantiza el aislamiento de red del ML y no se parece al despliegue en Azure.
3. **Un Dockerfile por servicio y Docker Compose (elegida):**
   * Pros: cada servicio lleva su imagen y su `requirements.txt` exactos, la red de Compose permite que el ML sea inalcanzable desde el host, y las mismas imágenes se publican en un registro y se despliegan en Azure.
   * Contras: tres imágenes que mantener y un archivo de orquestación más.

## Decisión Tomada
Se elige la **alternativa 3**.
* **Un Dockerfile y un contexto de build por servicio**; el contexto de cada uno contiene solo lo suyo. El del backend de negocio es `backend/`, que contiene también las carpetas de los otros servicios, por lo que su `.dockerignore` las excluye.
* **Imagen base `python:3.13-slim`** (la versión con la que se verificaron las dependencias del ML), solo `requirements.txt` de producción, **usuario no root** y sin `.env`, `.pkl`, pruebas ni entornos virtuales. Etapas: `deps`, `test` (con `requirements-dev.txt` y las pruebas) y `runtime` (por defecto).
* **El modelo de ML entra por volumen**, no por la imagen. Un volumen con nombre montado en `/artefactos` (`ML_ARTEFACTOS_DIR`) guarda el `.pkl` y su JSON; se genera la primera vez con un servicio de Compose de una sola ejecución (perfil `entrenamiento`) que reutiliza el entrenamiento existente. Si el modelo falta, el servicio sigue respondiendo 503 genérico (no se cae).
* **Red:** el servicio de ML está solo en una red interna de Compose (`internal: true`) compartida con el backend, **sin puertos publicados** y sin salida a Internet; solo es alcanzable por el nombre `ml_service` desde el backend. El backend y el NLP se publican en el host (8000 y 8001). El NLP arranca con `--proxy-headers` y un `--forwarded-allow-ips` configurable.
* **Secretos:** nunca en el YAML ni en las imágenes; cada servicio lee su propio `.env` (`env_file`, no obligatorio para poder levantar sin claves).
* **Pruebas en contenedores:** perfil `pruebas` con la etapa `test` de cada Dockerfile.

## Consecuencias
* **Positivas:**
  * Las versiones de cada servicio quedan fijadas en su imagen sin afectar a las demás.
  * Un solo comando (`docker compose up -d`) levanta los tres con comprobaciones de salud.
  * El aislamiento de red del ML (ADR-0008) se aplica en la propia definición, no en una convención.
  * Las imágenes se reutilizan en Azure (ADR-0003); falta el registro, el ingreso del ML interno y los secretos (TASK-002 y TASK-002b).
* **Negativas / Riesgos asumidos:**
  * **Tres imágenes que mantener** y que reconstruir cuando cambian las dependencias.
  * **El modelo es un estado fuera de la imagen:** hay que entrenarlo (o restaurarlo) en el volumen la primera vez; sin él el ML responde 503. La huella SHA-256 del `.pkl` se sigue verificando al cargar (RT-06).
  * **Límite de tasa del NLP detrás de Docker o de un proxy:** `request.client.host` es la IP del proxy o de la puerta de enlace de Docker, no la del usuario, hasta configurar `--forwarded-allow-ips` con la IP del proxy real.
  * **Un `.env` compartido por error** copiaría secretos a otro servicio: cada servicio tiene su propio `env_file`.
  * **La red `internal` impide también la salida del ML a Internet**, lo que es deseable (no la necesita), pero hay que recordarlo si alguna vez se agrega una dependencia externa.

## Relación con otras decisiones
* **ADR-0003 (Azure):** las imágenes son el artefacto de despliegue; esta ADR no decide el servicio de Azure (App Service o Container Apps).
* **ADR-0006 y ADR-0008:** mantiene el aislamiento (una imagen y un contexto por servicio) y la política de red del ML (solo el backend, sin ingreso público).
* **ADR-0007 y ADR-0009:** el modelo real y el de demo se seleccionan con `ML_MODELO`; el volumen guarda ambos sin mezclarlos.
