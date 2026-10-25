"""
Generador de datos sinteticos (Fase S2, TASK-011f). Sin red y sin los datos
reales. ADVERTENCIA: el dataset sale de reglas del equipo; estas pruebas
comprueban que el generador cumple la especificacion, no nada clinico.
"""
import json
import os
import re
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

from app.api.riesgo import PacienteRiesgoInput
from app.sintetico import generador, reglas
from app.sintetico.generador import (
    COLUMNAS,
    ORIGEN,
    auc_roc,
    calibrar_intercepto,
    construir_metadatos,
    escribir_dataset,
    generar_dataset,
    validar_ruta_de_salida,
)
from app.sintetico.generar import main as cli_main

SEMILLA = 20261024
APP_SINTETICO = Path(__file__).resolve().parents[2] / "app" / "sintetico"


@pytest.fixture(scope="module")
def por_defecto():
    return generar_dataset(2000, SEMILLA)


@pytest.fixture(scope="module")
def grande():
    return generar_dataset(60000, 7)


def _perfil_base(**cambios) -> pd.DataFrame:
    """Un registro de referencia donde ninguna regla aporta nada (HbA1c en 8,5; sin riesgo)."""
    fila = {
        "categoria_medicacion": "ninguno", "glucosa": 130.0, "momento": "postprandial",
        "duracion_diabetes": 8.0, "edad": 60, "hba1c": 8.5, "bmi": 25.0,
        "com_renal": False, "com_nefropatia": False,
        "genero": "femenino", "com_hipertension": False, "com_dislipidemia": False,
        "com_neuropatia": False, "com_cardiovascular": False,
    }
    fila.update(cambios)
    return pd.DataFrame([fila])


def _s(**cambios) -> float:
    return float(reglas.suma_log_odds(_perfil_base(**cambios))[0])


# --- Reproducibilidad --------------------------------------------------------

def test_misma_semilla_mismo_dataset():
    a = generar_dataset(500, 11)
    b = generar_dataset(500, 11)

    pd.testing.assert_frame_equal(a.dataframe, b.dataframe)
    assert np.array_equal(a.probabilidad, b.probabilidad)
    assert a.intercepto == b.intercepto


def test_semillas_distintas_datasets_distintos():
    a = generar_dataset(500, 11)
    b = generar_dataset(500, 12)

    assert not a.dataframe.drop(columns=["id_paciente_sintetico", "id_registro_sintetico"]).equals(
        b.dataframe.drop(columns=["id_paciente_sintetico", "id_registro_sintetico"])
    )


def test_el_csv_es_identico_con_la_misma_semilla(tmp_path):
    ruta_a, ruta_b = str(tmp_path / "a.csv"), str(tmp_path / "b.csv")
    meta_a = escribir_dataset(generar_dataset(300, 5), ruta_a)
    meta_b = escribir_dataset(generar_dataset(300, 5), ruta_b)

    assert Path(ruta_a).read_bytes() == Path(ruta_b).read_bytes()
    assert meta_a["sha256_csv"] == meta_b["sha256_csv"]


# --- Contrato real ----------------------------------------------------------

CAMPOS_DEL_CONTRATO = list(PacienteRiesgoInput.model_fields)


def test_cada_fila_cumple_el_contrato_real(por_defecto):
    """Cada registro se valida con el MISMO modelo pydantic del endpoint (rangos y valores permitidos)."""
    df = por_defecto.dataframe
    for fila in df[CAMPOS_DEL_CONTRATO].to_dict("records"):
        if pd.isna(fila["hba1c"]):
            fila["hba1c"] = None
        PacienteRiesgoInput(**fila)  # levanta ValidationError si algo incumple el contrato


def test_columnas_y_tipos(por_defecto):
    df = por_defecto.dataframe

    assert list(df.columns) == COLUMNAS
    assert df["edad"].dtype.kind == "i"
    assert df["hipoglucemia_registro"].isin([0, 1]).all()
    for c in ("com_hipertension", "com_dislipidemia", "com_renal", "com_neuropatia", "com_nefropatia", "com_cardiovascular"):
        assert df[c].dtype == bool


def test_categorias_validas(por_defecto):
    df = por_defecto.dataframe

    assert set(df["momento"]) == {"ayunas", "postprandial"}
    assert set(df["genero"]) == {"femenino", "masculino"}
    assert set(df["categoria_medicacion"]) == {"ninguno", "metformina_u_otros", "sulfonilurea", "insulina"}


