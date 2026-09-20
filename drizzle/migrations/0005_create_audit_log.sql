create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_nombre text,
  actor_email text,
  actor_rol text not null default 'sistema',
  categoria text not null check (categoria in ('datos','acceso','admin','actividad')),
  accion text not null,
  entidad text,
  entidad_id text,
  entidad_etiqueta text,
  programa_id uuid,
  sujeto_id uuid,
  cambios jsonb,
  detalle jsonb,
  sensible boolean not null default false,
  ip text,
  user_agent text
);
create index audit_log_occurred_idx on public.audit_log (occurred_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, occurred_at desc);
create index audit_log_sujeto_idx on public.audit_log (sujeto_id, occurred_at desc);
create index audit_log_programa_idx on public.audit_log (programa_id, occurred_at desc);
create index audit_log_cat_ent_idx on public.audit_log (categoria, entidad, occurred_at desc);
create index audit_log_sensible_idx on public.audit_log (occurred_at desc) where sensible;

alter table public.audit_log enable row level security;
create policy "Admins leen auditoria" on public.audit_log
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;

create or replace function public.audit_trunc(v jsonb) returns jsonb language sql immutable as $$
  select case when jsonb_typeof(v) = 'string' and char_length(v #>> '{}') > 300
              then to_jsonb(left(v #>> '{}', 300) || '…') else v end
$$;

create or replace function public.audit_resolve_actor(_uid uuid default auth.uid())
returns table (actor_id uuid, actor_nombre text, actor_email text, actor_rol text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if _uid is null then
    return query select null::uuid, 'Sistema'::text, null::text, 'sistema'::text;
    return;
  end if;
  return query select _uid,
    (select nullif(trim(coalesce(p.nombre,'') || ' ' || coalesce(p.apellido,'')), '') from public.profiles p where p.id = _uid),
    (select u.email::text from auth.users u where u.id = _uid),
    (case when public.has_role(_uid, 'admin') then 'admin'
          when public.has_role(_uid, 'docente') then 'docente'
          else 'estudiante' end)::text;
end $$;
revoke all on function public.audit_resolve_actor(uuid) from public, anon, authenticated;

create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  ignore_cols text[] := array['updated_at','created_at','synced_at','raw','password','zoom_password','zoom_start_url','recording_password','respuestas'];
  watch_cols text[] := case when coalesce(TG_ARGV[0],'') = '' then null else string_to_array(TG_ARGV[0], ',') end;
  extra_ignore text[] := case when coalesce(TG_ARGV[1],'') = '' then array[]::text[] else string_to_array(TG_ARGV[1], ',') end;
  o jsonb; n jsonb; j jsonb; k text;
  v_cambios jsonb := '{}'::jsonb;
  v_label text; v_sujeto uuid; v_programa uuid; v_sens boolean := false;
  a record;
begin
  if TG_OP = 'INSERT' then n := to_jsonb(NEW); j := n;
  elsif TG_OP = 'DELETE' then o := to_jsonb(OLD); j := o;
  else o := to_jsonb(OLD); n := to_jsonb(NEW); j := n; end if;

  for k in select jsonb_object_keys(j) loop
    if k = any(ignore_cols) or k = any(extra_ignore) then continue; end if;
    if watch_cols is not null and not (k = any(watch_cols)) then continue; end if;
    if TG_OP = 'UPDATE' then
      if (n -> k) is distinct from (o -> k) then
        v_cambios := v_cambios || jsonb_build_object(k, jsonb_build_object('antes', public.audit_trunc(o -> k), 'despues', public.audit_trunc(n -> k)));
      end if;
    elsif TG_OP = 'INSERT' then
      v_cambios := v_cambios || jsonb_build_object(k, jsonb_build_object('despues', public.audit_trunc(n -> k)));
    else
      v_cambios := v_cambios || jsonb_build_object(k, jsonb_build_object('antes', public.audit_trunc(o -> k)));
    end if;
  end loop;

  if TG_OP = 'UPDATE' and v_cambios = '{}'::jsonb then return null; end if;

  v_label := coalesce(j->>'titulo', j->>'nombre_completo', j->>'nombre', j->>'codigo', j->>'numero_certificado', j->>'slug', j->>'role', j->>'email');
  if TG_TABLE_NAME = 'profiles' then
    v_label := nullif(trim(coalesce(j->>'nombre','') || ' ' || coalesce(j->>'apellido','')), '');
  elsif TG_TABLE_NAME = 'assessment_submissions' then
    select a2.titulo into v_label from public.assessments a2 where a2.id = (j->>'assessment_id')::uuid;
  elsif TG_TABLE_NAME = 'cohort_enrollments' then
    select c.nombre into v_label from public.program_cohorts c where c.id = (j->>'cohort_id')::uuid;
  end if;

  v_sujeto := case when TG_TABLE_NAME = 'profiles' then (j->>'id')::uuid else (j->>'user_id')::uuid end;
  v_programa := case when TG_TABLE_NAME = 'programs' then (j->>'id')::uuid else (j->>'programa_id')::uuid end;

  v_sens := case
    when TG_OP = 'DELETE' then true
    when TG_TABLE_NAME in ('user_roles','payments','certificates','coupons') then true
    when TG_TABLE_NAME = 'profiles' and v_cambios ? 'is_active' then true
    when TG_TABLE_NAME = 'enrollments' and (v_cambios->'estado'->>'despues') in ('cancelado','suspendido') then true
    when TG_TABLE_NAME = 'assessment_submissions' and TG_OP = 'UPDATE'
         and ((v_cambios ? 'puntaje_obtenido' and o->>'puntaje_obtenido' is not null)
           or (v_cambios ? 'porcentaje' and o->>'porcentaje' is not null)) then true
    else false end;

  select * into a from public.audit_resolve_actor();
  insert into public.audit_log (actor_id, actor_nombre, actor_email, actor_rol, categoria, accion, entidad, entidad_id, entidad_etiqueta, programa_id, sujeto_id, cambios, sensible)
  values (a.actor_id, a.actor_nombre, a.actor_email, a.actor_rol, 'datos', lower(TG_OP), TG_TABLE_NAME, j->>'id', v_label, v_programa, v_sujeto, v_cambios, v_sens);
  return null;
exception when others then
  raise warning 'audit_row_change fallo en %: %', TG_TABLE_NAME, sqlerrm;
  return null;
end $$;

create trigger zz_audit_enrollments after insert or update or delete on public.enrollments for each row execute function public.audit_row_change('', 'progreso_porcentaje');
create trigger zz_audit_payments after insert or update or delete on public.payments for each row execute function public.audit_row_change();
create trigger zz_audit_certificates after insert or update or delete on public.certificates for each row execute function public.audit_row_change();
create trigger zz_audit_assessments after insert or update or delete on public.assessments for each row execute function public.audit_row_change();
create trigger zz_audit_assessment_submissions after insert or update or delete on public.assessment_submissions for each row execute function public.audit_row_change();
create trigger zz_audit_user_roles after insert or update or delete on public.user_roles for each row execute function public.audit_row_change('', 'assigned_at');
create trigger zz_audit_profiles after update or delete on public.profiles for each row execute function public.audit_row_change('nombre,apellido,telefono,is_active,especialidad');
create trigger zz_audit_programs after insert or update or delete on public.programs for each row execute function public.audit_row_change();
create trigger zz_audit_program_modules after insert or update or delete on public.program_modules for each row execute function public.audit_row_change();
create trigger zz_audit_course_modules after insert or update or delete on public.course_modules for each row execute function public.audit_row_change();
create trigger zz_audit_program_cohorts after insert or update or delete on public.program_cohorts for each row execute function public.audit_row_change();
create trigger zz_audit_cohort_enrollments after insert or update or delete on public.cohort_enrollments for each row execute function public.audit_row_change();
create trigger zz_audit_teachers after insert or update or delete on public.teachers for each row execute function public.audit_row_change();
create trigger zz_audit_program_reviews after insert or update or delete on public.program_reviews for each row execute function public.audit_row_change();
create trigger zz_audit_testimonials after insert or update or delete on public.testimonials for each row execute function public.audit_row_change();
create trigger zz_audit_announcements after insert or update or delete on public.announcements for each row execute function public.audit_row_change();
create trigger zz_audit_blog_posts after insert or update or delete on public.blog_posts for each row execute function public.audit_row_change('', 'vistas');
create trigger zz_audit_events after insert or update or delete on public.events for each row execute function public.audit_row_change();
create trigger zz_audit_hero_slides after insert or update or delete on public.hero_slides for each row execute function public.audit_row_change();
create trigger zz_audit_coupons after insert or update or delete on public.coupons for each row execute function public.audit_row_change('', 'usos_actuales');
create trigger zz_audit_zoom_licenses after insert or update or delete on public.zoom_licenses for each row execute function public.audit_row_change();
create trigger zz_audit_program_access_links after insert or update or delete on public.program_access_links for each row execute function public.audit_row_change();
create trigger zz_audit_zoom_meetings after insert or update or delete on public.zoom_meetings for each row execute function public.audit_row_change('titulo,start_at,duration_min,status,cohort_id,zoom_host_email,recording_url');
create trigger zz_audit_lesson_comments after delete on public.lesson_comments for each row execute function public.audit_row_change();
create trigger zz_audit_community_posts after delete on public.community_posts for each row execute function public.audit_row_change();

create or replace function public.audit_auth_events() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare a record; v_via text;
begin
  select * into a from public.audit_resolve_actor(NEW.id);
  if TG_OP = 'INSERT' then
    v_via := case when coalesce(NEW.raw_app_meta_data->>'must_change_password','') = 'true' then 'administrador' else 'autoregistro' end;
    insert into public.audit_log (actor_id, actor_nombre, actor_email, actor_rol, categoria, accion, entidad, entidad_id, entidad_etiqueta, sujeto_id, detalle)
    values (a.actor_id, a.actor_nombre, coalesce(a.actor_email, NEW.email::text), a.actor_rol, 'acceso', 'registro', 'usuario', NEW.id::text, coalesce(a.actor_nombre, NEW.email::text), NEW.id,
            jsonb_build_object('via', v_via, 'proveedor', NEW.raw_app_meta_data->>'provider'));
  elsif NEW.last_sign_in_at is not null and NEW.last_sign_in_at is distinct from OLD.last_sign_in_at then
    insert into public.audit_log (actor_id, actor_nombre, actor_email, actor_rol, categoria, accion, entidad, entidad_id, entidad_etiqueta, sujeto_id, detalle)
    values (a.actor_id, a.actor_nombre, coalesce(a.actor_email, NEW.email::text), a.actor_rol, 'acceso', 'login', 'usuario', NEW.id::text, coalesce(a.actor_nombre, NEW.email::text), NEW.id,
            jsonb_build_object('proveedor', NEW.raw_app_meta_data->>'provider'));
  end if;
  return null;
exception when others then
  raise warning 'audit_auth_events fallo: %', sqlerrm;
  return null;
end $$;
create trigger zz_audit_auth_events after insert or update of last_sign_in_at on auth.users for each row execute function public.audit_auth_events();
