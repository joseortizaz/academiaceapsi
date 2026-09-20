create or replace function public.log_activity(
  _accion text, _entidad text default null, _entidad_id text default null,
  _etiqueta text default null, _programa_id uuid default null, _detalle jsonb default null)
returns void language plpgsql security definer set search_path = public, auth as $$
declare a record; v_window interval; v_recent int;
begin
  if auth.uid() is null then return; end if;
  if _accion not in ('ver_leccion','descargar_material','descargar_certificado','ver_grabacion','abrir_evaluacion') then return; end if;
  v_window := case _accion when 'ver_leccion' then interval '60 minutes' when 'ver_grabacion' then interval '30 minutes' else interval '10 minutes' end;
  if exists (select 1 from public.audit_log
              where actor_id = auth.uid() and categoria = 'actividad' and accion = _accion
                and entidad_id is not distinct from left(_entidad_id, 100)
                and occurred_at > now() - v_window) then return; end if;
  select count(*) into v_recent from public.audit_log
   where actor_id = auth.uid() and categoria = 'actividad' and occurred_at > now() - interval '1 hour';
  if v_recent >= 150 then return; end if;
  select * into a from public.audit_resolve_actor(auth.uid());
  insert into public.audit_log (actor_id, actor_nombre, actor_email, actor_rol, categoria, accion, entidad, entidad_id, entidad_etiqueta, programa_id, sujeto_id, detalle, sensible)
  values (a.actor_id, a.actor_nombre, a.actor_email, a.actor_rol, 'actividad', _accion, left(_entidad, 50), left(_entidad_id, 100), left(_etiqueta, 200), _programa_id, auth.uid(),
          case when _detalle is not null and pg_column_size(_detalle) <= 1024 then _detalle end, false);
exception when others then
  raise warning 'log_activity fallo: %', sqlerrm;
end $$;
revoke all on function public.log_activity(text, text, text, text, uuid, jsonb) from public, anon;
grant execute on function public.log_activity(text, text, text, text, uuid, jsonb) to authenticated;

create or replace function public.audit_activity_events() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare a record; v_uid uuid; v_prog uuid; v_label text; v_accion text; v_entidad text; v_id text;
begin
  if TG_TABLE_NAME = 'module_progress' then
    if NEW.completado is not true or (TG_OP = 'UPDATE' and OLD.completado is not distinct from NEW.completado) then return null; end if;
    select e.user_id, e.programa_id into v_uid, v_prog from public.enrollments e where e.id = NEW.enrollment_id;
    select m.titulo into v_label from public.program_modules m where m.id = NEW.modulo_id;
    v_accion := 'completar_leccion'; v_entidad := 'program_modules'; v_id := NEW.modulo_id::text;
  elsif TG_TABLE_NAME = 'lesson_comments' then
    v_uid := NEW.user_id; v_prog := NEW.programa_id;
    select m.titulo into v_label from public.program_modules m where m.id = NEW.modulo_id;
    v_accion := case when NEW.es_respuesta_docente then 'responder_comentario' else 'comentar_leccion' end;
    v_entidad := 'lesson_comments'; v_id := NEW.id::text;
  elsif TG_TABLE_NAME = 'community_posts' then
    v_uid := NEW.autor_id; v_prog := NEW.programa_id; v_label := NEW.titulo;
    v_accion := 'publicar_comunidad'; v_entidad := 'community_posts'; v_id := NEW.id::text;
  end if;
  if v_uid is null then return null; end if;
  select * into a from public.audit_resolve_actor(v_uid);
  insert into public.audit_log (actor_id, actor_nombre, actor_email, actor_rol, categoria, accion, entidad, entidad_id, entidad_etiqueta, programa_id, sujeto_id, sensible)
  values (a.actor_id, a.actor_nombre, a.actor_email, a.actor_rol, 'actividad', v_accion, v_entidad, v_id, v_label, v_prog, v_uid, false);
  return null;
exception when others then
  raise warning 'audit_activity_events fallo en %: %', TG_TABLE_NAME, sqlerrm;
  return null;
end $$;