def test_rangos_plausibles_de_las_distribuciones(grande):
    df = grande.dataframe

    assert 25 <= df["edad"].min() and df["edad"].max() <= 90
    assert 17 <= df["bmi"].min() and df["bmi"].max() <= 38
    assert 0 <= df["duracion_diabetes"].min() and df["duracion_diabetes"].max() <= 40
    assert 40 <= df["glucosa"].min() and df["glucosa"].max() <= 600
    assert 5.0 <= df["hba1c"].min() and df["hba1c"].max() <= 14.0
    assert 58 <= df["edad"].mean() <= 62
    # la correlacion 0,4 es la del copula (latente): la de Pearson sale algo menor por la marginal gamma (real: 0,42)
    assert 0.30 <= df["edad"].corr(df["duracion_diabetes"]) <= 0.50
    assert -0.40 <= df["edad"].corr(df["bmi"]) <= -0.20
    assert df["genero"].eq("femenino").mean() == pytest.approx(0.46, abs=0.02)


def test_hba1c_ausente_en_alrededor_del_10_por_ciento_y_por_paciente(grande):
    df = grande.dataframe

    assert df["hba1c"].isna().mean() == pytest.approx(0.10, abs=0.01)
    por_paciente = df.groupby("id_paciente_sintetico")["hba1c"].apply(lambda s: s.isna().nunique())
    assert (por_paciente == 1).all()  # o falta en todos sus registros, o en ninguno


# --- Estructura: origen, ids, pacientes ---------------------------------------

def test_origen_constante_en_todas_las_filas(por_defecto):
    assert (por_defecto.dataframe["origen"] == ORIGEN).all()
    assert ORIGEN == "sintetico"


def test_ids_con_prefijo_y_unicos(por_defecto):
    df = por_defecto.dataframe

    assert df["id_registro_sintetico"].is_unique
    assert df["id_registro_sintetico"].str.startswith("sint-reg-").all()
    assert df["id_paciente_sintetico"].str.match(r"^sint-\d{5}$").all()


def test_n_exacto_y_pacientes_de_1_a_3_registros(por_defecto):
    df = por_defecto.dataframe
    por_paciente = df.groupby("id_paciente_sintetico").size()

    assert len(df) == 2000
    assert por_paciente.between(1, 3).all()
    assert por_defecto.n_pacientes == len(por_paciente)
    assert 1.05 <= len(df) / len(por_paciente) <= 1.20  # ~1,12 registros por paciente


def test_los_registros_de_un_paciente_comparten_perfil(grande):
    df = grande.dataframe
    perfil = ["genero", "edad", "bmi", "duracion_diabetes", "categoria_medicacion", "com_hipertension",
              "com_dislipidemia", "com_renal", "com_neuropatia", "com_nefropatia", "com_cardiovascular"]

    assert (df.groupby("id_paciente_sintetico")[perfil].nunique() == 1).all().all()


# --- Prevalencia y AUC -------------------------------------------------------

@pytest.mark.parametrize("n,semilla", [(500, 1), (2000, 2), (2000, SEMILLA), (5000, 3)])
def test_prevalencia_dentro_de_la_tolerancia(n, semilla):
    resultado = generar_dataset(n, semilla)

    assert resultado.dataframe["hipoglucemia_registro"].mean() == pytest.approx(0.15, abs=0.015)


def test_la_calibracion_da_el_conteo_exacto():
    rng = np.random.default_rng(0)
    s = rng.normal(size=1000)
    u = rng.random(1000)

    b0 = calibrar_intercepto(s, u, 150)

    from scipy.special import expit
    assert int((u < expit(s + b0)).sum()) == 150


def test_auc_de_las_probabilidades_verdaderas_dentro_de_0_70_y_0_80(grande, por_defecto, capsys):
    y = grande.dataframe["hipoglucemia_registro"].to_numpy()
    auc_grande = auc_roc(y, grande.probabilidad)
    y2 = por_defecto.dataframe["hipoglucemia_registro"].to_numpy()
    auc_defecto = auc_roc(y2, por_defecto.probabilidad)
    with capsys.disabled():
        print(f"\n[S2] AUC de las probabilidades verdaderas: n=60000 -> {auc_grande:.4f}; n=2000 (semilla {SEMILLA}) -> {auc_defecto:.4f}")

    assert 0.70 <= auc_grande <= 0.80
    assert 0.70 <= auc_defecto <= 0.80


