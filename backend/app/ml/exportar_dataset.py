"""
Utilitario opcional: exporta a CSV el dataset ya limpio y con features listas
(el mismo que ve el pipeline al entrenar), solo para inspeccion manual o para
anexarlo a la documentacion de la tesis. No es parte del flujo de
entrenamiento/prediccion -- train_baseline.py NO depende de este CSV, ni lo
genera ni lo necesita.

Uso:
    python -m app.ml.exportar_dataset
"""

import os

from app.ml.data_prep import cargar_summary_crudo, limpiar_datos_clinicos, preparar_features

ML_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(ML_DIR, "dataset_inputs_hipoglucemia.csv")


def main():
    df_crudo = cargar_summary_crudo()
    df_limpio = limpiar_datos_clinicos(df_crudo)
    X, y, grupos, columnas_features, _ = preparar_features(df_limpio, expandir_lecturas=True)

    df_export = X.copy()
    df_export["y"] = y
    df_export["id_paciente_real"] = grupos

    df_export.to_csv(CSV_PATH, index=False)
    print(f"Guardado: {CSV_PATH}")
    print(f"Filas: {df_export.shape[0]} | Columnas: {df_export.shape[1]}")


if __name__ == "__main__":
    main()
