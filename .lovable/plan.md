## Objetivo

Reestructurar el contenido académico para soportar dos jerarquías distintas según el tipo de programa:

- **Diplomados**: Programa → Módulos → Lecciones (3 niveles)
- **Cursos**: Programa → Lecciones (2 niveles, sin módulos intermedios)

Actualmente el sistema solo tiene `programs` → `program_modules` (donde "módulos" funcionan como lecciones), lo que no permite agrupar lecciones bajo módulos temáticos en diplomados.

---

## 1. Cambios en base de datos

### Nueva tabla `course_modules` (módulos agrupadores, solo para diplomados)
Campos clave: `programa_id`, `titulo`, `descripcion`, `orden`.
- RLS: admins gestionan; docentes del programa gestionan; estudiantes inscritos leen.
- Grants estándar (`authenticated`, `service_role`).

### Renombrar concepto en `program_modules` → tabla de **lecciones**
Opción recomendada (menos disruptiva): **mantener el nombre `program_modules` en SQL** pero tratarla como "lecciones" en UI/código. Añadir columna nullable:

- `modulo_id uuid NULL` → referencia opcional a `course_modules.id`.
  - En **diplomados** será obligatorio (validación a nivel app/trigger).
  - En **cursos** queda NULL (lección directamente bajo el programa).

Alternativa más limpia (mayor refactor): renombrar `program_modules` a `program_lessons`. Recomiendo **NO hacerlo ahora** para no romper `module_progress`, `assessments.modulo_id`, `program_access_links.modulo_id`, `lesson_comments.modulo_id`, `zoom_meetings.modulo_id` y la regeneración de tipos. Mantener nombre físico, cambiar solo el label en UI.

### Trigger de validación
Función que valida: si `programs.tipo = 'diplomado'` entonces `program_modules.modulo_id` debe ser NOT NULL; si `tipo = 'curso'` debe ser NULL.

### Migración de datos existentes
Para cada diplomado existente: crear un `course_modules` por defecto ("Módulo 1") y asignar todas sus lecciones actuales a ese módulo. Cursos no requieren cambios.

---

## 2. Cambios en UI de administración

### `admin.programas.tsx` (formulario de crear/editar programa)
- Sin cambios estructurales; el `tipo` (curso/diplomado) ya existe.

### Nueva pantalla / sección: gestor de **Módulos** (solo diplomados)
- En la pantalla de edición del programa, si `tipo = 'diplomado'`: mostrar lista de módulos con CRUD (título, descripción, orden) y drag-to-reorder.
- Botón "Agregar lección" dentro de cada módulo.

### `admin.modulos.tsx` (actualmente edita lo que hoy llamamos módulos = lecciones)
- Renombrar a "Lecciones" en toda la UI (títulos, breadcrumbs, botones).
- Añadir selector de **módulo padre** cuando el programa es diplomado.
- Ocultar selector cuando es curso.

---

## 3. Cambios en UI de estudiante / docente

### `mis-cursos.$slug.tsx` (player del curso)
- Sidebar de contenido:
  - **Curso**: lista plana de lecciones (igual que hoy).
  - **Diplomado**: lista agrupada por módulo (accordion con módulos expandibles, lecciones dentro). Progreso por módulo + global.

### `programas.$slug.tsx` (página pública del programa)
- Curso: muestra temario como lista de lecciones.
- Diplomado: muestra temario agrupado por módulos con sus lecciones.

### `docente.cursos.tsx` y vistas docentes
- Misma lógica: agrupar por módulos en diplomados.

---

## 4. Cambios en lógica relacionada

- **Progreso (`module_progress`)**: sigue ligado a `modulo_id` (= lección). El % por módulo agrupador se calcula sumando lecciones completadas dentro del módulo.
- **Evaluaciones (`assessments.modulo_id`)**: puede seguir apuntando a una lección. Opcionalmente se puede permitir asignar a un módulo entero (fuera de scope para este plan).
- **Zoom (`zoom_meetings.modulo_id`)**, **comentarios (`lesson_comments.modulo_id`)**, **accesos (`program_access_links.modulo_id`)**: sin cambios, siguen ligados a lección.
- **Certificados**: sin cambios.

---

## 5. Detalles técnicos

```text
programs (tipo: curso|diplomado)
  ├── course_modules           (NUEVO — solo diplomados)
  │     └── program_modules    (= lecciones, modulo_id → course_modules.id)
  └── program_modules          (= lecciones, modulo_id NULL para cursos)
```

- Trigger `validate_lesson_hierarchy()` en `program_modules` antes de INSERT/UPDATE.
- Índices: `course_modules(programa_id, orden)`, `program_modules(modulo_id, orden)`.
- Tipos TypeScript: se regeneran automáticamente tras la migración.

---

## 6. Orden de implementación

1. Migración SQL: crear `course_modules`, agregar `modulo_id` a `program_modules`, trigger de validación, migrar datos existentes, GRANTs y RLS.
2. Actualizar `admin.programas.tsx` con gestor de módulos embebido para diplomados.
3. Actualizar `admin.modulos.tsx` → renombrar a "Lecciones" + selector de módulo padre.
4. Actualizar `mis-cursos.$slug.tsx` con sidebar agrupado para diplomados.
5. Actualizar `programas.$slug.tsx` (página pública) con temario agrupado.
6. QA: crear un diplomado de prueba con 2 módulos y 3 lecciones cada uno; crear un curso de prueba con 4 lecciones planas; verificar progreso, comentarios y Zoom en ambos.

---

## Preguntas de confirmación antes de implementar

1. ¿Migramos los diplomados existentes creando un único "Módulo 1" que contenga todas sus lecciones actuales, o prefieres hacerlo manualmente luego?
2. ¿Las **evaluaciones** deben poder asignarse a un módulo completo (no solo a una lección), o se mantienen siempre a nivel lección?
3. ¿En la página pública de diplomados quieres que los módulos aparezcan **expandidos por defecto** o colapsados (accordion)?
