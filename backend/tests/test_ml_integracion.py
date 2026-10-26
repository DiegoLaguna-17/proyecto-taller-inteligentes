"""
Integración backend ↔ ML (TASK-017, ADR-0011) con el ML SIMULADO y Supabase simulado: sin red real, sin datos reales.

Ejecutar desde backend/:  PYTHONPATH=. python -m pytest tests/test_ml_integracion.py
"""
import asyncio
import time
from datetime import date

import httpx
import pytest

from app.core.config import settings
from app.services import ml_client, ml_reglas as R
from tests.conftest import MockQueryBuilder

ENFERMEDADES_T2 = [{"enfermedades_base": {"nombre_enfermedad": "Diabetes Tipo 2"}}]
TRATAMIENTO_INSULINA = [{"tratamientos": {"nombre_tratamiento": "Insulina"}}]
TRATAMIENTO_METFORMINA = [{"tratamientos": {"nombre_tratamiento": "Metformina"}}]

CAMPOS_CONTRATO = {
    "glucosa", "momento", "genero", "edad", "bmi", "duracion_diabetes", "categoria_medicacion",
    "com_hipertension", "com_dislipidemia", "com_renal", "com_neuropatia", "com_nefropatia", "com_cardiovascular",
    "hba1c",
}
BODY = {"fecha": "2026-11-02", "hora": "08:30:00", "id_medico": 3, "id_momento": 1, "id_paciente": 5, "nivel_glucosa": 110}
CLAVES_ANTERIORES = {"message", "id_registro", "registro_glucosa"}


def fila_paciente(**cambios):
    base = {
        "embarazo": False,
        "genero": "Masculino",
        "peso": 80,
        "altura": 1.75,  # METROS
        "usuario": {"fecha_nac": "1970-05-20"},
        "paciente_enfermedad": ENFERMEDADES_T2,
        "tratamiento_enfermedad": TRATAMIENTO_INSULINA,
    }
    base.update(cambios)
    return base


class TablaRegistro(MockQueryBuilder):
    """registro_glucosa: recuerda si se insertó (la lectura debe guardarse ANTES de llamar al ML)."""

    insertado = False

    def insert(self, *args, **kwargs):
        TablaRegistro.insertado = True
        return super().insert(*args, **kwargs)


@pytest.fixture
def ml(monkeypatch):
    """ML simulado: reemplaza `consultar_riesgo`; registra las entradas recibidas y el estado de la lectura."""

    class Falso:
        llamadas = []
        resultado = (0.1234, "1.1.0")
        antes_de_llamar_estaba_guardada = []

    async def fake(entrada, url, timeout, transport=None):
        Falso.llamadas.append(dict(entrada))
        Falso.antes_de_llamar_estaba_guardada.append(TablaRegistro.insertado)
        r = Falso.resultado
        if isinstance(r, BaseException):
            raise r
        if callable(r):
            return await r(timeout)
        return r

    Falso.llamadas = []
    Falso.antes_de_llamar_estaba_guardada = []
    Falso.resultado = (0.1234, "1.1.0")
    TablaRegistro.insertado = False
    monkeypatch.setattr(ml_client, "consultar_riesgo", fake)
    monkeypatch.setattr(settings, "ML_ENABLED", True)
    return Falso


@pytest.fixture
def preparar(mock_supabase):
    def _preparar(paciente=None, error_paciente=None):
        mock_supabase.set_table_mock("registro_glucosa", TablaRegistro(data=[{"id_registro": 77, **{k: BODY[k] for k in ("fecha", "hora")}}]))
        mock_supabase.set_table_mock(
            "paciente",
            MockQueryBuilder(data=paciente if paciente is not None else fila_paciente(), error=error_paciente),
        )
    return _preparar


def registrar(client, **cambios):
    return client.post("/api/medicos/registrar/glucosa", json={**BODY, **cambios})


# ------------------------------------------------------------------ ML_ENABLED apagado

def test_con_ml_apagado_la_respuesta_es_exactamente_la_de_siempre(client, ml, preparar, monkeypatch):
    monkeypatch.setattr(settings, "ML_ENABLED", False)
    preparar()
    r = registrar(client)
    assert r.status_code == 200
    assert set(r.json()) == CLAVES_ANTERIORES
    assert "riesgo_ml" not in r.json()
    assert ml.llamadas == []


def test_por_defecto_ml_enabled_es_false():
    from app.core.config import Settings
    assert Settings().ML_ENABLED is False
    assert Settings().ML_DURACION_DEFECTO_ANIOS == 6.5
    assert Settings().ML_TIMEOUT == 2.0
    assert Settings().ML_URL == "http://ml_service:8002"


