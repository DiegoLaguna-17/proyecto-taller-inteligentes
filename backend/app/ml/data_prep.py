"""
Preparacion de datos para el modelo de riesgo de hipoglucemia de GlucoTracker.

Extraido y adaptado de las Partes A y B del notebook de EDA/feature engineering
(`GlucoTracker_Consolidado_Hipoglucemia.ipynb`). Sin dependencias de Google
Colab: la ruta al Excel crudo se resuelve con `os.path` de forma relativa a
este archivo, para que funcione igual en cualquier maquina/contenedor donde
se despliegue el backend.

Uso tipico (ver `train_baseline.py`):

    df_crudo = cargar_summary_crudo()
    df_limpio = limpiar_datos_clinicos(df_crudo)
    X, y, grupos, columnas_features = preparar_features(df_limpio)
"""

import os

import numpy as np
import pandas as pd

# backend/app/ml/data_prep.py -> backend/data/raw/ShanghaiT2DM_Summary.xlsx
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW_DATA_PATH = os.path.join(BASE_DIR, "data", "raw", "ShanghaiT2DM_Summary.xlsx")

# Columnas de laboratorio/antropometria que deben forzarse a numerico
# (llegan como texto porque el dataset usa "/" como marcador de nulo).
COLUMNAS_NUMERICAS_CRUDAS = [
    "Age (years)", "Height (m)", "Weight (kg)", "BMI (kg/m2)",
    "Smoking History (pack year)", "Duration of diabetes (years)",
    "Fasting Plasma Glucose (mg/dl)", "2-hour Postprandial Plasma Glucose (mg/dl)",
    "Fasting C-peptide (nmol/L)", "2-hour Postprandial C-peptide (nmol/L)",
    "Fasting Insulin (pmol/L)", "2-hour Postprandial insulin (pmol/L)",
    "HbA1c (%)", "Glycated Albumin (%)",
    "Total Cholesterol (mmol/L)", "Triglyceride (mmol/L)",
    "High-Density Lipoprotein Cholesterol (mmol/L)", "Low-Density Lipoprotein Cholesterol (mmol/L)",
    "Creatinine (umol/L)", "Estimated Glomerular Filtration Rate  (ml/min/1.73m2) ",
    "Uric Acid (mmol/L)", "Blood Urea Nitrogen (mmol/L)",
]

# Orden de riesgo clinico usado tanto para simplificar el texto de medicacion
# como para codificarla como entero antes de entrenar (Celda B3 del notebook).
MAPEO_MEDICACION = {"ninguno": 0, "metformina_u_otros": 1, "sulfonilurea": 2, "insulina": 3}
MAPEO_MOMENTO = {"ayunas": 0, "postprandial": 1}

# Columnas opcionales con nulos que se manejan con bandera + imputacion
# (ver docstring de `preparar_features`).
#
# NOTA DE ALCANCE: solo HbA1c queda como campo opcional del perfil de la app
# (se pide una vez, "si lo conoces"). Se descarto eGFR/Creatinina de la
# superficie de entrada de produccion -- son labs que la app no tiene forma
# de pedirle al usuario de forma realista, a diferencia de HbA1c que es un
# valor que cualquier paciente diabetico suele conocer de sus controles.
COLUMNAS_OPCIONALES_CON_NAN = [
    "HbA1c (%)",
]


def cargar_summary_crudo(ruta: str = RAW_DATA_PATH) -> pd.DataFrame:
    """Carga el Excel crudo del summary (ShanghaiT2DM) tal cual llega, sin limpiar."""
    if not os.path.exists(ruta):
        raise FileNotFoundError(
            f"No se encontro el summary en {ruta}. "
            "Coloca 'ShanghaiT2DM_Summary.xlsx' en backend/data/raw/."
        )
    df = pd.read_excel(ruta, sheet_name=0)
    df.columns = [str(c).strip() for c in df.columns]
    return df


def _limpiar_texto_lista(texto):
    """Normaliza campos tipo lista separados por comas (quita espacios y duplicados)."""
    if pd.isna(texto):
        return texto
    partes = [p.strip() for p in str(texto).split(",")]
    partes_unicas = list(dict.fromkeys(p for p in partes if p))
    return ", ".join(partes_unicas)


def _tiene_palabra(texto, palabras) -> bool:
    if pd.isna(texto):
        return False
    t = str(texto).lower()
    return any(p in t for p in palabras)


def _simplificar_agente(texto) -> str:
    """
    Reduce el texto libre de 'Hypoglycemic Agents' a 4 categorias ordenadas
    por riesgo clinico de causar hipoglucemia: insulina y sulfonilureas la
    causan directamente; metformina y otros orales, practicamente no.
    """
    if pd.isna(texto) or str(texto).strip().lower() == "none":
        return "ninguno"
    t = str(texto).lower()
    palabras_insulina = ["insulin", "novolin", "degludec", "aspart", "glargine", "csii", "lispro", "detemir"]
    palabras_sulfonilurea = ["glimepiride", "glipizide", "gliclazide", "glyburide", "glibenclamide"]
    if any(p in t for p in palabras_insulina):
        return "insulina"
    if any(p in t for p in palabras_sulfonilurea):
        return "sulfonilurea"
    return "metformina_u_otros"


