"""
Validacion cruzada agrupada por paciente del modelo de riesgo de hipoglucemia
(fase M2, TASK-010a; decisiones ML-D2 y ML-D3, ver docs/adr/0007).

Uso:
    python -m app.cv_evaluacion
    (correr desde backend/ml_service/, con el entorno virtual activado)

Escribe `app/artefactos/cv_metrics.json` y una tabla por consola. No toca
`modelo_hipoglucemia.pkl` ni `baseline_metrics.json`: el modelo y las metricas
de `train_baseline.py` siguen siendo los de la linea base.

Decisiones que determinan como leer los numeros:

- Esquema: StratifiedKFold sobre la lista de PACIENTES (etiqueta = el paciente
  tiene algun registro positivo), mapeado despues a sus filas. Con solo 10
  pacientes positivos, StratifiedGroupKFold estratifica por filas y, en 13 de
  20 semillas probadas, dejo folds de test sin ningun positivo (AUC
  indefinido); GroupKFold no estratifica. Estratificar por paciente garantiza
  2 pacientes positivos por fold con k=5 y mantiene a cada paciente entero de
  un solo lado.
- Repetido con semillas de particion fijas. Los modelos usan siempre
  RANDOM_STATE de train_baseline.py: todas las variantes ven exactamente los
  mismos folds y las mismas semillas.
- SMOTE-NC vive dentro del Pipeline de imblearn: solo se ajusta con el train
  de cada fold, nunca toca el test.
- Metricas agregadas: se calculan sobre las predicciones out-of-fold de cada
  repeticion y se promedian entre repeticiones. IC 95%: bootstrap percentil
  sobre PACIENTES (se remuestrean pacientes completos con todas sus filas, no
  filas sueltas), recalculando la metrica en cada repeticion y promediando.
- Variantes: hiperparametros fijados antes de ver resultados, no ajustados.
  Arbol: max_depth=3 (a lo sumo 8 hojas para ~13 filas positivas por train)
  y min_samples_leaf=5 (una hoja no puede describir un unico registro, que
  aporta hasta 2 filas). Random Forest: los mismos valores de la celda D1 del
  notebook (300 arboles, max_depth=5, min_samples_leaf=3), elegidos alli antes
  de esta evaluacion.

Referencias sin entrenamiento (fase M2b): un puntaje constante (AUC = 0.5 por
definicion, comprueba el calculo de metricas) y la regla por medicacion
(puntaje = medicacion_cod, sin ajustar nada con los datos). Pasan por los mismos
folds, semillas y bootstrap que las variantes, pero se guardan en la seccion
`referencias` del JSON: son contexto y NO entran en la regla de cambio de modelo
de ML-D2. Ademas se reporta la prevalencia de positivos y el lift de cada
umbral (precision / prevalencia, 1.0 = igual que marcar al azar).

Limitacion heredada (no se corrige aqui para no cambiar la semantica de
data_prep.py): `preparar_features` imputa la mediana de HbA1c con todo el
dataset antes de partir, asi que esa mediana ve filas de test.

No se registran valores de glucosa ni datos de pacientes: solo conteos y
metricas agregadas.
"""

import hashlib
import json
import os
import platform
from datetime import datetime, timezone
from importlib import metadata

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import precision_recall_fscore_support, roc_auc_score
from sklearn.model_selection import StratifiedKFold
from sklearn.tree import DecisionTreeClassifier

from app.data_prep import RAW_DATA_PATH, cargar_summary_crudo, limpiar_datos_clinicos, preparar_features
from app.train_baseline import ARTEFACTOS_DIR, METRICAS_PATH, RANDOM_STATE, construir_pipeline

CV_METRICS_PATH = os.path.join(ARTEFACTOS_DIR, "cv_metrics.json")

N_SPLITS = 5
SEMILLAS_PARTICION = (0, 1, 2, 3, 4)
N_BOOTSTRAP = 1000
SEMILLA_BOOTSTRAP = RANDOM_STATE
UMBRALES = (0.25, 0.5)
# Cortes naturales de medicacion_cod (0 ninguno, 1 metformina u otros, 2 sulfonilurea, 3 insulina)
UMBRALES_MEDICACION = (1, 2, 3)
# Puntaje de la referencia constante: iguala o supera ambos UMBRALES, asi que marca a todos como positivos
PUNTAJE_CONSTANTE = 0.5
LIBRERIAS = ("scikit-learn", "imbalanced-learn", "numpy", "pandas", "scipy", "joblib", "openpyxl")

