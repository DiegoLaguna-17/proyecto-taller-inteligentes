# Registro de Riesgos — GlucoTracker

> Este documento identifica y prioriza los riesgos técnicos, de datos y de IA del proyecto, con su mitigación (o justificación de por qué se acepta sin acción inmediata). Se organiza en tres categorías porque cada una responde una pregunta distinta: ¿qué puede fallar en la infraestructura?, ¿qué puede fallar por la naturaleza de los datos?, ¿qué puede fallar específicamente por usar IA (modelo de ML y LLM)?
>
> **Escala:** Probabilidad e Impacto en {Baja, Media, Alta}. Prioridad = combinación de ambas (Alta si al menos una de las dos es Alta y la otra no es Baja; Media en combinaciones intermedias; Baja en el resto).
> **Estado:** `Mitigado` (ya existe una acción concreta implementada), `En mitigación` (acción definida, en curso), `Aceptado` (se decide no actuar por ahora, con justificación), `Pendiente` (referente a implementaciones en próximos avances del proyecto).

---

## 1. Riesgos Técnicos

| ID | Riesgo | Prob. | Impacto | Prioridad | Mitigación | Estado |
|---|---|---|---|---|---|---|
| RT-01 | El esquema de autenticación (JWT vs. Supabase Auth vs. OAuth) no está decidido | Alta | Bajo (no bloquea esta etapa) | Media | Decidir y documentar por ADR antes de implementar cualquier endpoint que dependa de sesión de usuario | Pendiente |
| RT-02 | Dependencia de servicios externos gestionados (Supabase, Azure, proveedor del LLM) sin plan de contingencia ante caídas o cambios de API | Baja | Medio | Baja | Se acepta para esta etapa; revisar en fases posteriores cuando el sistema esté en un entorno más cercano a producción | Aceptado |
---

## 2. Riesgos de Datos

| ID | Riesgo | Prob. | Impacto | Prioridad | Mitigación | Estado |
|---|---|---|---|---|---|---|
| RD-01 | El dataset base (ShanghaiT2DM) no representa necesariamente a la población real de pacientes que usará la app (otra región, otro perfil clínico) | Alta | Medio | Alta | Documentado explícitamente como limitación conocida en `docs/data_ecosystem.md`; el modelo se declara como línea base, no como versión final, y deberá reentrenarse cuando existan datos reales de la app | Mitigado |
| RD-02 | Fuerte desbalance de clases: solo ~9.2% de los pacientes de la cohorte tuvo hipoglucemia registrada (`docs/data_ecosystem.md` §3) | Alta | Alto | Alta | Se usa AUC-ROC (no exactitud) como métrica principal, precisamente porque no se infla con clases desbalanceadas; queda pendiente evaluar `class_weight` o técnicas de remuestreo en la siguiente iteración del modelo | Mitigado |
| RD-03 | Fuga de datos entre entrenamiento y prueba si un mismo paciente aparece en ambos conjuntos, lo que infla artificialmente las métricas reportadas | Media | Alto | Alta | El split usa `GroupShuffleSplit` agrupado por paciente (`docs/model_baseline.md`), garantizando que ningún paciente esté a la vez en train y test | Mitigado |

---

## 3. Riesgos de IA

| ID | Riesgo | Prob. | Impacto | Prioridad | Mitigación | Estado |
|---|---|---|---|---|---|---|
| RIA-01 | Falso negativo del modelo de riesgo: no detectar un episodio real de hipoglucemia (recall actual de solo 0.429, `docs/model_baseline.md`) | Alta | Alto | Alta | Se declara explícitamente que hacia adelante se priorizará **recall sobre precisión** al calibrar el modelo; además, el modelo de ML es un complemento del motor de reglas ADA que ya clasifica cada lectura puntual — no es el único mecanismo de detección | En mitigación |
| RIA-02 | El chatbot da información incorrecta o se comporta como si diagnosticara/recetara, sobrepasando su alcance educativo declarado | Media | Alto | Alta | Alcance restringido por diseño (system prompt con `reglas_ada_v1.txt`) + medido con la Tasa de Adherencia Clínica en las categorías `scope` y `rechazo` del Golden Dataset (`docs/nlp/baseline_chatbot.md`), con un mínimo aceptable declarado de 100% en ambas | Mitigado |
| RIA-03 | El chatbot puede ser manipulado con entradas adversariales para ignorar el system prompt y las reglas de seguridad inyectadas | Media | Alto | Alta | Medido de forma explícita con la categoría `adversarial` del Golden Dataset; el propio ADR (`docs/nlp/adr_system_prompting_vs_rag.md`) reconoce esta limitación como "mitigada parcialmente, no eliminada", y establece que una adherencia consistentemente baja en esta categoría obligaría a revisar la decisión arquitectónica | En mitigación |
| RIA-04 | Dependencia de un proveedor externo de LLM (OpenAI/Gemini): cambios de modelo, costo por token o caída del servicio afectan directamente al chatbot | Baja | Medio | Baja | Documentado como limitación aceptada del ADR de arquitectura del chatbot; un modelo local queda registrado como posible trabajo futuro si esto se vuelve un problema real | Aceptado |
| RIA-05 | Código o documentación generados con asistencia de IA (Claude Code) se integran sin suficiente revisión humana, ocultando errores no evidentes a primera vista | Media | Medio | Media | Regla ya vigente en `docs/team_charter.md`: todo código generado debe revisarse, probarse y entenderse; cada PR debe declarar qué se generó con IA y qué verificación se ejecutó. **Pendiente de verificar** que esto se esté cumpliendo en la práctica en los PR reales del repositorio (ver Tarea 8 / verificación de trazabilidad) | En mitigación |
