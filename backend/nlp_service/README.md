# Servicio NLP de GlucoTracker (chatbot educativo)

Servicio FastAPI **independiente** del backend principal (ver `docs/adr/0006-nlp-servicio-independiente.md`): tiene su propio venv, dependencias, configuración y pruebas, y no importa nada del backend. Responde consultas educativas sobre diabetes tipo 2 (REQ-006) inyectando el corpus `app/corpus/reglas_ada_v1.1.txt` en el system prompt de un LLM externo (Gemini, ver `docs/adr/0005-proveedor-llm-chatbot.md`).

Diseño completo: `design.md` § Servicio NLP (chatbot) Design. Estado: `/health` y `POST /api/chatbot/consulta` implementados (TASK-018). La autenticación real llega con TASK-014: hasta entonces, con `CHATBOT_REQUIRE_AUTH=true` el endpoint responde 401, y el servicio **no se despliega públicamente**.

> Todos los comandos se ejecutan **desde `backend/nlp_service/`**. El paquete interno se llama `app`, igual que el del backend: correrlo desde otra carpeta importaría el paquete equivocado.

## 1. Instalación

Requiere Python 3.13.

```bash
cd backend/nlp_service
python -m venv .venv
# Windows (Git Bash):  source .venv/Scripts/activate
# Windows (PowerShell): .venv\Scripts\Activate.ps1
# Linux/macOS:          source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m pip check
```

## 2. Configuración

Copiar `.env.example` a `.env` (en esta carpeta) y completar. El `.env` real nunca se commitea.

| Variable | Uso | Por defecto |
|---|---|---|
| `NLP_PROVIDER` | `gemini` o `fake` | — (obligatoria) |
| `NLP_MODEL` | Id del modelo (obligatoria con `gemini`) | — |
| `NLP_PROVIDER_API_KEY` | Clave del proveedor (obligatoria con `gemini`) | — |
| `NLP_TIMEOUT_SECONDS` | Timeout de la llamada al proveedor | 30 |
| `NLP_ENFORCE_DISCLAIMER` | Agregar el descargo médico por código si falta | true |
| `CHATBOT_REQUIRE_AUTH` | Exigir autenticación; con `true` responde 401 hasta TASK-014. `false` solo en desarrollo | true |
| `CHATBOT_MAX_INPUT_CHARS` | Longitud máxima de `texto` (→ 422) | 1000 |
| `CHATBOT_RATE_LIMIT_PER_MINUTE` | Consultas por minuto por IP (→ 429) | 10 |

La temperatura es fija (0.2, constante en `app/service.py`); no se configura por entorno. El tier gratuito de Gemini se usa **solo** con las preguntas sintéticas del Golden Dataset, nunca con datos de pacientes reales (ADR-0005).

## 3. Pruebas

```bash
python -m pytest
```

No llaman a ninguna API real (usan `FakeProvider` o dobles del SDK) y no leen el `.env`. Incluyen el test de contrato clínico (`tests/test_contrato_clinico.py`), que compara `app/clinical.py` con `docs/nlp/umbrales_ada_v1.json` y con el corpus vigente.

## 4. Levantar el servicio

```bash
uvicorn app.main:app --env-file .env --port 8001
curl http://localhost:8001/health
```

### `POST /api/chatbot/consulta`

Contrato en `design.md` § API: entrada `{"texto": "..."}`, salida 200 `{"respuesta": "..."}`. Los errores devuelven `{"detail": "<mensaje genérico>"}` y nunca repiten el texto enviado:

| Código | Cuándo |
|---|---|
| 401 | `CHATBOT_REQUIRE_AUTH=true` (hasta TASK-014) |
| 429 | Más de `CHATBOT_RATE_LIMIT_PER_MINUTE` consultas en 60 s desde la misma IP (incluye cabecera `Retry-After`) |
| 422 | `texto` ausente, vacío, no string o más largo que `CHATBOT_MAX_INPUT_CHARS`; JSON malformado o cuerpo no UTF-8 |
| 503 | Proveedor no configurado o configuración inválida |
| 502 | Fallo del proveedor o respuesta vacía |
| 504 | Timeout del proveedor (`NLP_TIMEOUT_SECONDS`) |

Para probar con curl, guardar el cuerpo en un archivo UTF-8 (p. ej. `consulta.json`) y enviarlo con `--data-binary @consulta.json`. En Windows, las tildes escritas directamente en la línea de comandos pueden llegar mal codificadas (→ 422).

**Límite de tasa:** vive en memoria por proceso (no se comparte entre instancias ni workers, y se reinicia con el servicio; ver `docs/risks.md` RT-03). Detrás de un proxy (Azure), arrancar uvicorn con `--proxy-headers --forwarded-allow-ips=<IP del proxy>` para que el límite vea la IP real del cliente.

### Prueba end-to-end con FakeProvider

```bash
./test_chatbot.sh            # puerto 8001; PORT=8002 ./test_chatbot.sh si está ocupado
```

Levanta el servicio con `NLP_PROVIDER=fake` y `CHATBOT_REQUIRE_AUTH=false` **sin leer `.env`**, prueba `/health` y una consulta, y detiene el servicio al terminar.

## 5. Chat de consola (prueba manual)

```bash
python -m app.dev_chat                 # con el corpus inyectado
python -m app.dev_chat --sin-contexto  # corrida neutra, sin corpus
```

Usa el proveedor definido en `.env`, imprime las respuestas solo por pantalla (no escribe archivos ni logs) y termina con una línea vacía. Si falta configuración, el mensaje nombra la variable que falta, nunca su valor. El descargo médico se agrega según `NLP_ENFORCE_DISCLAIMER`: para ver la salida cruda del LLM, ponerla en `false`.