HIPERPARAMETROS_ARBOL = {"max_depth": 3, "min_samples_leaf": 5, "class_weight": "balanced", "random_state": RANDOM_STATE}
HIPERPARAMETROS_RF = {
    "n_estimators": 300, "max_depth": 5, "min_samples_leaf": 3,
    "class_weight": "balanced", "random_state": RANDOM_STATE, "n_jobs": 1,
}


def _sin_smote(pipeline):
    """Misma tuberia de train_baseline.py, sin el paso de SMOTE-NC."""
    return pipeline.set_params(smote="passthrough")


# Cada variante reutiliza construir_pipeline (mismo preprocesamiento, mismas
# columnas categoricas, misma semilla) y solo cambia lo que la define.
VARIANTES = {
    "rl_smote": {
        "descripcion": "Regresion Logistica + SMOTE-NC (linea base actual)",
        "construir": construir_pipeline,
        "hiperparametros": {},
    },
    "rl_sin_smote": {
        "descripcion": "Regresion Logistica sin SMOTE-NC",
        "construir": lambda X, y: _sin_smote(construir_pipeline(X, y)),
        "hiperparametros": {},
    },
    "rl_balanced": {
        "descripcion": "Regresion Logistica sin SMOTE-NC, class_weight='balanced'",
        "construir": lambda X, y: _sin_smote(construir_pipeline(X, y)).set_params(modelo__class_weight="balanced"),
        "hiperparametros": {"class_weight": "balanced"},
    },
    "arbol_balanced": {
        "descripcion": "Arbol de decision sin SMOTE-NC, class_weight='balanced'",
        "construir": lambda X, y: _sin_smote(construir_pipeline(X, y)).set_params(
            modelo=DecisionTreeClassifier(**HIPERPARAMETROS_ARBOL)
        ),
        "hiperparametros": HIPERPARAMETROS_ARBOL,
    },
    "rf_balanced": {
        "descripcion": "Random Forest sin SMOTE-NC, class_weight='balanced'",
        "construir": lambda X, y: _sin_smote(construir_pipeline(X, y)).set_params(
            modelo=RandomForestClassifier(**HIPERPARAMETROS_RF)
        ),
        "hiperparametros": HIPERPARAMETROS_RF,
    },
}


class ReferenciaSinEntrenamiento:
    """
    Referencia con la interfaz minima de un Pipeline (fit / predict_proba) para
    pasar por exactamente el mismo codigo de evaluacion que las variantes.
    `fit` no aprende nada; la columna 1 de `predict_proba` es el puntaje.
    """

    def __init__(self, puntaje):
        self.puntaje = puntaje

    def fit(self, X, y):
        return self

    def predict_proba(self, X):
        puntaje = np.asarray(self.puntaje(X), dtype=float)
        return np.column_stack([-puntaje, puntaje])


REFERENCIAS = {
    "ref_prevalencia": {
        "descripcion": "Referencia: puntaje constante (sin informacion); AUC = 0.5 por definicion",
        "construir": lambda X, y: ReferenciaSinEntrenamiento(lambda datos: np.full(len(datos), PUNTAJE_CONSTANTE)),
        "hiperparametros": {"puntaje_constante": PUNTAJE_CONSTANTE},
        "umbrales": UMBRALES,
    },
    "ref_medicacion": {
        "descripcion": "Referencia: regla por medicacion, puntaje = medicacion_cod (0 ninguno, 1 metformina u otros, 2 sulfonilurea, 3 insulina); sin ajustar",
        "construir": lambda X, y: ReferenciaSinEntrenamiento(lambda datos: datos["medicacion_cod"]),
        "hiperparametros": {},
        "umbrales": UMBRALES_MEDICACION,
    },
}


def nombres_metricas(umbrales=UMBRALES) -> list:
    nombres = ["auc_roc", "prevalencia"]
    for u in umbrales:
        nombres += [f"recall@{u}", f"precision@{u}", f"f1@{u}", f"lift@{u}"]
    return nombres


