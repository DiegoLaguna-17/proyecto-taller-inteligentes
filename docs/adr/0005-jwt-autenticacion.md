# 5. Uso de JWT para Autenticación

* **Estado:** Aceptado
* **Fecha de decisión:** 2026-09-17
* **Autores:** Equipo GlucoTracker

## Contexto y Problema

`design.md` dejaba abierta la elección del esquema de autenticación (JWT, sesiones con Supabase Auth, u OAuth) para proteger todos los endpoints salvo `/auth/login` (ver `docs/risks.md`, RT-01). Era necesario cerrar esta decisión antes de implementar cualquier endpoint que dependa de sesión de usuario.

## Alternativas Consideradas

1. **Supabase Auth:** Autenticación gestionada directamente por Supabase, con menor código propio pero mayor acoplamiento al ecosistema de Supabase para toda la gestión de sesión.
2. **OAuth (proveedor externo):** Delegación a un proveedor de identidad externo (ej. Google), innecesaria para el alcance actual del proyecto (roles internos: paciente, médico, administrador).
3. **JWT (JSON Web Tokens) emitidos por el propio backend:** El backend FastAPI emite y valida sus propios tokens firmados, usando las librerías ya presentes en `backend/requirements.txt` (`python-jose[cryptography]`, `passlib[bcrypt]`).

## Decisión Tomada

Se adopta **JWT** como esquema de autenticación. El backend emite el token en `POST /auth/login` y lo exige (vía header `Authorization`) en el resto de los endpoints protegidos definidos en `design.md` § API / Interface Design.

## Consecuencias

* **Positivas:** No introduce una dependencia adicional de gestión de sesión fuera del backend; las librerías necesarias ya estaban contempladas en `requirements.txt`; consistente con el enfoque de backend monolítico modular (ADR-0001).
* **Negativas / Riesgos asumidos:** El equipo es responsable de la lógica de expiración, refresco y revocación de tokens (no delegada a un proveedor gestionado como Supabase Auth).
