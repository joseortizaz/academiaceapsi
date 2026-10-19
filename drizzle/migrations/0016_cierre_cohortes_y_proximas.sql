-- Cohortes como única fuente de fechas públicas + cierre de acceso por cohorte.
--
-- 1. Un grupo (program_cohorts) se cierra 10 días después de su fecha_fin.
--    Desde ese día, sus alumnos ya no ven los contenidos del programa
--    (lecciones, materiales, enlaces, clases y grabaciones, evaluaciones,
--    anuncios y comunidad). Los certificados siguen disponibles.
--    Un alumno conserva el acceso si tiene otro grupo abierto del mismo programa.
--    Alumnos sin grupo (cursos a su ritmo) no se ven afectados.
-- 2. proximas_cohortes(): lectura pública de los grupos que aún no empiezan,
--    para mostrar fecha, día, horario y cupo en el catálogo y en cada programa.
-- Idempotente.

-- ============================================================
-- 1. Reglas de fecha (hora de República Dominicana)
-- ============================================================
create or replace function public.hoy_rd()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'America/Santo_Domingo')::date
$$;

-- Días de acceso que se conservan después de la fecha de término del grupo.
create or replace function public.cohorte_dias_gracia()
returns integer
language sql
immutable
as $$ select 10 $$;

-- Último día con acceso: fecha_fin + 10. Desde el día siguiente el grupo está cerrado.
create or replace function public.cohorte_ultimo_dia_acceso(_fecha_fin date)
returns date
language sql
immutable
as $$ select _fecha_fin + public.cohorte_dias_gracia() $$;

-- ============================================================
-- 2. ¿El usuario conserva acceso a los contenidos del programa?
-- ============================================================
create or replace function public.cohort_access_open(_programa_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is null
      or _programa_id is null
      or public.has_role(_user_id, 'admin'::app_role)
      or public.has_role(_user_id, 'docente'::app_role)
      -- Sin grupo en este programa: no aplica el cierre.
      or not exists (
        select 1
          from public.cohort_enrollments ce
          join public.program_cohorts pc on pc.id = ce.cohort_id
         where ce.user_id = _user_id
           and pc.programa_id = _programa_id
      )
      -- Al menos un grupo del programa sigue abierto.
      or exists (
        select 1
          from public.cohort_enrollments ce
          join public.program_cohorts pc on pc.id = ce.cohort_id
         where ce.user_id = _user_id
           and pc.programa_id = _programa_id
           and (pc.fecha_fin is null
                or public.cohorte_ultimo_dia_acceso(pc.fecha_fin) >= public.hoy_rd())
      )
$$;

revoke all on function public.cohort_access_open(uuid, uuid) from public;
grant execute on function public.cohort_access_open(uuid, uuid) to authenticated, service_role;

-- Estado de acceso del alumno conectado, por programa (para la interfaz).
create or replace function public.mi_acceso_cohortes()
returns table(programa_id uuid, cohorte text, fecha_fin date, ultimo_dia_acceso date, abierto boolean)
language sql
stable
security definer
set search_path = public
as $$
  with mias as (
    select pc.programa_id, pc.nombre, pc.fecha_fin,
           case when pc.fecha_fin is null then null
                else public.cohorte_ultimo_dia_acceso(pc.fecha_fin) end as ultimo
      from public.cohort_enrollments ce
      join public.program_cohorts pc on pc.id = ce.cohort_id
     where ce.user_id = auth.uid()
  )
  select distinct on (m.programa_id)
         m.programa_id,
         trim(m.nombre),
         m.fecha_fin,
         m.ultimo,
         public.cohort_access_open(m.programa_id, auth.uid())
    from mias m
   -- El grupo que más tarde cierra (o sin fecha de fin) representa al programa.
   order by m.programa_id, m.ultimo desc nulls first
$$;

revoke all on function public.mi_acceso_cohortes() from public;
grant execute on function public.mi_acceso_cohortes() to authenticated;

-- ============================================================
-- 3. Política restrictiva en las tablas de contenido por programa
-- ============================================================
-- course_modules queda fuera: sus títulos ya son públicos en la ficha del programa.
-- certificates queda fuera: el egresado conserva su certificado.
do $$
declare
  t text;
begin
  foreach t in array array[
    'program_modules', 'lesson_materials', 'program_access_links', 'zoom_meetings',
    'assessments', 'announcements', 'community_posts', 'lesson_comments'
  ]
  loop
    execute format('drop policy if exists "cierre de cohorte" on public.%I', t);
    execute format(
      'create policy "cierre de cohorte" on public.%I as restrictive for all to authenticated '
      || 'using (public.cohort_access_open(programa_id)) '
      || 'with check (public.cohort_access_open(programa_id))',
      t
    );
  end loop;
end $$;

-- ============================================================
-- 4. Vistas de alumno (security definer): aplicar el mismo cierre
-- ============================================================
create or replace view public.zoom_meetings_student
with (security_invoker = off) as
 select zm.id,
    zm.programa_id,
    zm.modulo_id,
    zm.titulo,
    zm.status,
    zm.zoom_meeting_id,
    zm.start_at,
    zm.duration_min,
    zm.docente_nombre,
    zm.recording_share_url,
    zm.recording_duration_min,
    zm.cohort_id,
    pc.nombre as cohort_nombre,
    zm.created_at,
    zm.updated_at
   from public.zoom_meetings zm
     left join public.program_cohorts pc on pc.id = zm.cohort_id
  where (public.has_role(auth.uid(), 'admin'::app_role)
         or public.is_teacher_of_program(zm.programa_id)
         or exists (select 1
                      from public.enrollments e
                     where e.programa_id = zm.programa_id
                       and e.user_id = auth.uid()))
    and public.cohort_access_open(zm.programa_id, auth.uid());

create or replace view public.assessment_questions_student
with (security_invoker = false) as
 select q.id,
    q.assessment_id,
    q.tipo,
    q.enunciado,
    q.opciones,
    q.orden,
    q.puntaje,
    q.created_at
   from public.assessment_questions q
     join public.assessments a on a.id = q.assessment_id and a.publicado = true
  where exists (select 1
                  from public.enrollments e
                 where e.programa_id = a.programa_id
                   and e.user_id = auth.uid()
                   and e.estado = any (array['activo'::text, 'completado'::text]))
    and public.cohort_access_open(a.programa_id, auth.uid());

-- ============================================================
-- 5. Próximos grupos (lectura pública)
-- ============================================================
create or replace function public.proximas_cohortes()
returns table(programa_id uuid, fecha_inicio date, horario text, cupo_maximo integer, modalidad text)
language sql
stable
security definer
set search_path = public
as $$
  select pc.programa_id,
         pc.fecha_inicio,
         nullif(trim(pc.horario), ''),
         pc.cupo_maximo,
         pc.modalidad
    from public.program_cohorts pc
    join public.programs p on p.id = pc.programa_id
   where p.estado in ('publicado', 'en_curso')
     and pc.estado in ('planificado', 'activo')
     and pc.fecha_inicio is not null
     and pc.fecha_inicio >= public.hoy_rd()
   order by pc.programa_id, pc.fecha_inicio
$$;

revoke all on function public.proximas_cohortes() from public;
grant execute on function public.proximas_cohortes() to anon, authenticated;