def limpiar_datos_clinicos(df: pd.DataFrame) -> pd.DataFrame:
    """
    Limpieza clinica base (Parte A del notebook, celdas A2, A5, A6):

    1. Reemplaza el marcador de nulo propio de ShanghaiT2DM (texto "/") por NaN real.
    2. Fuerza a numerico las columnas de laboratorio/antropometria.
    3. Define el target `riesgo_hipoglucemia_paciente` a partir de la columna
       real del dataset (Hypoglycemia yes/no) -- no se calcula nada propio.
    4. Extrae banderas binarias de comorbilidades relevantes para hipoglucemia
       (hipertension, dislipidemia, renal, neuropatia, nefropatia, cardiovascular).
    5. Recodifica `Hypoglycemic Agents` a `categoria_medicacion` (4 categorias).

    No hace split, no imputa, no expande a nivel de lectura -- eso vive en
    `preparar_features` y en el notebook (Celda A9), porque son pasos que
    dependen de si se esta construyendo el dataset de entrenamiento o
    sirviendo una prediccion en produccion.
    """
    df = df.copy()

    # 1. Marcador de nulo propio del dataset -> NaN real
    df = df.replace(to_replace=r"^\s*/\s*$", value=np.nan, regex=True).infer_objects(copy=False)
    # 2. Forzar a numerico
    for col in COLUMNAS_NUMERICAS_CRUDAS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # 3. Target real del dataset
    if "Hypoglycemia (yes/no)" in df.columns:
        df["riesgo_hipoglucemia_paciente"] = df["Hypoglycemia (yes/no)"].str.strip().str.lower()

    # 4. Comorbilidades -> banderas binarias
    for col in ["Comorbidities", "Diabetic Macrovascular  Complications", "Diabetic Microvascular Complications"]:
        if col in df.columns:
            df[col] = df[col].apply(_limpiar_texto_lista)

    if "Comorbidities" in df.columns:
        df["com_hipertension"] = df["Comorbidities"].apply(lambda t: _tiene_palabra(t, ["hypertension"]))
        df["com_dislipidemia"] = df["Comorbidities"].apply(lambda t: _tiene_palabra(t, ["hyperlipidemia", "dyslipidemia"]))
        df["com_renal"] = df["Comorbidities"].apply(lambda t: _tiene_palabra(t, ["renal", "kidney", "nephro"]))

    if "Diabetic Microvascular Complications" in df.columns:
        df["com_neuropatia"] = df["Diabetic Microvascular Complications"].apply(lambda t: _tiene_palabra(t, ["neuropathy"]))
        df["com_nefropatia"] = df["Diabetic Microvascular Complications"].apply(lambda t: _tiene_palabra(t, ["nephropathy"]))

    if "Diabetic Macrovascular  Complications" in df.columns:
        df["com_cardiovascular"] = df["Diabetic Macrovascular  Complications"].apply(
            lambda t: _tiene_palabra(t, ["coronary", "cerebrovascular", "arterial"])
        )

    # 5. Medicacion -> categoria de riesgo
    if "Hypoglycemic Agents" in df.columns:
        df["categoria_medicacion"] = df["Hypoglycemic Agents"].apply(_simplificar_agente)

    return df


def _expandir_a_nivel_de_lectura(df: pd.DataFrame) -> pd.DataFrame:
    """
    Celda A9 del notebook: cada paciente aporta hasta 2 filas (ayunas / postprandial),
    ambas con el mismo perfil clinico y el mismo target -- porque siguen siendo la
    misma persona con el mismo riesgo de fondo, solo observado en dos momentos.

    Esto SOLO tiene sentido para construir el dataset de entrenamiento a partir
    del summary (que trae FPG y PPG por paciente). En produccion, `predict.py`
    ya recibe una sola lectura (glucosa + momento) directo del usuario, asi que
    esta funcion no se usa fuera de `train_baseline.py`.
    """
    filas = []
    for _, row in df.iterrows():
        perfil_base = row.to_dict()

        fpg = row.get("Fasting Plasma Glucose (mg/dl)")
        if pd.notna(fpg):
            fila = dict(perfil_base)
            fila["glucosa"] = fpg
            fila["momento"] = "ayunas"
            filas.append(fila)

        ppg = row.get("2-hour Postprandial Plasma Glucose (mg/dl)")
        if pd.notna(ppg):
            fila = dict(perfil_base)
            fila["glucosa"] = ppg
            fila["momento"] = "postprandial"
            filas.append(fila)

    return pd.DataFrame(filas)


COLUMNAS_NUMERICAS_MODELO = ["glucosa", "Age (years)", "BMI (kg/m2)", "Duration of diabetes (years)"] + COLUMNAS_OPCIONALES_CON_NAN
COLUMNAS_BINARIAS_COMORBILIDAD = [
    "com_hipertension", "com_dislipidemia", "com_renal",
    "com_neuropatia", "com_nefropatia", "com_cardiovascular",
]


