# syntax=docker/dockerfile:1
# Imagen del BACKEND DE NEGOCIO (ADR-0010). Contexto de build: backend/ (el Dockerfile debe vivir aqui
# y el .dockerignore excluye ml_service/ y nlp_service/, asi que solo se envia lo del backend).
#
#   docker build -t glucotracker/backend:local backend          # etapa 'runtime' (por defecto)
#   docker build --target test -t glucotracker/backend:test backend
#
# Sin .env, sin pruebas y sin venvs en la imagen de ejecucion: la configuracion llega por variables de entorno.

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

# Etapa de pruebas: anade requirements-dev.txt, el codigo y las pruebas (y .env.example, que una prueba lee)
FROM deps AS test
COPY requirements-dev.txt ./
RUN pip install -r requirements-dev.txt
COPY .env.example ./
COPY app ./app
COPY tests ./tests
RUN chown -R app:app /app
USER app
CMD ["python", "-m", "pytest", "tests", "-q", "-p", "no:cacheprovider"]

# Etapa de ejecucion (la que se despliega): solo el codigo de la aplicacion
FROM deps AS runtime
COPY --chown=app:app app ./app
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