def test_auc_propio_coincide_con_scikit_learn(por_defecto):
    y = por_defecto.dataframe["hipoglucemia_registro"].to_numpy()

    assert auc_roc(y, por_defecto.probabilidad) == pytest.approx(roc_auc_score(y, por_defecto.probabilidad))


def test_la_etiqueta_es_un_muestreo_y_no_el_umbral_de_las_reglas(por_defecto):
    """Ruido: hay positivos con probabilidad baja y negativos con probabilidad alta."""
    y = por_defecto.dataframe["hipoglucemia_registro"].to_numpy()
    p = por_defecto.probabilidad

    assert (y[p < 0.05] == 1).any() or (p < 0.05).sum() < 30
    assert (y[p > 0.30] == 0).any()


def test_una_escala_mayor_separa_mas(por_defecto):
    debil = generar_dataset(20000, 4, escala_senal=0.4)
    fuerte = generar_dataset(20000, 4, escala_senal=1.2)

    auc_d = auc_roc(debil.dataframe["hipoglucemia_registro"], debil.probabilidad)
    auc_f = auc_roc(fuerte.dataframe["hipoglucemia_registro"], fuerte.probabilidad)
    assert auc_f > auc_d + 0.05
    assert fuerte.dataframe["hipoglucemia_registro"].mean() == pytest.approx(0.15, abs=0.001)


# --- Reglas incluidas: sentido del efecto ------------------------------------

def test_insulina_y_sulfonilurea_elevan_la_tasa_frente_a_ninguno(grande):
    tasa = grande.dataframe.groupby("categoria_medicacion")["hipoglucemia_registro"].mean()

    assert tasa["insulina"] > tasa["ninguno"] + 0.05
    assert tasa["sulfonilurea"] > tasa["ninguno"] + 0.03
    assert tasa["insulina"] > tasa["sulfonilurea"] > tasa["metformina_u_otros"]


def test_sentido_marginal_de_otras_reglas(grande):
    df = grande.dataframe
    y = df["hipoglucemia_registro"]

    assert y[df["momento"] == "ayunas"].mean() > y[df["momento"] == "postprandial"].mean()
    assert y[df["glucosa"] < 100].mean() > y[df["glucosa"] > 180].mean()
    assert y[df["com_renal"]].mean() > y[~df["com_renal"]].mean()
    assert y[df["edad"] >= 75].mean() > y[df["edad"] < 50].mean()


def test_los_coeficientes_se_recuperan_y_los_controles_no_tienen_efecto(grande):
    """
    Regresion logistica con la especificacion completa de las reglas: recupera los
    coeficientes (por la escala 0,8) y los controles quedan cerca de 0.
    """
    df = grande.dataframe
    escala = grande.escala_senal
    medicacion = df["categoria_medicacion"]
    riesgo = medicacion.isin(["insulina", "sulfonilurea"])
    h = df["hba1c"]
    X = pd.DataFrame({
        "insulina": (medicacion == "insulina").astype(float),
        "sulfonilurea": (medicacion == "sulfonilurea").astype(float),
        "metformina": (medicacion == "metformina_u_otros").astype(float),
        "ln_glucosa": np.log(np.clip(df["glucosa"], 45, 300) / 130),
        "ayunas": (df["momento"] == "ayunas").astype(float),
        "duracion": np.minimum(df["duracion_diabetes"], 25) - 8,
        "edad": np.clip(df["edad"], 40, 90) - 60,
        "hba1c_menor_7_riesgo": (riesgo & (h < 7)).astype(float),
        "hba1c_menor_7_otro": (~riesgo & (h < 7)).astype(float),
        "hba1c_7_8_riesgo": (riesgo & (h >= 7) & (h < 8)).astype(float),
        "hba1c_mayor_9": (h > 9).astype(float),
        "bmi_bajo": (df["bmi"] < 20).astype(float),
        "renal": df["com_renal"].astype(float),
        "nefropatia": df["com_nefropatia"].astype(float),
        "edad75_insulina": ((df["edad"] >= 75) & (medicacion == "insulina")).astype(float),
        # controles
        "c_genero_masc": (df["genero"] == "masculino").astype(float),
        "c_hipertension": df["com_hipertension"].astype(float),
        "c_dislipidemia": df["com_dislipidemia"].astype(float),
        "c_neuropatia": df["com_neuropatia"].astype(float),
        "c_cardiovascular": df["com_cardiovascular"].astype(float),
    })
    modelo = LogisticRegression(C=1e6, max_iter=5000).fit(X, df["hipoglucemia_registro"])
    coef = dict(zip(X.columns, modelo.coef_[0]))
    c = reglas.COEFICIENTES

    esperados = {
        "insulina": (c["insulina"], 0.25),
        "sulfonilurea": (c["sulfonilurea"], 0.3),
        "ln_glucosa": (c["glucosa_pendiente"], 0.25),
        "ayunas": (c["ayunas"], 0.15),
        "duracion": (c["duracion_pendiente"], 0.02),
        "edad": (c["edad_pendiente"], 0.01),
        "hba1c_menor_7_riesgo": (c["hba1c_menor_7_con_riesgo"], 0.3),
        "renal": (c["com_renal"], 0.25),
    }
    for nombre, (verdadero, tolerancia) in esperados.items():
        assert coef[nombre] == pytest.approx(escala * verdadero, abs=tolerancia), f"{nombre}: {coef[nombre]:.3f}"
    # sentidos de las demas reglas
    assert coef["hba1c_menor_7_riesgo"] > coef["hba1c_menor_7_otro"]
    assert coef["hba1c_mayor_9"] < 0
    assert coef["bmi_bajo"] > 0
    assert coef["edad75_insulina"] > 0
    for control in ("c_genero_masc", "c_hipertension", "c_dislipidemia", "c_neuropatia", "c_cardiovascular"):
        assert abs(coef[control]) < 0.15, f"{control} tiene efecto: {coef[control]:.3f}"