drop trigger if exists zz_audit_activity_module_progress on public.module_progress;
create trigger zz_audit_activity_module_progress after insert or update on public.module_progress
  for each row when (NEW.completado is true) execute function public.audit_activity_events();
drop trigger if exists zz_audit_activity_lesson_comments on public.lesson_comments;
create trigger zz_audit_activity_lesson_comments after insert on public.lesson_comments
  for each row execute function public.audit_activity_events();
drop trigger if exists zz_audit_activity_community_posts on public.community_posts;
create trigger zz_audit_activity_community_posts after insert on public.community_posts
  for each row execute function public.audit_activity_events();

create or replace function public.audit_entidad_es(_e text) returns text language sql immutable as $$
  select case _e
    when 'user_roles' then 'un rol de usuario' when 'payments' then 'un pago' when 'certificates' then 'un certificado'
    when 'coupons' then 'un cupón' when 'profiles' then 'una cuenta' when 'enrollments' then 'una inscripción'
    when 'assessment_submissions' then 'una calificación' when 'programs' then 'un programa'
    when 'program_modules' then 'una lección' when 'course_modules' then 'un módulo' when 'program_cohorts' then 'un grupo'
    when 'teachers' then 'un docente' when 'zoom_meetings' then 'una clase en vivo' when 'usuario' then 'una cuenta'
    else 'un registro (' || coalesce(_e, '') || ')' end
$$;

create or replace function public.audit_notify_admins() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm record; v_verbo text; v_titulo text; v_msg text; v_enlace text; v_n int; v_titulo_masivo text;
begin
  if NEW.actor_id is null or NEW.actor_rol = 'sistema' then return null; end if;

  v_verbo := case NEW.accion when 'insert' then 'creó' when 'update' then 'modificó' when 'delete' then 'eliminó'
                             else replace(NEW.accion, '_', ' ') end;
  v_titulo := format('%s (%s) %s %s', coalesce(NEW.actor_nombre, NEW.actor_email, 'Un usuario'), NEW.actor_rol, v_verbo, public.audit_entidad_es(NEW.entidad));
  v_msg := coalesce(NEW.entidad_etiqueta, '');
  v_enlace := '/admin/auditoria?sensibles=1&usuario=' || NEW.actor_id::text;

  for adm in select ur.user_id from public.user_roles ur where ur.role = 'admin' and ur.user_id <> NEW.actor_id loop
    if not exists (select 1 from public.notifications n
                    where n.user_id = adm.user_id and n.tipo = 'audit_alert' and n.titulo = left(v_titulo, 200)
                      and n.enlace = v_enlace and n.created_at > now() - interval '15 minutes') then
      insert into public.notifications (user_id, tipo, titulo, mensaje, enlace)
      values (adm.user_id, 'audit_alert', left(v_titulo, 200), v_msg, v_enlace);
    end if;
  end loop;

  if NEW.accion = 'delete' then
    select count(*) into v_n from public.audit_log where actor_id = NEW.actor_id and accion = 'delete' and occurred_at > now() - interval '10 minutes';
    if v_n >= 5 then
      v_titulo_masivo := 'Posible eliminación masiva por ' || coalesce(NEW.actor_nombre, NEW.actor_email, 'un usuario');
      for adm in select ur.user_id from public.user_roles ur where ur.role = 'admin' and ur.user_id <> NEW.actor_id loop
        if not exists (select 1 from public.notifications n
                        where n.user_id = adm.user_id and n.tipo = 'audit_alert' and n.titulo = left(v_titulo_masivo, 200)
                          and n.created_at > now() - interval '30 minutes') then
          insert into public.notifications (user_id, tipo, titulo, mensaje, enlace)
          values (adm.user_id, 'audit_alert', left(v_titulo_masivo, 200), v_n || ' registros eliminados en los últimos 10 minutos', v_enlace);
        end if;
      end loop;
    end if;
  end if;
  return null;
exception when others then
  raise warning 'audit_notify_admins fallo: %', sqlerrm;
  return null;
end $$;

drop trigger if exists zz_audit_notify on public.audit_log;
create trigger zz_audit_notify after insert on public.audit_log
  for each row when (NEW.sensible) execute function public.audit_notify_admins();