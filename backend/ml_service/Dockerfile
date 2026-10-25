# syntax=docker/dockerfile:1
# Imagen del SERVICIO DE ML (ADR-0008, ADR-0010). Contexto de build: backend/ml_service/ (solo lo suyo).
#
#   docker build -t glucotracker/ml_service:local backend/ml_service
#   docker build --target test -t glucotracker/ml_service:test backend/ml_service
#
# El MODELO NO ENTRA EN LA IMAGEN: el .pkl esta ignorado por git y se guarda en un volumen montado en /artefactos
# (ML_ARTEFACTOS_DIR). Tampoco entran el Excel de entrenamiento, los datos sinteticos, los JSON de app/artefactos
# ni el .env. Sin modelo, el servicio responde 503 generico (no se cae). Sin ingreso publico (ADR-0008): no se
# publica ningun puerto en el host.
# Python 3.13: la version con la que se verificaron las dependencias del modelo (RT-06).

FROM python:3.13-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app
WORKDIR /app

# Dependencias de PRODUCCION (versiones exactas de requirements.txt)
FROM base AS deps
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Etapa de pruebas (usa solo datos sinteticos de las propias pruebas: no necesita el Excel ni el .pkl real)
FROM deps AS test
COPY requirements-dev.txt ./
RUN pip install -r requirements-dev.txt
COPY app ./app
COPY tests ./tests
RUN chown -R app:app /app
USER app
CMD ["python", "-m", "pytest", "-q", "-p", "no:cacheprovider"]

# Etapa de ejecucion (la que se despliega). /artefactos queda con dueño 'app' para que el volumen nuevo lo herede.
FROM deps AS runtime
RUN mkdir /artefactos && chown app:app /artefactos
ENV ML_ARTEFACTOS_DIR=/artefactos
COPY --chown=app:app app ./app
USER app
EXPOSE 8002
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