# --- Controles: sin efecto ----------------------------------------------------

@pytest.mark.parametrize("columna,valores", [
    ("genero", ("femenino", "masculino")),
    ("com_hipertension", (False, True)),
    ("com_dislipidemia", (False, True)),
    ("com_neuropatia", (False, True)),
    ("com_cardiovascular", (False, True)),
])
def test_los_controles_no_alteran_la_probabilidad(columna, valores):
    a, b = (_s(**{columna: v}) for v in valores)

    assert a == b
    assert columna in reglas.VARIABLES_SIN_EFECTO
    assert columna not in reglas.COLUMNAS_USADAS


def test_la_tasa_no_difiere_entre_generos(grande):
    """Genero no tiene ningun confusor en el generador: la tasa marginal debe ser igual (z < 3)."""
    df = grande.dataframe
    a = df.loc[df["genero"] == "femenino", "hipoglucemia_registro"]
    b = df.loc[df["genero"] == "masculino", "hipoglucemia_registro"]
    p = df["hipoglucemia_registro"].mean()
    z = (a.mean() - b.mean()) / np.sqrt(p * (1 - p) * (1 / len(a) + 1 / len(b)))

    assert abs(z) < 3, f"z={z:.2f}"


def test_la_tasa_no_difiere_en_dislipidemia(grande):
    df = grande.dataframe
    a = df.loc[df["com_dislipidemia"], "hipoglucemia_registro"]
    b = df.loc[~df["com_dislipidemia"], "hipoglucemia_registro"]
    p = df["hipoglucemia_registro"].mean()
    z = (a.mean() - b.mean()) / np.sqrt(p * (1 - p) * (1 / len(a) + 1 / len(b)))

    assert abs(z) < 3, f"z={z:.2f}"  # constante en la edad y la duracion: sin confusor


# --- Interacciones y terminos ------------------------------------------------

def test_interaccion_1_hba1c_bajo_pesa_mas_con_insulina_o_sulfonilurea():
    c = reglas.COEFICIENTES
    for med in ("insulina", "sulfonilurea"):
        assert _s(categoria_medicacion=med, hba1c=6.5) - _s(categoria_medicacion=med, hba1c=8.5) == pytest.approx(c["hba1c_menor_7_con_riesgo"])
        assert _s(categoria_medicacion=med, hba1c=7.5) - _s(categoria_medicacion=med, hba1c=8.5) == pytest.approx(c["hba1c_7_a_8_con_riesgo"])
    for med in ("ninguno", "metformina_u_otros"):
        assert _s(categoria_medicacion=med, hba1c=6.5) - _s(categoria_medicacion=med, hba1c=8.5) == pytest.approx(c["hba1c_menor_7_sin_riesgo"])
        assert _s(categoria_medicacion=med, hba1c=7.5) == _s(categoria_medicacion=med, hba1c=8.5)
    assert c["hba1c_menor_7_con_riesgo"] > c["hba1c_menor_7_sin_riesgo"]


