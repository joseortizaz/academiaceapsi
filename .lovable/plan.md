## Objetivo
Permitir que cada lección tenga **múltiples materiales adjuntos** (PDF, Word, Excel, PPT, etc.) en lugar de uno solo.

## 1. Base de datos
Nueva tabla `lesson_materials` para guardar N archivos por lección:

- `id`, `modulo_id` (FK a `program_modules`), `programa_id` (para RLS rápida)
- `nombre` (etiqueta visible, ej. "Guía del módulo 1")
- `url` (archivo subido)
- `tipo` (pdf/word/excel/ppt/otro, derivado de la extensión)
- `tamano_bytes` (opcional, para mostrar peso)
- `orden`, `created_at`

RLS:
- Admins: gestión total.
- Docentes del programa: gestión sobre los materiales de sus lecciones.
- Estudiantes inscritos: solo lectura.

**Migración de datos:** los `material_url` existentes en `program_modules` se copian como primer registro de `lesson_materials` para no perder nada. La columna `material_url` se conserva (deprecated) por compatibilidad, pero la UI deja de usarla.

## 2. Administración (`admin.modulos.tsx`)
En el diálogo de lección, reemplazar el bloque actual "Material complementario" por un **gestor de lista**:

- Lista de materiales ya cargados con: nombre editable, ícono según tipo, botón eliminar, drag para reordenar.
- Botón **"Agregar material"** que abre el `FileUploader` y, al terminar, añade una fila nueva con nombre por defecto = nombre del archivo.
- Los cambios se guardan al guardar la lección (un solo `upsert` + `delete` de los removidos), o inmediatamente si la lección ya existe.

## 3. Vista del estudiante (`mis-cursos.$slug.tsx`)
En el panel de la lección activa, sustituir el único botón "Descargar material" por una **lista de materiales** con nombre, ícono por tipo y enlace de descarga. Si no hay materiales, no mostrar la sección.

## 4. Vista del docente
La pantalla donde el docente revisa su lección (si existe en `docente.cursos.tsx`/clase) también muestra la lista en vez del único enlace.

## 5. Vista pública del programa (`programas.$slug.tsx`)
No cambia: los materiales siguen siendo privados (solo para inscritos).

## 6. Orden de ejecución
1. Migración SQL (tabla + RLS + copia de datos existentes).
2. `admin.modulos.tsx` — gestor multi-archivo.
3. `mis-cursos.$slug.tsx` — render de lista.
4. QA: subir varios archivos, reordenar, eliminar, verificar que un alumno inscrito los ve y un visitante no.

## Preguntas
1. ¿Quieres que cada material tenga **nombre personalizable** (ej. "Guía teórica.pdf" → "Guía teórica del módulo 1") o basta con el nombre original del archivo?
2. ¿Algún **límite** de materiales por lección o tamaño máximo por archivo (hoy el bucket `course-materials` no impone uno desde la UI)?
3. ¿Mantener `program_modules.material_url` por compatibilidad o **eliminarlo** después de migrar los datos?
