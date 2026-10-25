# syntax=docker/dockerfile:1
# Imagen del SERVICIO NLP / chatbot (ADR-0006, ADR-0010). Contexto de build: backend/nlp_service/ (solo lo suyo).
#
#   docker build -t glucotracker/nlp_service:local backend/nlp_service
#   docker build --target test --build-context docs_nlp=docs/nlp -t glucotracker/nlp_service:test backend/nlp_service
#
# Sin .env en la imagen: NLP_PROVIDER, NLP_PROVIDER_API_KEY, etc. llegan por variables de entorno.
# Detras de un proxy (Azure, Docker) hay que poner FORWARDED_ALLOW_IPS con la IP del proxy: el limite de tasa
# usa request.client.host.

FROM python:3.13-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app

# Dependencias de PRODUCCION (versiones exactas de requirements.txt)
FROM base AS deps
WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Etapa de pruebas. Una prueba (test_contrato_clinico) lee docs/nlp/umbrales_ada_v1.json desde la raiz del repo,
# asi que aqui se reproduce esa disposicion (/repo/backend/nlp_service) y el JSON entra por un contexto de build
# adicional con nombre (docs_nlp). La imagen de ejecucion NO lo lleva.
FROM deps AS test
WORKDIR /repo/backend/nlp_service
# requirements-dev.txt incluye '-r requirements.txt': ambos deben estar en este directorio
COPY requirements.txt requirements-dev.txt ./
RUN pip install -r requirements-dev.txt
COPY app ./app
COPY tests ./tests
COPY --from=docs_nlp umbrales_ada_v1.json /repo/docs/nlp/umbrales_ada_v1.json
RUN chown -R app:app /repo
USER app
CMD ["python", "-m", "pytest", "-q", "-p", "no:cacheprovider"]

# Etapa de ejecucion (la que se despliega): el codigo y el corpus (app/corpus se lee en cada consulta)
FROM deps AS runtime
COPY --chown=app:app app ./app
USER app
EXPOSE 8001
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8001 --proxy-headers --forwarded-allow-ips \"${FORWARDED_ALLOW_IPS:-127.0.0.1}\""]
