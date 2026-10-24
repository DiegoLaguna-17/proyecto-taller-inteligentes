# 1. Uso de backend Monolítio Modular con FastAPI

* **Estado:** Reemplazado parcialmente por [ADR-0006](0006-nlp-servicio-independiente.md) y [ADR-0008](0008-servicio-ml-independiente.md)
* **Fecha de decisión:** 16-09-2026
* **Autores:** Equipo Glucotracker

> **Nota (2026-10-24):** el alcance cambia para NLP y para ML. El chatbot pasa a `backend/nlp_service/` (ADR-0006) y el modelo de ML a `backend/ml_service/` (ADR-0008). Para el resto del backend (API, reglas de negocio, incluida la clasificación ADA, y alertas) esta decisión sigue vigente. Las carpetas `/ml` y `/nlp` que se mencionan abajo como parte del monolito quedan reemplazadas por esos servicios.

## Contexto y Problema
Para el desarrollo del backend de GlucoTracker se requiere una arquitectura que permita manejar lógica de negocio, endpoints REST e integrar lógica de Machine Learning y NLP de forma ágil, eficiente y simple para la primera etapa del proyecto.

## Alternativas Consideradas
1. **Microservicios separados:** Ofrece aislamiento pero introduce una complejidad operacional excesiva para un equipo de tamaño reducido en una etapa temprana en la que aún no es muy necesaria.
2. **Backend monolítico modular en FastAPI:** Permite agrupar en un solo repositorio y servicio toda la lógica, aprovechando el rendimiento asíncrono de FastAPI y la facilidad para estructurar paquetes independientes (`/api`, `/ml`, `/nlp`) sin tener que pasar por validación compleja.

## Decisión Tomada
Se adopta un **Backend Monolítico Modular en FastAPI**. Los módulos estarán desacoplados lógicamente en el código fuente (respetando carpetas separadas y para escalamiento futuro), pero se desplegarán como una única unidad cohesiva. Si bien, si se consideró utilizar microservicios en la arquitectura, se descartó su uso a corto y mediano plazo debido a la etapa y madurez del proyecto. 

## Consecuencias
* **Positivas:** Desarrollo más rápido, menor fricción en despliegues iniciales, facilidad para compartir modelos de datos.
* **Negativas / Riesgos asumidos:** Si el módulo de ML crece considerablemente en consumo de memoria, podría requerir refactorización a futuro, lo cual es aceptable dado el alcance actual.