def test_el_registro_del_paciente_no_cambia_ni_recibe_riesgo(client, ml, mock_supabase):
    mock_supabase.set_table_mock("registro_glucosa", MockQueryBuilder(data=[{"id_registro": 9}]))
    r = client.post("/api/pacientes/registrarGlucosa", json={"fecha": "2026-11-02", "hora": "08:30:00", "id_momento": 1, "id_paciente": 5, "nivel_glucosa": 110})
    assert r.status_code == 200
    assert "riesgo_ml" not in r.json()
    assert ml.llamadas == []


# ------------------------------------------------------------------ caso feliz

def test_tipo_2_valido_devuelve_riesgo_con_supuestos_y_no_cambia_el_resto(client, ml, preparar):
    preparar()
    r = registrar(client)
    cuerpo = r.json()
    assert r.status_code == 200
    assert CLAVES_ANTERIORES <= set(cuerpo)
    assert cuerpo["message"] == "Registro insertado correctamente"
    assert cuerpo["id_registro"] == 77
    assert cuerpo["riesgo_ml"] == {
        "riesgo_hipoglucemia": 0.1234,
        "version_modelo": "1.1.0",
        "motivo": None,
        "supuestos": ["duracion_estimada", "comorbilidades_no_capturadas", "hba1c_no_disponible"],
    }
    assert ml.antes_de_llamar_estaba_guardada == [True]  # la lectura se guarda ANTES de llamar al ML


def test_la_entrada_al_ml_cumple_el_contrato_y_no_lleva_identificadores(client, ml, preparar):
    preparar()
    registrar(client)
    entrada = ml.llamadas[0]
    assert set(entrada) == CAMPOS_CONTRATO
    assert entrada["momento"] == "ayunas" and entrada["genero"] == "masculino"
    assert entrada["edad"] == 56 and entrada["bmi"] == 26.1  # 80 / 1.75² con la altura en METROS
    assert entrada["duracion_diabetes"] == 6.5 and entrada["categoria_medicacion"] == "insulina"
    assert entrada["hba1c"] is None and all(entrada[c] is False for c in R.COMORBILIDADES)
    texto = str(entrada).lower()
    for prohibido in ("id_paciente", "id_medico", "nombre", "correo", "telefono", "fecha_nac"):
        assert prohibido not in texto


def test_postprandial_se_mapea_desde_despues_de_comer(client, ml, preparar):
    preparar()
    registrar(client, id_momento=2)
    assert ml.llamadas[0]["momento"] == "postprandial"


# ------------------------------------------------------------------ no se calcula (sin llamar al ML)

SIN_CALCULO = {"riesgo_hipoglucemia": None, "version_modelo": None, "supuestos": []}


@pytest.mark.parametrize(
    "caso,paciente,body,motivo",
    [
        ("tipo 1", fila_paciente(paciente_enfermedad=[{"enfermedades_base": {"nombre_enfermedad": "Diabetes Tipo 1"}}]), {}, "no_aplica_tipo"),
        ("gestacional", fila_paciente(paciente_enfermedad=[{"enfermedades_base": {"nombre_enfermedad": "Diabetes Gestacional"}}]), {}, "no_aplica_tipo"),
        ("sin tipo", fila_paciente(paciente_enfermedad=[]), {}, "no_aplica_tipo"),
        ("varias filas", fila_paciente(paciente_enfermedad=ENFERMEDADES_T2 + [{"enfermedades_base": {"nombre_enfermedad": "Diabetes Tipo 1"}}]), {}, "no_aplica_tipo"),
        ("tipo 2 con embarazo", fila_paciente(embarazo=True), {}, "no_aplica_tipo"),
        ("género desconocido", fila_paciente(genero="otro"), {}, "datos_insuficientes"),
        ("género vacío", fila_paciente(genero=None), {}, "datos_insuficientes"),
        ("IMC no plausible (altura en cm)", fila_paciente(altura=175), {}, "datos_insuficientes"),
        ("IMC no plausible (peso)", fila_paciente(peso=5), {}, "datos_insuficientes"),
        ("sin fecha de nacimiento", fila_paciente(usuario={"fecha_nac": None}), {}, "datos_insuficientes"),
        ("medicación sin equivalente", fila_paciente(tratamiento_enfermedad=[{"tratamientos": {"nombre_tratamiento": "Dieta"}}]), {}, "datos_insuficientes"),
        ("sin tratamiento", fila_paciente(tratamiento_enfermedad=[]), {}, "datos_insuficientes"),
        ("glucosa 0", fila_paciente(), {"nivel_glucosa": 0}, "datos_insuficientes"),
        ("antes de dormir", fila_paciente(), {"id_momento": 3}, "momento_no_cubierto"),
        ("momento desconocido", fila_paciente(), {"id_momento": 99}, "momento_no_cubierto"),
    ],
)
def test_casos_en_los_que_no_se_calcula_el_riesgo(client, ml, preparar, caso, paciente, body, motivo):
    preparar(paciente=paciente)
    r = registrar(client, **body)
    assert r.status_code == 200, caso
    assert CLAVES_ANTERIORES <= set(r.json())
    assert r.json()["riesgo_ml"] == {**SIN_CALCULO, "motivo": motivo}, caso
    assert ml.llamadas == [], caso  # nunca se llama al ML sin datos válidos
    assert ml.antes_de_llamar_estaba_guardada == []


