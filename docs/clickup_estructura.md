# Estructura del Workspace de ClickUp

Este documento describe la organización jerárquica del workspace de ClickUp utilizado para el proyecto **GlucoTracker**, incluyendo sus espacios, carpetas, listas, estados y campos comunes.

---

## 1. Workspace

| Propiedad | Valor |
|---|---|
| **Nombre** | Workspace |
| **ID** | 90171443038 |
| **Espacios** | 1 (GOALs) |

---

## 2. Espacio: GOALs

El workspace contiene un único espacio llamado **GOALs**, dentro del cual se organiza todo el trabajo del proyecto.

| Propiedad | Valor |
|---|---|
| **Nombre** | GOALs |
| **ID** | 90176761375 |
| **Carpetas** | 1 (GlucoTracker) |

---

## 3. Carpeta: GlucoTracker

Dentro del espacio GOALs existe una única carpeta, **GlucoTracker**, que agrupa todas las listas del proyecto.

| Propiedad | Valor |
|---|---|
| **Nombre** | GlucoTracker |
| **ID** | 901710311194 |
| **Listas** | 6 |

### 3.1 Listas dentro de GlucoTracker

| Lista | ID | Propósito |
|---|---|---|
| **Taller de Sis Inteligentes** | 901715789740 | Historias de usuario (US) del proyecto, organizadas por sprint, con criterios de aceptación, evidencia y riesgos asociados. |
| **Discovery** | 901716328007 | Actividades de investigación y descubrimiento previas al desarrollo. |
| **Data** | 901716328010 | Tareas relacionadas con el manejo, modelado y preparación de datos. |
| **Architecture** | 901716328019 | Tareas de diseño y definición de la arquitectura del sistema. |
| **Build/QA/Deploy** | 901716328027 | Tareas de construcción, pruebas de calidad y despliegue. |
| **Risk** | 901716328031 | Registro y seguimiento de riesgos del proyecto. |

---

## 4. Estados (Statuses) por lista

### 4.1 Lista "Taller de Sis Inteligentes"

Esta lista cuenta con un flujo de estados personalizado, distinto al resto de las listas de la carpeta:

| Orden | Estado | Tipo |
|---|---|---|
| 1 | Backlog | Abierto (open) |
| 2 | Pendiente | Sin iniciar (unstarted) |
| 3 | En curso | Personalizado (custom) |
| 4 | Certificación | Personalizado (custom) |
| 5 | Completado | Cerrado (closed) |

### 4.2 Resto de listas (Discovery, Data, Architecture, Build/QA/Deploy, Risk)

Estas cinco listas comparten el mismo flujo de estados, heredado del espacio:

| Orden | Estado | Tipo |
|---|---|---|
| 1 | Pendiente | Abierto (open) |
| 2 | En curso | Personalizado (custom) |
| 3 | Completado | Cerrado (closed) |

---

## 5. Campos comunes (Custom Fields)

### 5.1 Campo "Sprint"

| Propiedad | Valor |
|---|---|
| **Nombre** | Sprint |
| **Tipo** | Texto |
| **Definido en** | Lista "Taller de Sis Inteligentes" |
| **Descripción** | Número entero que representa el sprint en el cual se ha asignado la tarea (por ejemplo: 1, 2, 3). |
| **Obligatorio** | No |

### 5.2 Campo "Asignado" (Assignee)

| Propiedad | Valor |
|---|---|
| **Nombre** | Asignado / Assignee |
| **Tipo** | Campo nativo de ClickUp (miembro del workspace) |
| **Descripción** | Miembro del equipo responsable de ejecutar la tarea. Se asigna desde la lista de miembros del workspace. |

### 5.3 Otros campos utilizados en la descripción de las tareas

Actualmente, en la lista "Taller de Sis Inteligentes" los siguientes datos se documentan dentro de la descripción de cada tarea (no como campos personalizados independientes):

| Campo | Descripción |
|---|---|
| **Historia de Usuario** | Narrativa en formato "Como [rol], quiero [acción], para [beneficio]". |
| **Criterio de Aceptación** | Redactado en formato *verbo + objeto + criterio + evidencia*. |
| **Evidencia** | Enlace (URL) al repositorio del proyecto que respalda el cumplimiento de la tarea. |
| **Riesgo asociado** | Descripción textual de los riesgos que podrían afectar la tarea. |
| **Estado de bloqueo** | Indica si la tarea depende de otra historia de usuario para poder iniciarse. |

> **Nota:** Se recomienda, como mejora futura, crear campos personalizados dedicados para "Evidencia" (tipo URL) y "Riesgo" (tipo texto), de modo que puedan visualizarse como columnas independientes en la vista de lista en lugar de estar únicamente en la descripción.

---

## 6. Miembros del Workspace

| Nombre | Correo |
|---|---|
| Roger | oviroger@gmail.com |
| Adrian Fabricio Ordóñez Paredes | adrian.ordonez.p@ucb.edu.bo |
| Adrian Gonzales Ferreira | adrian.gonzales.f@ucb.edu.bo |
| Diego Mateo Laguna Levy | diego.laguna@ucb.edu.bo |
| Adriana Alvarez | adriana.alvarez.c@ucb.edu.bo |

---

## 7. Resumen jerárquico

```
Workspace
└── Espacio: GOALs
    └── Carpeta: GlucoTracker
        ├── Lista: Taller de Sis Inteligentes  (estados: Backlog, Pendiente, En curso, Certificación, Completado)
        ├── Lista: Discovery                   (estados: Pendiente, En curso, Completado)
        ├── Lista: Data                        (estados: Pendiente, En curso, Completado)
        ├── Lista: Architecture                (estados: Pendiente, En curso, Completado)
        ├── Lista: Build/QA/Deploy             (estados: Pendiente, En curso, Completado)
        └── Lista: Risk                        (estados: Pendiente, En curso, Completado)
```