def test_interaccion_2_edad_75_con_insulina():
    c = reglas.COEFICIENTES
    paso_edad = c["edad_pendiente"]  # 74 -> 75 suma tambien el termino lineal de la edad

    con_insulina = _s(categoria_medicacion="insulina", edad=75) - _s(categoria_medicacion="insulina", edad=74)
    sin_insulina = _s(categoria_medicacion="ninguno", edad=75) - _s(categoria_medicacion="ninguno", edad=74)
    sulfonilurea = _s(categoria_medicacion="sulfonilurea", edad=75) - _s(categoria_medicacion="sulfonilurea", edad=74)

    assert con_insulina - paso_edad == pytest.approx(c["edad_75_con_insulina"])
    assert sin_insulina == pytest.approx(paso_edad)
    assert sulfonilurea == pytest.approx(paso_edad)


def test_hba1c_alta_baja_el_riesgo_y_ausente_no_aporta():
    c = reglas.COEFICIENTES

    assert _s(hba1c=9.5) - _s(hba1c=8.5) == pytest.approx(c["hba1c_mayor_9"])
    assert _s(hba1c=np.nan) == _s(hba1c=8.5)  # ausente = neutral


def test_otros_terminos():
    c = reglas.COEFICIENTES

    assert _s(bmi=19.5) - _s(bmi=25.0) == pytest.approx(c["bmi_menor_20"])
    assert _s(com_renal=True) - _s() == pytest.approx(c["com_renal"])
    assert _s(com_nefropatia=True) - _s() == pytest.approx(c["com_nefropatia"])
    assert _s(momento="ayunas") - _s() == pytest.approx(c["ayunas"])
    assert _s(categoria_medicacion="insulina") - _s() == pytest.approx(c["insulina"])
    assert _s(glucosa=70.0) - _s(glucosa=130.0) == pytest.approx(-1.8 * np.log(70 / 130))
    assert _s(glucosa=900.0) == _s(glucosa=300.0)  # recorte superior
    assert _s(duracion_diabetes=30.0) == _s(duracion_diabetes=25.0)  # recorte de la duracion


# --- Aislamiento: no lee datos reales, no importa otros servicios --------------

FUENTES = sorted(APP_SINTETICO.glob("*.py"))


def test_hay_fuentes_que_revisar():
    assert {f.name for f in FUENTES} >= {"reglas.py", "generador.py", "generar.py", "__init__.py"}


@pytest.mark.parametrize("fuente", FUENTES, ids=lambda f: f.name)
def test_no_importa_backend_app_ni_nlp_service_ni_los_datos_reales(fuente):
    texto = fuente.read_text(encoding="utf-8")
    importaciones = re.findall(r"^\s*(?:from|import)\s+([\w.]+)", texto, re.MULTILINE)

    for modulo in importaciones:
        assert not modulo.startswith(("nlp_service", "backend")), modulo
        assert modulo not in ("app.data_prep", "app.train_baseline", "app.predict", "app.cv_evaluacion"), modulo
        assert not modulo.startswith("app.ml"), modulo
        assert not modulo.startswith("sklearn"), modulo
    for prohibido in ("read_excel", "ShanghaiT2DM", "RAW_DATA_PATH", "cargar_summary_crudo", "openpyxl"):
        assert prohibido not in texto, prohibido


def test_generar_no_lee_ningun_archivo_de_datos(monkeypatch, tmp_path):
    def leer(*a, **k):
        raise AssertionError("el generador intento leer un archivo de datos")

    monkeypatch.setattr(pd, "read_excel", leer)
    monkeypatch.setattr(pd, "read_csv", leer)

    resultado = generar_dataset(200, 3)
    escribir_dataset(resultado, str(tmp_path / "ds.csv"))


@pytest.mark.parametrize("ruta", [
    "backend/ml_service/data/raw/salida.csv",
    "C:/x/data/raw/ShanghaiT2DM_Summary.csv",
    "ds.xlsx",
    "ds.pkl",
    "ds.txt",
])
def test_rechaza_rutas_de_salida_peligrosas(ruta):
    with pytest.raises(ValueError):
        validar_ruta_de_salida(ruta)


def test_no_mezcla_con_los_datos_reales_los_ids_no_se_parecen(por_defecto):
    assert not por_defecto.dataframe["id_paciente_sintetico"].str.contains(r"^\d").any()
    assert por_defecto.dataframe["id_paciente_sintetico"].str.startswith("sint-").all()


