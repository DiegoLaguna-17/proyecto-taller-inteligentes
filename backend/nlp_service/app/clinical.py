"""
Constantes clínicas ADA del servicio NLP.

Copia propia del servicio (ADR-0006): no se comparten con el backend
principal. Su consistencia con el corpus vigente y con el archivo de
referencia versionado docs/nlp/umbrales_ada_v1.json la garantiza
tests/test_contrato_clinico.py. No son configurables por entorno.
"""

HIPOGLUCEMIA_UMBRAL_MG_DL = 70
AYUNAS_MIN_MG_DL = 70
AYUNAS_MAX_MG_DL = 130
POSTPRANDIAL_MAX_MG_DL = 180
CARBOHIDRATOS_RAPIDOS_G = 15
ESPERA_REMEDICION_MIN = 15

DESCARGO_MEDICO = "Consulta siempre a tu médico tratante para cambios en tu medicación."
