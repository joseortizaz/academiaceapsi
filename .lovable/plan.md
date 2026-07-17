# Gating de contenido por cohorte (Opción A)

Permite tener varios grupos activos del mismo diplomado con cronogramas distintos, sin duplicar el programa y sin quitarle acceso de repaso a los grupos avanzados.

## Idea central

Hoy `program_modules.disponible_desde` es una fecha absoluta que aplica a todos por igual. La cambiamos por un **offset relativo al inicio de cada cohorte**: cada módulo/lección se define como "disponible el día N desde el arranque del grupo". La fecha real de apertura para un alumno se calcula así:

```
fecha_apertura(alumno, módulo) = cohorte.fecha_inicio + módulo.offset_dias
```

- Un alumno del grupo que ya va por la mitad ve todo lo publicado hasta hoy.
- Un alumno del grupo nuevo solo ve el contenido a medida que su cronograma avanza.
- Los alumnos que ya **completaron** el diplomado conservan acceso permanente para repaso (bypass de fecha).

## Cambios de datos

- `program_modules`: añadir `disponible_offset_dias INTEGER` (nullable). Se conserva `disponible_desde` para compatibilidad; si el módulo tiene offset, éste manda.
- (Opcional, fase 2) `cohort_module_overrides`: tabla para excepciones puntuales (postergar una lección para una cohorte específica).
- Función SQL `is_module_available_for_user(user_id, modulo_id)` que resuelve:
  1. Admin/docente del programa → siempre `true`.
  2. Enrollment `completado` → siempre `true` (repaso permanente).
  3. Cohorte activa del alumno → `now() >= cohorte.fecha_inicio + offset_dias`.
  4. Sin cohorte asignada → cae al comportamiento actual (`disponible_desde` o abierto).

## Cambios de acceso (RLS y lecturas)

- La política SELECT de `program_modules` sigue permitiendo ver la lección; el **gating de contenido** (video, materiales, audios) se aplica en la UI usando `is_module_available_for_user`, tal como funciona hoy con `disponible_desde`.
- `lesson_materials` y `module_progress`: mismo criterio — se pueden listar, pero el contenido se bloquea si el módulo no está disponible.

## Cambios de UI

**Admin — editor de módulos (`admin.modulos.tsx`)**
- Nuevo campo "Disponible desde el día N del inicio de cohorte" junto al actual "Disponible desde (fecha)".
- Aviso claro: "Si el programa usa cohortes, este número prevalece sobre la fecha fija".

**Admin — grupos (`admin.grupos.tsx`)**
- Mostrar cronograma calculado del grupo (lista de módulos con su fecha real derivada).
- Botón "Postergar módulo" (fase 2, si se aprueba el override por cohorte).

**Estudiante (`mis-cursos.$slug.tsx`)**
- Sidebar y contenido bloquean/desbloquean lecciones según `is_module_available_for_user`.
- Mensaje: "Disponible el DD/MM/YYYY según tu grupo".
- Los alumnos con inscripción `completado` ven todo desbloqueado con un badge "Modo repaso".

**Docente**
- Vista de cronograma por cohorte (qué módulo toca esta semana en cada grupo).

## Migración de datos existente

- Diplomados que ya usan `disponible_desde`: se dejan como están (siguen funcionando).
- Para adoptar el nuevo modelo en un diplomado existente:
  1. Definir `offset_dias` por módulo (script una vez, o edición manual desde admin).
  2. Asegurarse de que cada alumno esté asignado a una `program_cohorts` con `fecha_inicio`.
  3. Opcionalmente limpiar `disponible_desde` para que el offset sea la única fuente.

## Implicaciones a tener presente

- **Alumnos sin cohorte asignada**: caerán al comportamiento antiguo. Conviene establecer como regla operativa que todo alumno de diplomado on-line quede en una cohorte al momento de matricularse.
- **Foros/comentarios (`lesson_comments`, `community_posts`)**: seguirán siendo comunes a todo el programa; si en el futuro queremos aislarlos por cohorte, es un cambio adicional.
- **Evaluaciones y clases Zoom**: hoy se asocian al programa, no a la cohorte. Con este cambio los alumnos nuevos no podrán responder una evaluación de un módulo que aún no tienen disponible (el gating de módulo cubre eso), pero clases Zoom recurrentes seguirán siendo por cohorte via `program_cohorts.docente_id` y horario.
- **Certificados**: no se afectan; siguen emitiéndose al completar 100% del programa.
- **Repaso post-graduación**: garantizado gracias al bypass para inscripciones `completado`.

## Alcance de la implementación

Fase 1 (recomendada primero):
1. Migración: columna `disponible_offset_dias` + función `is_module_available_for_user`.
2. Editor admin de módulos: input de offset.
3. Vista estudiante: usar la función para gatear contenido y mostrar fecha calculada.
4. Vista admin de grupo: cronograma derivado.

Fase 2 (opcional):
5. Tabla de overrides por cohorte.
6. Aislamiento de foros por cohorte.

## Detalle técnico

```sql
ALTER TABLE public.program_modules
  ADD COLUMN disponible_offset_dias integer;

CREATE OR REPLACE FUNCTION public.is_module_available_for_user(
  _user_id uuid, _modulo_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH m AS (
    SELECT pm.programa_id, pm.disponible_desde, pm.disponible_offset_dias
    FROM program_modules pm WHERE pm.id = _modulo_id
  )
  SELECT
    has_role(_user_id,'admin') OR
    EXISTS (SELECT 1 FROM m WHERE is_teacher_of_program(m.programa_id)) OR
    EXISTS (
      SELECT 1 FROM enrollments e, m
      WHERE e.user_id=_user_id AND e.programa_id=m.programa_id
        AND e.estado='completado'
    ) OR
    EXISTS (
      SELECT 1
      FROM enrollments e
      JOIN cohort_enrollments ce ON ce.enrollment_id=e.id AND ce.estado='activo'
      JOIN program_cohorts c ON c.id=ce.cohort_id
      , m
      WHERE e.user_id=_user_id AND e.programa_id=m.programa_id
        AND e.estado IN ('activo','completado')
        AND (
          (m.disponible_offset_dias IS NOT NULL
             AND c.fecha_inicio IS NOT NULL
             AND now()::date >= c.fecha_inicio + m.disponible_offset_dias)
          OR (m.disponible_offset_dias IS NULL
             AND (m.disponible_desde IS NULL OR now() >= m.disponible_desde))
        )
    );
$$;
```