def calcular_metricas(y_true, proba, umbrales=UMBRALES) -> dict:
    """
    AUC-ROC y recall/precision/F1/lift de la clase hipoglucemia en cada umbral.
    `prevalencia` es la fraccion de filas positivas; `lift` = precision /
    prevalencia. Sin positivos reales, AUC, recall, F1 y lift no estan
    definidos y se devuelven como None (no como 0). Sin predicciones
    positivas, la precision vale 0.
    """
    y_true = np.asarray(y_true)
    proba = np.asarray(proba)
    hay_positivos = bool(y_true.sum() > 0)
    hay_negativos = bool((y_true == 0).sum() > 0)
    prevalencia = float(y_true.mean()) if len(y_true) else None

    metricas = {
        "auc_roc": float(roc_auc_score(y_true, proba)) if hay_positivos and hay_negativos else None,
        "prevalencia": prevalencia,
    }
    for u in umbrales:
        pred = (proba >= u).astype(int)
        precision, recall, f1, _ = precision_recall_fscore_support(
            y_true, pred, average="binary", zero_division=0
        )
        metricas[f"recall@{u}"] = float(recall) if hay_positivos else None
        metricas[f"precision@{u}"] = float(precision)
        metricas[f"f1@{u}"] = float(f1) if hay_positivos else None
        metricas[f"lift@{u}"] = float(precision) / prevalencia if hay_positivos else None
    return metricas


def generar_folds(y, grupos, semilla, n_splits=N_SPLITS):
    """
    Folds estratificados a nivel de PACIENTE: se estratifica la lista de
    pacientes por "tiene algun registro positivo" y luego cada paciente aporta
    todas sus filas al lado que le toco. Devuelve (train_idx, test_idx) como
    posiciones de fila.
    """
    grupos = np.asarray(grupos)
    etiqueta_paciente = pd.Series(np.asarray(y), index=grupos).groupby(level=0).max()
    pacientes = etiqueta_paciente.index.to_numpy()
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=semilla)
    for _, test_pacientes in skf.split(pacientes, etiqueta_paciente.to_numpy()):
        en_test = np.isin(grupos, pacientes[test_pacientes])
        yield np.where(~en_test)[0], np.where(en_test)[0]


def _pacientes_positivos(y, grupos) -> int:
    return int(pd.Series(np.asarray(grupos))[np.asarray(y) == 1].nunique())


def evaluar_variante(construir, X, y, grupos, semillas=SEMILLAS_PARTICION, n_splits=N_SPLITS, umbrales=UMBRALES):
    """Entrena y evalua una variante en todos los folds de todas las repeticiones."""
    y = pd.Series(np.asarray(y))
    grupos = pd.Series(np.asarray(grupos))
    folds = []
    oof_por_repeticion = []

    for semilla in semillas:
        proba_oof = np.full(len(y), np.nan)
        for numero_fold, (train_idx, test_idx) in enumerate(generar_folds(y, grupos, semilla, n_splits)):
            pacientes_train = set(grupos.iloc[train_idx])
            pacientes_test = set(grupos.iloc[test_idx])
            assert pacientes_train.isdisjoint(pacientes_test), "Fuga de datos: un paciente esta en train y test del mismo fold"

            X_train = X.iloc[train_idx].reset_index(drop=True)
            X_test = X.iloc[test_idx].reset_index(drop=True)
            y_train = y.iloc[train_idx].reset_index(drop=True)
            y_test = y.iloc[test_idx].reset_index(drop=True)

            pipeline = construir(X_train, y_train)
            pipeline.fit(X_train, y_train)
            proba = pipeline.predict_proba(X_test)[:, 1]
            proba_oof[test_idx] = proba

            folds.append({
                "semilla_particion": semilla,
                "fold": numero_fold,
                "pacientes_train": len(pacientes_train),
                "pacientes_positivos_train": _pacientes_positivos(y_train, grupos.iloc[train_idx]),
                "pacientes_test": len(pacientes_test),
                "pacientes_positivos_test": _pacientes_positivos(y_test, grupos.iloc[test_idx]),
                "filas_test": int(len(test_idx)),
                "filas_positivas_test": int(y_test.sum()),
                **calcular_metricas(y_test, proba, umbrales),
            })

        assert not np.isnan(proba_oof).any(), "Hay filas sin prediccion out-of-fold"
        oof_por_repeticion.append(proba_oof)

    return folds, np.vstack(oof_por_repeticion)


def indices_bootstrap(filas_por_paciente, rng):
    """Remuestrea PACIENTES con reemplazo y devuelve todas las filas de cada uno."""
    elegidos = rng.integers(0, len(filas_por_paciente), size=len(filas_por_paciente))
    return np.concatenate([filas_por_paciente[i] for i in elegidos])


