# Ecosistema de datos — GlucoTracker

Este documento cubre el inventario de fuentes de datos, la política de privacidad/licenciamiento y el resumen del análisis de calidad (EDA) del componente de predicción de riesgo de hipoglucemia.

## 1. Inventario de fuentes

| Fuente | ShanghaiT2DM |
|---|---|
| Repositorio | Figshare — [Diabetes Datasets: ShanghaiT1DM and ShanghaiT2DM](https://figshare.com/articles/dataset/Diabetes_Datasets-ShanghaiT1DM_and_ShanghaiT2DM/20444397?file=38259264) |
| Publicación asociada | Zhao, Zhu, Shen, Lin et al. (2023). *Chinese diabetes datasets for data-driven machine learning*. Scientific Data — DOI [10.1038/s41597-023-01940-7](https://doi.org/10.1038/s41597-023-01940-7) |
| Autores / institución | Tongji University (School of Software Engineering) y Shanghai Fourth People's Hospital (Departamento de Endocrinología y Metabolismo); autor de correspondencia: Congrong Wang |
| Licencia | CC BY 4.0 |
| Tamaño | 109 pacientes con diabetes tipo 2 |
| Contenido usado | Summary clínico por paciente (33 columnas: demografía, comorbilidades, medicación, labs, y la columna real `Hypoglycemia (yes/no)`) |
| Contenido NO usado | Series crudas de CGM por paciente (se evaluaron pero se descartaron del scope — ver §3) |

**Cómo se obtuvo:** descarga directa desde el repositorio en Figshare (el paper de *Scientific Data* remite ahí como fuente oficial de los datos, no a PhysioNet), bajo los términos de la licencia CC BY 4.0, que permite uso, adaptación y redistribución con atribución. El dataset ya llega **de-identificado** por los autores originales — GlucoTracker no realiza ningún proceso adicional de anonimización porque no lo necesita, pero tampoco introduce un paso de anonimización propio: la responsabilidad de esa garantía es de los autores del dataset, y se documenta aquí como tal.

## 2. Privacidad y gobierno de datos

- **Ningún dato real de paciente de ShanghaiT2DM se expone a los usuarios finales de la app.** El dataset se usa exclusivamente para entrenar el modelo *offline*; el artefacto que llega a producción es el modelo entrenado (`modelo_hipoglucemia.pkl`, un conjunto de coeficientes), no los datos originales.
- **El aumento de datos (SMOTE-NC) no es una técnica de privacidad, es una técnica de balance de clases.** Es importante no confundir ambas cosas: SMOTE-NC genera filas sintéticas interpolando entre pacientes reales del *conjunto de entrenamiento* para compensar que solo 17 de 109 pacientes (~9%) tienen hipoglucemia registrada — el objetivo es que el modelo no ignore la clase minoritaria, no ocultar datos reales. El conjunto de test nunca recibe estos datos sintéticos (ver §4 de `docs/model_baseline.md`).
- **Los datos que sí produce la app** (registros de glucosa de sus propios usuarios) son un ecosistema de datos separado, no cubierto por este documento — se rige por la política de privacidad propia de GlucoTracker, no por la licencia de ShanghaiT2DM.

## 3. Resumen del EDA (Análisis Exploratorio)

Notebook completo: [`docs/eda/GlucoTracker_Consolidado_Hipoglucemia.ipynb`](./eda/GlucoTracker_Consolidado_Hipoglucemia.ipynb).

Hallazgos principales que justifican las decisiones de diseño del pipeline:

- **Valores faltantes:** el dataset usa el texto `"/"` como marcador de nulo en vez de dejar la celda vacía — se detectó y normalizó a `NaN` antes de cualquier análisis (de lo contrario, columnas numéricas se leían como texto).
- **Columnas de varianza cero:** `Type of Diabetes`, `Acute Diabetic Complications` y `Alcohol Drinking History` tienen el mismo valor en (casi) todos los pacientes — se descartaron por no aportar poder predictivo.
- **Balance de clases:** 99 pacientes sin hipoglucemia registrada vs. 17 con hipoglucemia (~9.2% positivos) — un desbalance severo que motivó el uso de SMOTE-NC únicamente sobre el conjunto de entrenamiento.
- **Completitud por columna:** varias variables de laboratorio (HbA1c, eGFR, C-péptido, insulina) tienen porcentajes de faltantes altos — se decidió mantener solo HbA1c como campo *opcional* del perfil (con bandera de faltante + imputación), y descartar el resto por no ser realista pedírselos a un usuario de la app.
- **Evidencia contra "umbral disfrazado de ML":** al expandir el dataset a nivel de lectura (una fila por cada medición real de glucosa, en ayunas y postprandial), se observa que un mismo paciente puede tener una lectura baja y una alta compartiendo la misma etiqueta de riesgo — la etiqueta describe al paciente (su historial real de episodios), no la lectura puntual, lo que obliga al modelo a usar el perfil clínico y no solo el valor de glucosa.

## 4. Definición del target — precisión importante

El target `riesgo_hipoglucemia_paciente` (o `Hypoglycemia (yes/no)` en el dataset original) es un **hecho clínico observado**, calculado por los autores del dataset a partir de su propio monitoreo continuo de glucosa (CGM) durante el estudio — **no es una etiqueta generada por reglas de la ADA ni por ningún criterio nuestro**. Esto es intencional: entrenar contra un desenlace real evita que el modelo termine aprendiendo a reproducir un umbral que nosotros mismos definimos (lo que sería "if-else disfrazado de ML").

El motor de reglas ADA (clasificación instantánea Normal/Hipo/Hiper de cualquier lectura, ver `app/ml/riesgo.py` y el motor de reglas del backend) es un componente **separado y paralelo** al modelo de ML — no interviene en el entrenamiento ni en el etiquetado del dataset.

## 5. Justificación de la estrategia frente a la escasez de datos

Con solo 109 pacientes (17 positivos), dos decisiones metodológicas abordan directamente esta limitación:

1. **SMOTE-NC** (`imblearn.over_sampling.SMOTENC`) genera datos sintéticos respetando la naturaleza mixta de las variables (numéricas y categóricas) — aplicado únicamente sobre el conjunto de entrenamiento, dentro de un `Pipeline` que garantiza que nunca toca el conjunto de test.
2. **Regresión Logística como modelo base**, en vez de un modelo de mayor capacidad: con pocos eventos positivos reales, un modelo con menos parámetros es más robusto frente al sobreajuste (ver `docs/model_baseline.md` para la justificación completa y las métricas).

## Referencias

- Zhao, Q., Zhu, J., Shen, X., Lin, C. et al. (2023). Chinese diabetes datasets for data-driven machine learning. *Scientific Data*. DOI: [10.1038/s41597-023-01940-7](https://doi.org/10.1038/s41597-023-01940-7).
- Dataset: [Diabetes Datasets - ShanghaiT1DM and ShanghaiT2DM](https://figshare.com/articles/dataset/Diabetes_Datasets-ShanghaiT1DM_and_ShanghaiT2DM/20444397?file=38259264). Figshare.
- Battelino et al. (2019). Clinical targets for CGM data interpretation. *Diabetes Care*.
- Peduzzi et al. (1996). A simulation study of the number of events per variable in logistic regression analysis. *Journal of Clinical Epidemiology*.
