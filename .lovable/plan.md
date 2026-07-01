## Objetivo

Habilitar **modalidad presencial** en programas (sin dar acceso al campus virtual) y añadir un sistema de **Grupos / Cohortes** con relación alumno ↔ grupo.

---

## 1. Modalidad "presencial"

Hoy `programs.modalidad` acepta solo `sincrono | asincrono | mixto`. Se amplía a:

- `sincrono` (en línea, clase en vivo — con campus)
- `asincrono` (virtual asincrónico — con campus)
- `mixto` (con campus)
- `presencial` (nuevo — **sin acceso a campus virtual**)

Reglas:
- Cambiar el CHECK constraint de `programs.modalidad` para incluir `presencial`.
- En la UI de creación/edición de programas: agregar la opción "Presencial".
- En el flujo del estudiante (`/mis-cursos`, dashboard estudiante, listado de programas activos): si `programa.modalidad = 'presencial'`, ocultar accesos a lecciones/materiales/Zoom del campus y mostrar en su lugar una tarjeta informativa "Programa presencial — consulta con tu docente/coordinador el aula y horario". El estudiante sigue existiendo como inscrito (para certificados, pagos, asistencia), pero no ve campus.
- Los programas presenciales igual pueden asociarse a un grupo/cohorte (ver abajo).

---

## 2. Tabla `program_cohorts` (Grupos / Cohortes)

Nueva tabla con:

- `nombre` (ej: "Terapia de Aprendizaje — Cohorte 2026-A")
- `programa_id` → `programs.id`
- `modalidad` (`sincrono | asincrono | mixto | presencial`) — puede heredar del programa pero es sobreescribible por grupo
- `nivel_actual` (texto libre, ej: "Módulo 3 - Semana 2")
- `docente_id` → `teachers.id` (puede diferir del docente del programa)
- `horario` (texto libre, ej: "Sábados 9:00 - 12:00")
- `fecha_inicio`, `fecha_fin` (date)
- `dias_clase` (texto o jsonb con lista de fechas de clase específicas)
- `ubicacion` (texto opcional — aula/sede para presencial, o enlace Zoom recurrente)
- `cupo_maximo` (int, opcional)
- `estado` (`planificado | activo | finalizado | cancelado`)

RLS:
- Admin: CRUD completo.
- Docente: SELECT y UPDATE (campos limitados: `nivel_actual`, `horario`, `dias_clase`) de los grupos donde `docente_id` = su teacher.
- Estudiante: SELECT solo de los grupos donde está inscrito.

---

## 3. Relación alumno ↔ grupo

Nueva tabla `cohort_enrollments`:

- `cohort_id` → `program_cohorts.id`
- `enrollment_id` → `enrollments.id` (mantiene ligado al pago/estado existente)
- `user_id` → redundante para RLS eficiente
- `fecha_asignacion`, `estado` (`activo | retirado | trasladado`)
- UNIQUE `(cohort_id, enrollment_id)`

Un estudiante puede pertenecer a **un grupo por inscripción**. Trasladar un alumno = marcar el registro anterior como `trasladado` y crear otro.

RLS:
- Admin: CRUD.
- Docente: SELECT sobre grupos que dicta (para ver su lista de alumnos).
- Estudiante: SELECT sobre sus propias filas.

---

## 4. UI

**Panel Admin — nueva sección `/admin/grupos`:**
- Listado de cohortes filtrable por programa/modalidad/estado.
- Crear/editar cohorte con todos los campos.
- Vista de detalle con pestañas: "Información", "Alumnos" (asignar/quitar de inscripciones existentes al programa), "Docente".

**Panel Docente — nueva pestaña "Mis Grupos"** en `/docente`:
- Grupos donde es docente titular.
- Lista de alumnos del grupo, botón para actualizar `nivel_actual` y `horario`.

**Panel Estudiante:**
- En la tarjeta de curso/diplomado activo mostrar: nombre del grupo, docente, horario, próxima clase.
- Si `modalidad = 'presencial'`: reemplazar botón "Entrar al campus" por tarjeta informativa.

**Formulario de programa (admin):** añadir "Presencial" al selector y mostrar aviso "Los programas presenciales no habilitan campus virtual para los alumnos; solo se gestionan grupos, asistencia y certificados".

---

## Detalles técnicos

- Migración única: `ALTER TABLE programs DROP CONSTRAINT programs_modalidad_check; ADD CONSTRAINT ... CHECK IN ('sincrono','asincrono','mixto','presencial')`.
- `CREATE TABLE public.program_cohorts` + `cohort_enrollments` con GRANTs (`authenticated`, `service_role`), RLS y policies usando `has_role(auth.uid(),'admin')` y `is_teacher_of_program`-style helper nuevo `is_teacher_of_cohort(_cohort_id)`.
- Trigger `updated_at` en ambas.
- Actualizar types de Supabase tras aprobar migración.
- Rutas nuevas: `src/routes/_authenticated/admin.grupos.tsx`, `admin.grupos.$cohortId.tsx`, `docente.grupos.tsx`.
- Componentes: `CohortForm`, `CohortStudentsManager`, `CohortCard` (para dashboard estudiante).
- Guard en `StudentShell` / `mis-cursos`: si `modalidad='presencial'`, render alterno sin links a lecciones/materiales/Zoom.
- Sidebar admin: entrada "Grupos". Sidebar docente: entrada "Mis Grupos".

---

## Preguntas antes de implementar

1. ¿Un alumno puede estar en **más de un grupo del mismo programa** (ej. cambio de horario a mitad de camino con historial), o siempre uno activo a la vez?
2. Para `dias_clase`: ¿prefieres **texto libre** ("Sáb 9-12 durante 12 semanas") o **lista estructurada de fechas** (para futuro control de asistencia)?
3. En programas **presenciales** ¿quieres que el estudiante siga viendo la pestaña **Evaluaciones** y **Certificados**, o también se ocultan?