def test_paciente_inexistente_no_calcula(client, ml, mock_supabase):
    mock_supabase.set_table_mock("registro_glucosa", TablaRegistro(data=[{"id_registro": 1}]))
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data=None))
    r = registrar(client)
    assert r.status_code == 200 and r.json()["riesgo_ml"]["motivo"] == "datos_insuficientes"
    assert ml.llamadas == []


# ------------------------------------------------------------------ el registro NUNCA falla ni se demora por el ML

def _casos_de_fallo():
    async def lento(timeout):
        await asyncio.sleep(timeout + 5)
        return (0.5, "1.1.0")

    return {
        "5xx": ml_client.MLNoDisponible("http_503"),
        "422": ml_client.MLNoDisponible("http_422"),
        "respuesta inválida": ml_client.MLNoDisponible("respuesta_invalida"),
        "red": ml_client.MLNoDisponible("ConnectError"),
        "excepción inesperada": RuntimeError("valor sensible 110 mg/dL"),
        "timeout": lento,
    }


@pytest.mark.parametrize("nombre", ["5xx", "422", "respuesta inválida", "red", "excepción inesperada", "timeout"])
def test_si_el_ml_falla_el_registro_responde_igual_con_no_disponible(client, ml, preparar, monkeypatch, caplog, nombre):
    monkeypatch.setattr(settings, "ML_TIMEOUT", 0.1)
    ml.resultado = _casos_de_fallo()[nombre]
    preparar()
    inicio = time.perf_counter()
    r = registrar(client)
    assert time.perf_counter() - inicio < 2.0  # el timeout corto acota la demora
    assert r.status_code == 200
    assert CLAVES_ANTERIORES <= set(r.json())
    assert r.json()["id_registro"] == 77
    assert r.json()["riesgo_ml"] == {**SIN_CALCULO, "motivo": "no_disponible"}
    # el log no lleva valores clínicos ni datos del paciente
    assert "110" not in caplog.text and "valor sensible" not in caplog.text and "Masculino" not in caplog.text


def test_si_falla_la_consulta_a_supabase_el_registro_responde_igual(client, ml, preparar):
    preparar(error_paciente=RuntimeError("fallo de base"))
    r = registrar(client)
    assert r.status_code == 200 and r.json()["riesgo_ml"]["motivo"] == "no_disponible"
    assert ml.llamadas == []


def test_si_falla_el_registro_no_se_llama_al_ml(client, ml, mock_supabase):
    mock_supabase.set_table_mock("registro_glucosa", MockQueryBuilder(data=[]))  # el insert no devuelve fila
    r = registrar(client)
    assert r.status_code == 500
    assert ml.llamadas == []


# ------------------------------------------------------------------ cliente HTTP (transporte simulado)

def _transporte(handler):
    return httpx.MockTransport(handler)


def _entrada():
    return R.armar_entrada(
        {"genero": "Femenino", "peso": 70, "altura": 1.65, "embarazo": False, "fecha_nac": "1980-01-01",
         "enfermedades": ["Diabetes Tipo 2"], "tratamientos": ["Metformina"]},
        130, 2, "2026-11-02", 6.5,
    ).entrada


def test_el_cliente_envia_el_cuerpo_del_contrato_a_la_ruta_correcta():
    visto = {}

    def handler(request):
        visto["url"], visto["metodo"] = str(request.url), request.method
        visto["cuerpo"] = request.read().decode()
        return httpx.Response(200, json={"riesgo_hipoglucemia": 0.25, "version_modelo": "1.1.0"})

    riesgo, version = asyncio.run(ml_client.consultar_riesgo(_entrada(), "http://ml_service:8002/", 1.0, _transporte(handler)))
    assert (riesgo, version) == (0.25, "1.1.0")
    assert visto["url"] == "http://ml_service:8002/api/riesgo/hipoglucemia" and visto["metodo"] == "POST"
    assert '"momento":"postprandial"' in visto["cuerpo"].replace(" ", "")


