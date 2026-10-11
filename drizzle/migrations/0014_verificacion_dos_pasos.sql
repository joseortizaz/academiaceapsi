-- Verificación en dos pasos (TOTP nativo de Supabase Auth).
-- Obligatoria para administradores: los privilegios de administrador solo valen
-- cuando la sesión es aal2 (contraseña + código del autenticador).
-- Opcional para docentes y alumnos (no cambia sus permisos).
-- Idempotente.

-- ============================================================
-- 1. has_role: el rol admin del propio usuario exige sesión aal2
-- ============================================================
-- Solo se restringe cuando se consulta el rol admin del usuario de la sesión.
-- Llamadas del servidor con service_role, cron y triggers sin JWT
-- (auth.uid() nulo) y consultas sobre otra persona no cambian.
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.user_roles
     where user_id = _user_id
       and role = _role
  )
  and (
    _role <> 'admin'::app_role
    or auth.uid() is null
    or _user_id is distinct from auth.uid()
    or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  )
$$;

-- ============================================================
-- 2. Auditoría: activar / desactivar la verificación en dos pasos
-- ============================================================
create or replace function public.audit_mfa_events()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  a record;
  v_user uuid;
  v_accion text;
  v_email text;
  v_tipo text;
begin
  if TG_OP = 'UPDATE' then
    if NEW.status::text = 'verified' and OLD.status::text is distinct from 'verified' then
      v_user := NEW.user_id;
      v_accion := 'activar_2fa';
      v_tipo := NEW.factor_type::text;
    else
      return null;
    end if;
  elsif TG_OP = 'DELETE' then
    if OLD.status::text = 'verified' then
      v_user := OLD.user_id;
      v_accion := 'desactivar_2fa';
      v_tipo := OLD.factor_type::text;
    else
      return null;
    end if;
  else
    return null;
  end if;

  select email::text into v_email from auth.users where id = v_user;
  select * into a from public.audit_resolve_actor(coalesce(auth.uid(), v_user));

  insert into public.audit_log (actor_id, actor_nombre, actor_email, actor_rol, categoria, accion,
                                entidad, entidad_id, entidad_etiqueta, sujeto_id, detalle, sensible)
  values (a.actor_id, a.actor_nombre, coalesce(a.actor_email, v_email), a.actor_rol, 'acceso', v_accion,
          'usuario', v_user::text, coalesce(v_email, v_user::text), v_user,
          jsonb_build_object('tipo', v_tipo),
          v_accion = 'desactivar_2fa');
  return null;
exception when others then
  raise warning 'audit_mfa_events fallo: %', sqlerrm;
  return null;
end
$$;

drop trigger if exists zz_audit_mfa_events on auth.mfa_factors;
create trigger zz_audit_mfa_events
  after update or delete on auth.mfa_factors
  for each row execute function public.audit_mfa_events();