def bootstrap_por_pacientes(y, grupos, oof_por_repeticion, n_bootstrap=N_BOOTSTRAP, semilla=SEMILLA_BOOTSTRAP, umbrales=UMBRALES):
    """
    Distribucion bootstrap de cada metrica: en cada remuestreo de pacientes se
    calcula la metrica en cada repeticion y se promedia. Si en un remuestreo
    la metrica no esta definida (p. ej. sin pacientes positivos), ese
    remuestreo se descarta para esa metrica y se cuenta como no valido.
    """
    y = np.asarray(y)
    _, inverso = np.unique(np.asarray(grupos), return_inverse=True)
    filas_por_paciente = [np.where(inverso == i)[0] for i in range(inverso.max() + 1)]
    rng = np.random.default_rng(semilla)

    muestras = {nombre: [] for nombre in nombres_metricas(umbrales)}
    for _ in range(n_bootstrap):
        idx = indices_bootstrap(filas_por_paciente, rng)
        por_repeticion = [calcular_metricas(y[idx], oof[idx], umbrales) for oof in oof_por_repeticion]
        for nombre in muestras:
            valores = [m[nombre] for m in por_repeticion]
            if all(v is not None for v in valores):
                muestras[nombre].append(float(np.mean(valores)))
    return muestras


def agregar(y, grupos, oof_por_repeticion, n_bootstrap=N_BOOTSTRAP, semilla_bootstrap=SEMILLA_BOOTSTRAP, umbrales=UMBRALES) -> dict:
    por_repeticion = [calcular_metricas(y, oof, umbrales) for oof in oof_por_repeticion]
    muestras = bootstrap_por_pacientes(y, grupos, oof_por_repeticion, n_bootstrap, semilla_bootstrap, umbrales)
    agregado = {}
    for nombre in nombres_metricas(umbrales):
        valores = [m[nombre] for m in por_repeticion if m[nombre] is not None]
        distribucion = muestras[nombre]
        agregado[nombre] = {
            "media": float(np.mean(valores)) if valores else None,
            "ic95": [float(np.percentile(distribucion, 2.5)), float(np.percentile(distribucion, 97.5))] if distribucion else None,
            "bootstrap_validos": len(distribucion),
        }
    return agregado


def evaluar(
    X, y, grupos,
    variantes=VARIANTES,
    semillas=SEMILLAS_PARTICION,
    n_splits=N_SPLITS,
    n_bootstrap=N_BOOTSTRAP,
    semilla_bootstrap=SEMILLA_BOOTSTRAP,
) -> dict:
    """
    Evalua todas las variantes con los mismos folds y semillas. Sirve tambien
    para las REFERENCIAS (cada una trae sus propios umbrales).
    """
    resultado = {}
    for nombre, variante in variantes.items():
        umbrales = variante.get("umbrales", UMBRALES)
        folds, oof = evaluar_variante(variante["construir"], X, y, grupos, semillas, n_splits, umbrales)
        resultado[nombre] = {
            "descripcion": variante["descripcion"],
            "hiperparametros": variante["hiperparametros"],
            "umbrales": list(umbrales),
            "agregado": agregar(y, grupos, oof, n_bootstrap, semilla_bootstrap, umbrales),
            "folds": folds,
        }
    return resultado


def _versiones() -> dict:
    versiones = {"python": platform.python_version()}
    for libreria in LIBRERIAS:
        try:
            versiones[libreria] = metadata.version(libreria)
        except metadata.PackageNotFoundError:
            versiones[libreria] = None
    return versiones


def _sha256(ruta: str) -> str:
    with open(ruta, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def construir_reporte(X, y, grupos, resultado, ruta_dataset=None, semillas=SEMILLAS_PARTICION,
                      n_splits=N_SPLITS, n_bootstrap=N_BOOTSTRAP, semilla_bootstrap=SEMILLA_BOOTSTRAP,
                      referencias=None) -> dict:
    return {
        "generado_por": "app.cv_evaluacion",
        "fecha": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataset": {
            "archivo": os.path.basename(ruta_dataset) if ruta_dataset else None,
            "sha256": _sha256(ruta_dataset) if ruta_dataset else None,
            "filas": int(len(y)),
            "filas_positivas": int(np.asarray(y).sum()),
            "pacientes": int(pd.Series(np.asarray(grupos)).nunique()),
            "pacientes_positivos": _pacientes_positivos(y, grupos),
        },
        "validacion": {
            "esquema": "StratifiedKFold sobre pacientes (etiqueta: algun registro positivo), filas agrupadas por paciente",
            "n_splits": n_splits,
            "semillas_particion": list(semillas),
            "semilla_modelos": RANDOM_STATE,
            "bootstrap": {"n": n_bootstrap, "semilla": semilla_bootstrap, "unidad": "paciente", "nivel": 0.95, "metodo": "percentil"},
            "umbrales": list(UMBRALES),
            "agregacion": "metricas sobre predicciones out-of-fold por repeticion, promediadas entre repeticiones",
        },
        "versiones": _versiones(),
        "variantes": resultado,
        "referencias_nota": "Referencias sin entrenamiento: solo contexto, no entran en la regla de cambio de modelo de ML-D2",
        "referencias": referencias or {},
    }


