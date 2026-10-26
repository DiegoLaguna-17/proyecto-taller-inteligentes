"""
Entrenamiento del modelo de DEMO con datos SINTETICOS (Fase S3, TASK-011g, ADR-0009).

ADVERTENCIA DE HONESTIDAD: el modelo de demo aprende las reglas clinicas que
escribio el equipo, NO la realidad. Sus probabilidades y TODAS sus metricas
(incluida la validacion de este modulo) NO son desempeno clinico. El modelo
real no se modifica: este modulo solo escribe en artefactos/demo/ y nunca en
`baseline_metrics.json` ni en `cv_metrics.json`.

Uso (desde backend/ml_service/, con el entorno virtual activado):
    python -m app.sintetico.generar --n 2000 --semilla 20261024 --salida data/sintetico/dataset_sintetico.csv
    python -m app.train_demo

Reutiliza la tuberia del modelo real (`train_baseline.entrenar_y_evaluar` con
`origen="sintetico"`; mismo `preparar_features`, mismo split agrupado por
paciente) y el esquema de validacion de `cv_evaluacion.py` (validacion cruzada
agrupada por paciente, bootstrap sobre pacientes). Escribe:
    artefactos/demo/modelo_hipoglucemia_demo.pkl   (ignorado por git)
    artefactos/demo/modelo_hipoglucemia_demo.json  (metadatos, versionado)
    artefactos/demo/cv_metrics_demo.json           (validacion sintetica, versionado)

No lee los 109 registros reales. No registra valores por paciente: solo
agregados.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from scipy.special import expit

from app import cv_evaluacion as cv
from app.metadatos import (
    ENTRENADO_CON_SINTETICO,
    MODO_DEMO,
    NOMBRE_CV_DEMO,
    directorio_modelo,
    sha256_archivo,
    versiones_instaladas,
)
from app.sintetico import reglas
from app.sintetico.generador import auc_roc
from app.train_baseline import (
    METRICAS_PATH,
    RANDOM_STATE,
    RUTA_DATASET_SINTETICO,
    cargar_dataset_entrenamiento,
    construir_pipeline,
    entrenar_y_evaluar,
)

ROTULO = (
    "NO ES DESEMPENO CLINICO: validacion sintetica del modelo de DEMO, entrenado con datos generados por reglas "
    "clinicas del equipo (pendientes de revision). Aprende esas reglas, no la realidad."
)
N_BOOTSTRAP_COEFICIENTES = 200
CONTROLES = ("genero_masculino", "com_hipertension", "com_dislipidemia", "com_neuropatia", "com_cardiovascular")
CRITERIO_CONTROL = 0.15


def probabilidad_reglas(df_sintetico: pd.DataFrame, meta_dataset: dict) -> np.ndarray:
    """Probabilidad verdadera de las reglas, recalculada desde el CSV y los metadatos del dataset."""
    s = meta_dataset["escala_senal"] * reglas.suma_log_odds(df_sintetico)
    return expit(s + meta_dataset["intercepto"])


def columnas_de_interaccion(df_sintetico: pd.DataFrame) -> dict:
    """SOLO referencia (no se usan en el modelo): las 2 interacciones, para medir cuanto AUC se pierde sin ellas."""
    riesgo = df_sintetico["categoria_medicacion"].isin(["insulina", "sulfonilurea"]).to_numpy()
    h = df_sintetico["hba1c"].to_numpy(dtype=float)
    with np.errstate(invalid="ignore"):
        return {
            "int_hba1c_bajo_x_riesgo": (riesgo & (h < 7)).astype(float),
            "int_hba1c_7_8_x_riesgo": (riesgo & (h >= 7) & (h < 8)).astype(float),
            "int_edad75_x_insulina": ((df_sintetico["edad"] >= 75) & (df_sintetico["categoria_medicacion"] == "insulina")).to_numpy().astype(float),
        }


def _sin_smote(X, y):
    return construir_pipeline(X, y, usar_smote=False)


def _con_smote(X, y):
    return construir_pipeline(X, y, usar_smote=True)


def _resumen_auc(agregado: dict) -> dict:
    a = agregado["auc_roc"]
    return {"media": a["media"], "ic95": a["ic95"]}


def coeficientes_aprendidos(X, y, grupos, n_bootstrap=N_BOOTSTRAP_COEFICIENTES, semilla=RANDOM_STATE) -> dict:
    """
    Coeficientes del modelo ajustado a todo el dataset, con intervalo de 95 %
    por bootstrap sobre pacientes. Las variables numericas estan estandarizadas
    y las binarias pasan sin escalar (su coeficiente es el log-odds directo).
    """
    def ajustar(X_, y_):
        pipeline = construir_pipeline(X_, y_, usar_smote=False).fit(X_, y_)
        nombres = pipeline.named_steps["preprocesamiento"].get_feature_names_out()
        nombres = [n.split("__", 1)[1] for n in nombres]
        return dict(zip(nombres, pipeline.named_steps["modelo"].coef_[0]))

    X = X.reset_index(drop=True)
    y = pd.Series(np.asarray(y)).reset_index(drop=True)
    puntual = ajustar(X, y)

    _, inverso = np.unique(np.asarray(grupos), return_inverse=True)
    filas_por_paciente = [np.where(inverso == i)[0] for i in range(inverso.max() + 1)]
    rng = np.random.default_rng(semilla)
    muestras = {k: [] for k in puntual}
    for _ in range(n_bootstrap):
        idx = cv.indices_bootstrap(filas_por_paciente, rng)
        Xb, yb = X.iloc[idx].reset_index(drop=True), y.iloc[idx].reset_index(drop=True)
        if yb.sum() < 2 or (yb == 0).sum() < 2:
            continue
        for k, v in ajustar(Xb, yb).items():
            muestras[k].append(v)

    resultado = {}
    for nombre, valor in puntual.items():
        distribucion = muestras[nombre]
        resultado[nombre] = {
            "coef": round(float(valor), 4),
            "ic95": [round(float(np.percentile(distribucion, 2.5)), 4), round(float(np.percentile(distribucion, 97.5)), 4)],
        }
    return resultado


def evaluar_controles(coeficientes: dict) -> dict:
    """Los controles (sin efecto en las reglas) deberian estar cerca de 0; se publica con su intervalo."""
    controles = {}
    for nombre in CONTROLES:
        c = coeficientes[nombre]
        controles[nombre] = {
            "coef": c["coef"],
            "ic95": c["ic95"],
            "ic_incluye_cero": bool(c["ic95"][0] <= 0 <= c["ic95"][1]),
            "abs_menor_que_0_15": bool(abs(c["coef"]) < CRITERIO_CONTROL),
        }
    return controles


def construir_reporte(datos: dict, semillas, n_splits, n_bootstrap, n_bootstrap_coef=N_BOOTSTRAP_COEFICIENTES) -> dict:
    X, y, grupos = datos["X"], datos["y"], datos["grupos"]
    df_sint, meta = datos["dataframe_sintetico"], datos["meta_sintetico"]

    variantes = {
        "demo_rl_sin_smote": {
            "descripcion": "Modelo de demo: Regresion Logistica sin SMOTE-NC (el que se guarda)",
            "construir": _sin_smote, "hiperparametros": {"smote_nc": False},
        },
        "ref_rl_con_smote_nc": {
            "descripcion": "Referencia (no se usa): Regresion Logistica con SMOTE-NC, como el modelo real",
            "construir": _con_smote, "hiperparametros": {"smote_nc": True},
        },
    }
    resultado = cv.evaluar(X, y, grupos, variantes=variantes, semillas=semillas, n_splits=n_splits, n_bootstrap=n_bootstrap)

    X_int = X.copy()
    for nombre, valores in columnas_de_interaccion(df_sint).items():
        X_int[nombre] = valores
    con_interacciones = cv.evaluar(
        X_int, y, grupos,
        variantes={"ref_rl_con_2_interacciones": {
            "descripcion": "Referencia (no se usa): Regresion Logistica sin SMOTE-NC mas las 2 interacciones",
            "construir": _sin_smote, "hiperparametros": {"smote_nc": False, "interacciones": 2},
        }},
        semillas=semillas, n_splits=n_splits, n_bootstrap=n_bootstrap,
    )

    p_reglas = probabilidad_reglas(df_sint, meta)
    y_np = np.asarray(y)
    auc_reglas_verdadero = cv.agregar(y_np, grupos, p_reglas[None, :], n_bootstrap, cv.SEMILLA_BOOTSTRAP)
    modelo = resultado["demo_rl_sin_smote"]["agregado"]
    smote = resultado["ref_rl_con_smote_nc"]["agregado"]
    inter = con_interacciones["ref_rl_con_2_interacciones"]["agregado"]

    auc_modelo = modelo["auc_roc"]["media"]
    auc_reglas = auc_reglas_verdadero["auc_roc"]["media"]
    coef = coeficientes_aprendidos(X, y, grupos, n_bootstrap_coef)

    folds = resultado["demo_rl_sin_smote"]["folds"]
    aucs_fold = [f["auc_roc"] for f in folds if f["auc_roc"] is not None]
    return {
        "rotulo": ROTULO,
        "generado_por": "app.train_demo",
        "fecha": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "entrenado_con": ENTRENADO_CON_SINTETICO,
        "dataset": {
            "archivo": os.path.basename(datos["ruta_dataset"]),
            "sha256": sha256_archivo(datos["ruta_dataset"]),
            "n_registros": int(len(y)),
            "n_pacientes": int(pd.Series(np.asarray(grupos)).nunique()),
            "prevalencia": round(float(y_np.mean()), 4),
            "version_reglas": meta["version_reglas"],
            "semilla": meta["semilla"],
            "escala_senal": meta["escala_senal"],
            "auc_oraculo_en_metadatos": meta["auc_oraculo"],
        },
        "validacion": {
            "esquema": "StratifiedKFold sobre pacientes sinteticos, filas agrupadas por paciente (mismo esquema que cv_evaluacion.py)",
            "n_splits": n_splits,
            "semillas_particion": list(semillas),
            "semilla_modelos": RANDOM_STATE,
            "bootstrap": {"n": n_bootstrap, "semilla": cv.SEMILLA_BOOTSTRAP, "unidad": "paciente", "nivel": 0.95, "metodo": "percentil"},
        },
        "versiones": versiones_instaladas(),
        "modelo_demo": {
            "descripcion": variantes["demo_rl_sin_smote"]["descripcion"],
            "agregado": modelo,
            "auc_por_fold": {"min": round(min(aucs_fold), 4), "max": round(max(aucs_fold), 4), "n": len(aucs_fold)},
        },
        "reglas_verdaderas": {
            "descripcion": "AUC de las probabilidades verdaderas de las reglas (el techo que un modelo podria alcanzar), recalculadas desde el CSV",
            "auc_roc": auc_reglas_verdadero["auc_roc"],
        },
        "comparacion": {
            "auc_modelo": round(auc_modelo, 4),
            "auc_reglas_verdaderas": round(auc_reglas, 4),
            "diferencia": round(auc_reglas - auc_modelo, 4),
            "fraccion_de_la_senal_recuperada": round((auc_modelo - 0.5) / (auc_reglas - 0.5), 4),
        },
        "decisiones_medidas": {
            "smote_nc": {
                "usado": False,
                "auc_sin_smote_nc": _resumen_auc(modelo),
                "auc_con_smote_nc": _resumen_auc(smote),
                "probabilidad_media_predicha_sin_smote_nc": round(float(_media_oof(X, y, grupos, _sin_smote, semillas, n_splits)), 4),
                "probabilidad_media_predicha_con_smote_nc": round(float(_media_oof(X, y, grupos, _con_smote, semillas, n_splits)), 4),
                "prevalencia": round(float(y_np.mean()), 4),
                "motivo": "con SMOTE-NC el AUC baja y las probabilidades se inflan por encima de la prevalencia; con ~15 % de prevalencia no hace falta",
            },
            "interacciones": {
                "usadas": False,
                "auc_sin_interacciones": _resumen_auc(modelo),
                "auc_con_2_interacciones": _resumen_auc(inter),
                "motivo": "decision del usuario (S3): no mejoran el AUC de forma medible",
            },
        },
        "coeficientes": coef,
        "controles": {
            "nota": (
                "Genero, hipertension, dislipidemia, neuropatia y cardiovascular NO influyen en la etiqueta del generador. "
                "Con n = 2.000 su coeficiente tiene una desviacion de 0,13 a 0,18 (media ~0 en datasets independientes), "
                "asi que en una muestra concreta puede superar |0,15|. Es ruido de muestreo, no sesgo del generador."
            ),
            "criterio_abs_menor_que": CRITERIO_CONTROL,
            "resultados": evaluar_controles(coef),
        },
    }


def _media_oof(X, y, grupos, construir, semillas, n_splits) -> float:
    _, oof = cv.evaluar_variante(construir, X, y, grupos, semillas, n_splits)
    return float(oof.mean())


def escribir_reporte(reporte: dict, artefactos_dir: str) -> str:
    """Siempre en artefactos/demo/cv_metrics_demo.json: nunca sobrescribe cv_metrics.json ni baseline_metrics.json."""
    ruta = os.path.join(directorio_modelo(artefactos_dir, MODO_DEMO), NOMBRE_CV_DEMO)
    for protegido in (cv.CV_METRICS_PATH, METRICAS_PATH):
        if os.path.abspath(ruta) == os.path.abspath(protegido):
            raise ValueError("train_demo no debe sobrescribir las metricas del modelo real")
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(reporte, f, indent=2, ensure_ascii=False)
    return ruta


def entrenar_demo(artefactos_dir=None, ruta_dataset=None, semillas=cv.SEMILLAS_PARTICION, n_splits=cv.N_SPLITS,
                  n_bootstrap=cv.N_BOOTSTRAP, n_bootstrap_coef=N_BOOTSTRAP_COEFICIENTES) -> dict:
    """Entrena y guarda el modelo de demo, corre su validacion sintetica y escribe cv_metrics_demo.json."""
    from app.config import load_settings

    artefactos_dir = artefactos_dir or load_settings().artefactos_dir
    ruta_dataset = ruta_dataset or RUTA_DATASET_SINTETICO
    entrenar_y_evaluar(artefactos_dir, origen="sintetico", ruta_dataset=ruta_dataset)
    datos = cargar_dataset_entrenamiento("sintetico", ruta_dataset)
    reporte = construir_reporte(datos, semillas, n_splits, n_bootstrap, n_bootstrap_coef)
    ruta = escribir_reporte(reporte, artefactos_dir)
    return {**reporte, "ruta_cv": ruta}


def imprimir_resumen(reporte: dict) -> None:
    c = reporte["comparacion"]
    m = reporte["modelo_demo"]["agregado"]["auc_roc"]
    r = reporte["reglas_verdaderas"]["auc_roc"]
    print("\n" + "=" * 78)
    print(reporte["rotulo"])
    print("=" * 78)
    print(f"AUC del modelo de demo (validacion cruzada agrupada): {m['media']:.4f} [{m['ic95'][0]:.4f}, {m['ic95'][1]:.4f}]")
    print(f"AUC de las reglas verdaderas (techo):                 {r['media']:.4f} [{r['ic95'][0]:.4f}, {r['ic95'][1]:.4f}]")
    print(f"Diferencia: {c['diferencia']:.4f} | fraccion de la senal recuperada: {c['fraccion_de_la_senal_recuperada']*100:.1f} %")
    d = reporte["decisiones_medidas"]
    print(f"SMOTE-NC: AUC sin {d['smote_nc']['auc_sin_smote_nc']['media']:.4f} vs con {d['smote_nc']['auc_con_smote_nc']['media']:.4f}; "
          f"prob. media predicha {d['smote_nc']['probabilidad_media_predicha_sin_smote_nc']:.3f} vs {d['smote_nc']['probabilidad_media_predicha_con_smote_nc']:.3f} "
          f"(prevalencia {d['smote_nc']['prevalencia']:.3f})")
    print(f"Interacciones: AUC sin {d['interacciones']['auc_sin_interacciones']['media']:.4f} vs con 2 interacciones {d['interacciones']['auc_con_2_interacciones']['media']:.4f}")
    print("Controles (sin efecto en las reglas):")
    for nombre, v in reporte["controles"]["resultados"].items():
        print(f"  {nombre:20s} {v['coef']:+.3f}  IC95 [{v['ic95'][0]:+.3f}, {v['ic95'][1]:+.3f}]  "
              f"{'|coef|<0,15' if v['abs_menor_que_0_15'] else '|coef|>=0,15'}  {'IC incluye 0' if v['ic_incluye_cero'] else 'IC NO incluye 0'}")
    print(f"\nReporte guardado en: {reporte['ruta_cv']}")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.train_demo",
        description="Entrena el modelo de DEMO con el dataset SINTETICO (no es desempeno clinico).",
    )
    parser.add_argument("--dataset", default=None, help="CSV sintetico (default: data/sintetico/dataset_sintetico.csv)")
    parser.add_argument("--artefactos-dir", default=None, help="carpeta base de artefactos (default: app/artefactos/)")
    args = parser.parse_args(argv)
    try:
        reporte = entrenar_demo(artefactos_dir=args.artefactos_dir, ruta_dataset=args.dataset)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    imprimir_resumen(reporte)
    return 0


if __name__ == "__main__":
    sys.exit(main())