@pytest.mark.parametrize(
    "respuesta",
    [
        httpx.Response(503, json={"detail": "x"}),
        httpx.Response(500, json={"detail": "x"}),
        httpx.Response(422, json={"detail": "x"}),
        httpx.Response(200, text="no es json"),
        httpx.Response(200, json={"riesgo_hipoglucemia": 1.5, "version_modelo": "1.1.0"}),
        httpx.Response(200, json={"riesgo_hipoglucemia": -0.1, "version_modelo": "1.1.0"}),
        httpx.Response(200, json={"riesgo_hipoglucemia": True, "version_modelo": "1.1.0"}),
        httpx.Response(200, json={"riesgo_hipoglucemia": "0.3", "version_modelo": "1.1.0"}),
        httpx.Response(200, json={"riesgo_hipoglucemia": 0.3}),
        httpx.Response(200, json={"riesgo_hipoglucemia": 0.3, "version_modelo": ""}),
        httpx.Response(200, json=[]),
    ],
)
def test_el_cliente_rechaza_respuestas_invalidas(respuesta):
    with pytest.raises(ml_client.MLNoDisponible):
        asyncio.run(ml_client.consultar_riesgo(_entrada(), "http://ml_service:8002", 1.0, _transporte(lambda r: respuesta)))


def test_el_cliente_convierte_timeout_y_errores_de_red():
    def lanza(exc):
        def handler(request):
            raise exc
        return handler

    for exc in (httpx.ReadTimeout("t"), httpx.ConnectError("c"), httpx.ConnectTimeout("c")):
        with pytest.raises(ml_client.MLNoDisponible) as info:
            asyncio.run(ml_client.consultar_riesgo(_entrada(), "http://ml_service:8002", 0.5, _transporte(lanza(exc))))
        assert info.value.causa == type(exc).__name__


def test_calcular_riesgo_ml_completo_con_transporte_simulado(mock_supabase, monkeypatch):
    mock_supabase.set_table_mock("paciente", MockQueryBuilder(data=fila_paciente()))
    transporte = _transporte(lambda r: httpx.Response(200, json={"riesgo_hipoglucemia": 0.31419, "version_modelo": "1.1.0"}))
    r = asyncio.run(ml_client.calcular_riesgo_ml(5, 110, 1, "2026-11-02", transport=transporte))
    assert r["riesgo_hipoglucemia"] == 0.3142 and r["version_modelo"] == "1.1.0" and r["motivo"] is None
    assert r["supuestos"] == ["duracion_estimada", "comorbilidades_no_capturadas", "hba1c_no_disponible"]


# ------------------------------------------------------------------ reglas puras

def test_regla_tipo_2():
    assert R.es_tipo_2(["Diabetes Tipo 2"], False)
    assert R.es_tipo_2(["  diabetes   TIPO 2 "], None)
    assert R.es_tipo_2(["Diabetes tipo 2"], False)
    assert not R.es_tipo_2(["Diabetes Tipo 2"], True)  # embarazo activo
    assert not R.es_tipo_2([], False)
    assert not R.es_tipo_2(["Diabetes Tipo 1"], False)
    assert not R.es_tipo_2(["Diabetes Gestacional"], False)
    assert not R.es_tipo_2(["Diabetes Tipo 2", "Diabetes Tipo 1"], False)
    assert not R.es_tipo_2(["Diabetes Tipo 2", "Diabetes Tipo 2"], False)  # varias filas
    assert not R.es_tipo_2(["Diabetes Tipo 22"], False)


def test_genero_lista_estricta():
    for v in ("Masculino", "MASCULINO", "hombre", "Varón"):
        assert R.normalizar_genero(v) == "masculino"
    for v in ("Femenino", "mujer", "FEMENINO"):
        assert R.normalizar_genero(v) == "femenino"
    for v in (None, "", "m", "f", "otro", "no binario", 1):
        assert R.normalizar_genero(v) is None


def test_edad_a_la_fecha_de_la_lectura():
    assert R.calcular_edad("1970-05-20", "2026-05-19") == 55  # aún no cumple años
    assert R.calcular_edad("1970-05-20", "2026-05-20") == 56
    assert R.calcular_edad("1970-05-20T00:00:00", date(2026, 11, 2)) == 56
    for malo in (None, "", "no-fecha", "2030-01-01"):
        assert R.calcular_edad(malo, "2026-11-02") is None
    assert R.calcular_edad("1890-01-01", "2026-11-02") is None  # > 120
    assert R.calcular_edad("2026-11-01", "2026-11-02") is None  # 0 años