def escribir_reporte(reporte: dict, ruta: str = CV_METRICS_PATH) -> None:
    if os.path.abspath(ruta) == os.path.abspath(METRICAS_PATH):
        raise ValueError("cv_evaluacion no debe sobrescribir baseline_metrics.json")
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(reporte, f, indent=2, ensure_ascii=False)


def _formatear(metrica: dict) -> str:
    if metrica["media"] is None:
        return "n/d"
    ic = metrica["ic95"]
    texto_ic = f"[{ic[0]:.3f}, {ic[1]:.3f}]" if ic else "[n/d]"
    return f"{metrica['media']:.3f} {texto_ic}"


def imprimir_tabla(reporte: dict) -> None:
    datos = reporte["dataset"]
    validacion = reporte["validacion"]
    print(
        f"Dataset: {datos['filas']} filas ({datos['filas_positivas']} positivas), "
        f"{datos['pacientes']} pacientes ({datos['pacientes_positivos']} con algun registro positivo)"
    )
    print(
        f"Validacion: {validacion['n_splits']} folds x {len(validacion['semillas_particion'])} repeticiones, "
        f"bootstrap de {validacion['bootstrap']['n']} remuestreos de pacientes (IC 95%)\n"
    )

    filas = {**reporte["variantes"], **reporte.get("referencias", {})}

    print(f"{'modelo / referencia':<20}{'AUC-ROC':<22}{'prevalencia':<22}AUC IC inf > 0.5")
    for nombre, variante in filas.items():
        agregado = variante["agregado"]
        ic_auc = agregado["auc_roc"]["ic95"]
        supera = "si" if ic_auc and ic_auc[0] > 0.5 else "no"
        print(f"{nombre:<20}{_formatear(agregado['auc_roc']):<22}{_formatear(agregado['prevalencia']):<22}{supera}")

    print(f"\n{'modelo / referencia':<20}{'umbral':<8}{'recall':<22}{'precision':<22}{'f1':<22}lift (precision / prevalencia)")
    for nombre, variante in filas.items():
        for u in variante["umbrales"]:
            a = variante["agregado"]
            print(
                f"{nombre:<20}{u:<8}{_formatear(a[f'recall@{u}']):<22}{_formatear(a[f'precision@{u}']):<22}"
                f"{_formatear(a[f'f1@{u}']):<22}{_formatear(a[f'lift@{u}'])}"
            )

    positivos = [f["pacientes_positivos_test"] for f in next(iter(reporte["variantes"].values()))["folds"]]
    print(f"\nPacientes positivos reales por fold de test: min {min(positivos)}, max {max(positivos)} (mismos folds en todas las filas)")

    base = reporte["variantes"].get("rl_smote")
    medicacion = reporte.get("referencias", {}).get("ref_medicacion")
    if base and medicacion:
        ic_base = base["agregado"]["auc_roc"]["ic95"]
        ic_med = medicacion["agregado"]["auc_roc"]["ic95"]
        se_solapan = ic_med[0] <= ic_base[1] and ic_base[0] <= ic_med[1]
        print(
            "Regla por medicacion vs linea base (AUC): "
            f"{medicacion['agregado']['auc_roc']['media']:.3f} vs {base['agregado']['auc_roc']['media']:.3f}; "
            f"los IC {'se solapan' if se_solapan else 'NO se solapan'} (las referencias no cambian el modelo por ML-D2)"
        )


def main(ruta_salida: str = CV_METRICS_PATH) -> dict:
    df_limpio = limpiar_datos_clinicos(cargar_summary_crudo())
    X, y, grupos, _, _ = preparar_features(df_limpio, expandir_lecturas=True)
    resultado = evaluar(X, y, grupos)
    referencias = evaluar(X, y, grupos, variantes=REFERENCIAS)
    reporte = construir_reporte(X, y, grupos, resultado, ruta_dataset=RAW_DATA_PATH, referencias=referencias)
    escribir_reporte(reporte, ruta_salida)
    imprimir_tabla(reporte)
    print(f"\nReporte guardado en: {ruta_salida}")
    return reporte


if __name__ == "__main__":
    main()