# --- Metadatos ---------------------------------------------------------------

CAMPOS_METADATOS = {
    "origen", "advertencia", "version_esquema", "version_reglas", "semilla", "fecha", "n_registros",
    "n_pacientes", "prevalencia_objetivo", "prevalencia_obtenida", "escala_senal", "intercepto",
    "auc_oraculo", "percentiles_probabilidad", "tasa_positivos_por_medicacion", "hba1c_ausente",
    "sha256_csv", "versiones",
}


def test_los_metadatos_se_escriben_completos(tmp_path):
    ruta = str(tmp_path / "ds.csv")
    resultado = generar_dataset(1000, 9)

    escrito = escribir_dataset(resultado, ruta)

    desde_disco = json.loads(Path(generador.ruta_metadatos(ruta)).read_text(encoding="utf-8"))
    assert desde_disco == escrito
    assert set(desde_disco) == CAMPOS_METADATOS
    assert desde_disco["origen"] == "sintetico"
    assert desde_disco["semilla"] == 9
    assert desde_disco["version_reglas"] == reglas.VERSION_REGLAS
    assert desde_disco["n_registros"] == 1000
    assert desde_disco["prevalencia_objetivo"] == 0.15
    assert desde_disco["prevalencia_obtenida"] == pytest.approx(0.15, abs=0.0015)
    assert 0.5 < desde_disco["auc_oraculo"] < 1.0
    assert set(desde_disco["versiones"]) == {"python", "numpy", "pandas", "scipy"}
    assert all(v for v in desde_disco["versiones"].values())
    assert "pendientes de revision" in desde_disco["advertencia"]
    assert re.fullmatch(r"[0-9a-f]{64}", desde_disco["sha256_csv"])
    assert desde_disco["sha256_csv"] == generador._sha256(ruta)
    assert set(desde_disco["percentiles_probabilidad"]) == {"p5", "p25", "p50", "p75", "p95", "p99"}
    assert set(desde_disco["tasa_positivos_por_medicacion"]) == {"ninguno", "metformina_u_otros", "sulfonilurea", "insulina"}


def test_los_metadatos_no_contienen_ids_ni_valores_por_registro(tmp_path):
    ruta = str(tmp_path / "ds.csv")
    escribir_dataset(generar_dataset(300, 2), ruta)

    texto = Path(generador.ruta_metadatos(ruta)).read_text(encoding="utf-8")

    assert "sint-" not in texto
    assert "id_paciente" not in texto


def test_metadatos_sin_csv_dejan_la_huella_vacia(por_defecto):
    assert construir_metadatos(por_defecto)["sha256_csv"] is None


def test_el_dataset_no_trae_la_probabilidad_verdadera(por_defecto):
    assert not any("prob" in c for c in por_defecto.dataframe.columns)


# --- Argumentos invalidos y CLI ----------------------------------------------

@pytest.mark.parametrize("kwargs", [{"n": 10}, {"prevalencia": 0.0}, {"prevalencia": 1.0}, {"escala_senal": 0}])
def test_argumentos_invalidos(kwargs):
    with pytest.raises(ValueError):
        generar_dataset(**{"n": 200, **kwargs})


def test_cli_escribe_csv_y_metadatos(tmp_path, capsys):
    salida = str(tmp_path / "demo" / "ds.csv")

    codigo = cli_main(["--n", "400", "--semilla", "5", "--salida", salida])

    texto = capsys.readouterr().out
    assert codigo == 0
    assert "SINTETICO" in texto and "no es evidencia clinica" in texto
    assert os.path.exists(salida) and os.path.exists(generador.ruta_metadatos(salida))
    assert "sint-" not in texto  # el CLI solo imprime agregados


def test_cli_rechaza_data_raw(tmp_path, capsys):
    codigo = cli_main(["--n", "400", "--salida", str(tmp_path / "data" / "raw" / "x.csv")])

    assert codigo == 2
    assert not (tmp_path / "data" / "raw" / "x.csv").exists()


def test_el_csv_usa_origen_sintetico_en_cada_linea(tmp_path):
    ruta = str(tmp_path / "ds.csv")
    escribir_dataset(generar_dataset(300, 1), ruta)

    leido = pd.read_csv(ruta)

    assert (leido["origen"] == "sintetico").all()
    assert leido["hba1c"].isna().any()  # los vacios del CSV vuelven como NaN