def preparar_features(df: pd.DataFrame, expandir_lecturas: bool = True, medianas_imputacion: dict = None):
    """
    Parte B del notebook: deja el dataframe listo en formato X / y / grupos
    para entrenar (o para pasar por el mismo preprocesamiento en prediccion).

    Pasos (en este orden, documentado porque el orden importa):
      1. (Opcional) Expandir a nivel de lectura -- solo aplica al construir
         el dataset de entrenamiento desde el summary crudo.
      2. Codificar el target y las binarias simples (genero, comorbilidades).
      3. Codificar `momento` y `categoria_medicacion` como enteros simples
         (label encoding) -- el one-hot real ocurre DENTRO del pipeline de
         entrenamiento (ColumnTransformer en train_baseline.py), no aqui.
      4. HbA1c (y eGFR si esta disponible): son campos OPCIONALES del perfil
         en la app -- el usuario puede no tener ese dato. En vez de descartar
         esas filas o dejar el hueco tal cual, se crea una bandera binaria
         `<col>_faltante` (1 si no se conocia el dato) y se imputa con la
         mediana. Asi el modelo puede usar el valor cuando existe, y sabe
         explicitamente cuando no existe, en vez de que un cero o un promedio
         se confundan con un valor real.
      5. Arma `X` (features), `y` (target binario) y `grupos` (id_paciente_real,
         para el split agrupado que evita fuga de datos entre visitas del
         mismo paciente).

    `medianas_imputacion`: dict opcional {columna: mediana}. En entrenamiento
    se deja en None y la mediana se calcula del propio dataset (y se debe
    guardar junto con el modelo -- ver `train_baseline.py`). En produccion
    (`predict.py`), donde llega UN solo paciente, no tiene sentido calcular
    una mediana de una sola fila -- ahi se pasan las medianas ya calculadas
    en entrenamiento, para que un paciente sin HbA1c reciba exactamente el
    mismo valor de relleno que uso el modelo al aprender.

    Retorna:
        X (pd.DataFrame), y (pd.Series | None), grupos (pd.Series | None),
        columnas_features (list[str]), medianas_usadas (dict) -- estas ultimas
        hay que guardarlas junto con el modelo para reproducir la imputacion
        en produccion.
    """
    df = df.copy()

    if expandir_lecturas:
        if "id_paciente_real" not in df.columns and "Patient Number" in df.columns:
            df["id_paciente_real"] = df["Patient Number"].astype(str).str.split("_").str[0]
        df = _expandir_a_nivel_de_lectura(df)

    if "id_paciente_real" not in df.columns and "Patient Number" in df.columns:
        df["id_paciente_real"] = df["Patient Number"].astype(str).str.split("_").str[0]

    # 2. Target y binarias
    if "riesgo_hipoglucemia_paciente" in df.columns:
        df["y"] = (df["riesgo_hipoglucemia_paciente"].astype(str).str.strip().str.lower() == "yes").astype(int)

    if "Gender (Female=1, Male=2)" in df.columns:
        df["genero_masculino"] = (df["Gender (Female=1, Male=2)"] == 2).astype(int)

    for col in COLUMNAS_BINARIAS_COMORBILIDAD:
        if col in df.columns:
            df[col] = df[col].astype(int)

    # 3. Label encoding de categoricas de mas de 2 valores
    if "momento" in df.columns:
        df["momento_cod"] = df["momento"].map(MAPEO_MOMENTO)
    if "categoria_medicacion" in df.columns:
        df["medicacion_cod"] = df["categoria_medicacion"].map(MAPEO_MEDICACION)

    # 4. HbA1c / eGFR: bandera de faltante + imputacion por mediana
    columnas_opcionales_presentes = [c for c in COLUMNAS_OPCIONALES_CON_NAN if c in df.columns]
    medianas_usadas = {}
    for col in columnas_opcionales_presentes:
        nombre_bandera = col.split(" (")[0].strip().lower().replace(" ", "_") + "_faltante"
        df[nombre_bandera] = df[col].isna().astype(int)
        if medianas_imputacion is not None and col in medianas_imputacion:
            mediana = medianas_imputacion[col]
        else:
            mediana = df[col].median()
        medianas_usadas[col] = mediana
        df[col] = df[col].fillna(mediana)

    columnas_banderas_faltante = [c for c in df.columns if c.endswith("_faltante")]
    columnas_categoricas_modelo = ["momento_cod", "medicacion_cod", "genero_masculino"] + \
        [c for c in COLUMNAS_BINARIAS_COMORBILIDAD if c in df.columns]
    columnas_numericas_presentes = [c for c in COLUMNAS_NUMERICAS_MODELO if c in df.columns]

    columnas_features = columnas_numericas_presentes + columnas_categoricas_modelo + columnas_banderas_faltante
    columnas_features = [c for c in columnas_features if c in df.columns]

    X = df[columnas_features].copy()
    y = df["y"].copy() if "y" in df.columns else None
    grupos = df["id_paciente_real"].copy() if "id_paciente_real" in df.columns else None

    return X, y, grupos, columnas_features, medianas_usadas
