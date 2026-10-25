"""
CLI del generador de datos sinteticos (modelo de DEMO).

Uso (desde backend/ml_service/, con el entorno virtual activado):
    python -m app.sintetico.generar --n 2000 --semilla 20261024 --salida data/sintetico/dataset_sintetico.csv

Escribe el CSV (ignorado por git, regenerable) y, al lado, un JSON de metadatos
con el mismo nombre (versionable). ADVERTENCIA: el dataset sale de reglas
clinicas del equipo, no de la realidad; no es evidencia clinica.
Solo imprime agregados: ningun valor ni id por registro.
"""
import argparse
import os
import sys

from app.sintetico.generador import (
    N_POR_DEFECTO,
    SEMILLA_POR_DEFECTO,
    escribir_dataset,
    generar_dataset,
    ruta_metadatos,
)
from app.sintetico.reglas import ESCALA_SENAL, PREVALENCIA_OBJETIVO

SALIDA_POR_DEFECTO = os.path.join("data", "sintetico", "dataset_sintetico.csv")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.sintetico.generar",
        description="Genera el dataset SINTETICO del modelo de demo (reglas clinicas del equipo; no es evidencia clinica).",
    )
    parser.add_argument("--n", type=int, default=N_POR_DEFECTO, help="registros (default: %(default)s)")
    parser.add_argument("--semilla", type=int, default=SEMILLA_POR_DEFECTO, help="semilla (default: %(default)s)")
    parser.add_argument("--salida", default=SALIDA_POR_DEFECTO, help="ruta del CSV (default: %(default)s)")
    parser.add_argument("--escala-senal", type=float, default=ESCALA_SENAL, help="escala global de la senal (default: %(default)s)")
    parser.add_argument("--prevalencia", type=float, default=PREVALENCIA_OBJETIVO, help="prevalencia objetivo (default: %(default)s)")
    args = parser.parse_args(argv)

    try:
        resultado = generar_dataset(args.n, args.semilla, args.escala_senal, args.prevalencia)
        metadatos = escribir_dataset(resultado, args.salida)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    print("ADVERTENCIA: dataset SINTETICO generado desde reglas del equipo; no es evidencia clinica.")
    print(f"Registros: {metadatos['n_registros']} | pacientes: {metadatos['n_pacientes']} | semilla: {metadatos['semilla']}")
    print(f"Prevalencia: {metadatos['prevalencia_obtenida']:.3f} (objetivo {metadatos['prevalencia_objetivo']:.2f}) | "
          f"AUC de las probabilidades verdaderas: {metadatos['auc_oraculo']:.3f}")
    print(f"CSV: {args.salida}")
    print(f"Metadatos: {ruta_metadatos(args.salida)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