def test_bmi_con_altura_en_metros():
    assert R.calcular_bmi(80, 1.75) == 26.1
    assert R.calcular_bmi("70.5", "1.70") == 24.4
    assert R.calcular_bmi(80, 175) is None  # centímetros: nunca se asumen
    assert R.calcular_bmi(80, 0.9) is None
    assert R.calcular_bmi(10, 1.7) is None
    assert R.calcular_bmi(None, 1.7) is None and R.calcular_bmi(80, None) is None
    assert R.calcular_bmi(300, 1.0) is None  # IMC 300 > 80
    assert R.calcular_bmi(True, 1.7) is None


def test_categoria_de_medicacion():
    assert R.categoria_medicacion(["Insulina"]) == "insulina"
    assert R.categoria_medicacion(["Metformina"]) == "metformina_u_otros"
    assert R.categoria_medicacion(["Metformina", "Insulina"]) == "insulina"  # prioridad del entrenamiento
    assert R.categoria_medicacion(["Metformina", "Glimepirida"]) == "sulfonilurea"
    assert R.categoria_medicacion([]) is None
    assert R.categoria_medicacion(["Dieta y ejercicio"]) is None
    assert R.categoria_medicacion([None, ""]) is None


def test_mapeo_de_momentos():
    assert R.mapear_momento(1) == "ayunas" and R.mapear_momento("2") == "postprandial"
    assert R.mapear_momento(3) is None and R.mapear_momento(0) is None and R.mapear_momento("x") is None
    assert R.mapear_momento(1.5) is None and R.mapear_momento(None) is None


def _paciente(**c):
    base = {"genero": "Femenino", "peso": 70, "altura": 1.65, "embarazo": False, "fecha_nac": "1980-01-01",
            "enfermedades": ["Diabetes Tipo 2"], "tratamientos": ["Metformina"]}
    base.update(c)
    return base


def test_la_duracion_estimada_siempre_esta_en_los_supuestos_y_nunca_da_datos_insuficientes():
    a = R.armar_entrada(_paciente(), 120, 1, "2026-11-02", 6.5)
    assert a.motivo is None and a.entrada["duracion_diabetes"] == 6.5
    assert a.supuestos == ["duracion_estimada", "comorbilidades_no_capturadas", "hba1c_no_disponible"]
    # otro valor configurado
    assert R.armar_entrada(_paciente(), 120, 1, "2026-11-02", 9.0).entrada["duracion_diabetes"] == 9.0
    # un valor configurado fuera de rango se acota al del contrato (0 a 80)
    assert R.armar_entrada(_paciente(), 120, 1, "2026-11-02", 500).entrada["duracion_diabetes"] == 80.0


def test_punto_de_extension_duracion_real_y_comorbilidades_reales():
    a = R.armar_entrada(
        _paciente(), 120, 1, "2026-11-02", 6.5,
        extras={"anio_diagnostico": 2016, "comorbilidades": {"com_renal": True, "com_hipertension": True}},
    )
    assert a.entrada["duracion_diabetes"] == 10.0
    assert a.entrada["com_renal"] is True and a.entrada["com_hipertension"] is True and a.entrada["com_cardiovascular"] is False
    assert a.supuestos == ["hba1c_no_disponible"]  # ya no hay duración estimada ni comorbilidades no capturadas
    # un año de diagnóstico imposible se ignora y se vuelve al valor por defecto con su supuesto
    b = R.armar_entrada(_paciente(), 120, 1, "2026-11-02", 6.5, extras={"anio_diagnostico": 2099})
    assert b.entrada["duracion_diabetes"] == 6.5 and "duracion_estimada" in b.supuestos


def test_orden_de_decision_tipo_momento_datos():
    # tipo 1 con momento no cubierto y sin género: manda el tipo
    assert R.armar_entrada(_paciente(enfermedades=["Diabetes Tipo 1"], genero=None), 100, 3, "2026-11-02", 6.5).motivo == "no_aplica_tipo"
    # tipo 2, momento no cubierto y sin género: manda el momento
    assert R.armar_entrada(_paciente(genero=None), 100, 3, "2026-11-02", 6.5).motivo == "momento_no_cubierto"
    # glucosa fuera del contrato del ML
    assert R.armar_entrada(_paciente(), 701, 1, "2026-11-02", 6.5).motivo == "datos_insuficientes"
    assert R.armar_entrada(_paciente(), "abc", 1, "2026-11-02", 6.5).motivo == "datos_insuficientes"
