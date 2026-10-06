-- Cuentas suspendidas y protección de columnas privilegiadas del perfil.
--
-- Antes: "Suspender usuario" (profiles.is_active = false) no bloqueaba nada, y
-- cualquier usuario podía editar en su propio perfil is_active y
-- balance_activo_customer_id (este último le permitía ver facturas ajenas).
--
-- Ahora:
--   1. Solo un administrador puede cambiar is_active y balance_activo_customer_id.
--   2. No se puede suspender a un administrador.
--   3. Al suspender: se bloquea el inicio de sesión (banned_until) y se cierran
--      sus sesiones. Al reactivar: se quita el bloqueo.
--   4. Políticas RESTRICTIVAS en las tablas de contenido: una cuenta suspendida no
--      lee ni escribe contenido aunque conserve un token vigente.
-- Escrita de forma idempotente.

-- ============================================================
-- 1. ¿La cuenta está activa? (los administradores siempre lo están)
-- ============================================================
create or replace function public.account_is_active(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is null
      or public.has_role(_user_id, 'admin'::app_role)
      or coalesce((select p.is_active from public.profiles p where p.id = _user_id), true);
$$;

revoke all on function public.account_is_active(uuid) from public;
grant execute on function public.account_is_active(uuid) to authenticated, service_role;

-- ============================================================
-- 2. Columnas privilegiadas del perfil
-- ============================================================
create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Llamadas del servidor (service_role) y de administradores pueden cambiarlas.
  if coalesce(auth.role(), '') = 'service_role'
     or auth.uid() is null
     or public.has_role(auth.uid(), 'admin'::app_role) then
    if new.is_active is false and old.is_active is distinct from false
       and public.has_role(new.id, 'admin'::app_role) then
      raise exception 'No se puede suspender a un administrador.';
    end if;
    return new;
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'Solo un administrador puede cambiar el estado de la cuenta.';
  end if;
  if new.balance_activo_customer_id is distinct from old.balance_activo_customer_id then
    raise exception 'Solo un administrador puede vincular la cuenta con facturación.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_columns();

-- ============================================================
-- 3. Suspender / reactivar el acceso en Auth
-- ============================================================
create or replace function public.profiles_apply_account_status()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.is_active is false then
    update auth.users set banned_until = 'infinity'::timestamptz where id = new.id;
    delete from auth.sessions where user_id = new.id;
  else
    update auth.users set banned_until = null
     where id = new.id and banned_until is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_apply_account_status on public.profiles;
create trigger profiles_apply_account_status
  after update of is_active on public.profiles
  for each row
  when (old.is_active is distinct from new.is_active)
  execute function public.profiles_apply_account_status();

-- ============================================================
-- 4. Políticas restrictivas en el contenido
--    (se combinan con AND con las políticas existentes)
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'announcements',
    'assessments',
    'assessment_submissions',
    'certificates',
    'community_posts',
    'course_modules',
    'lesson_comments',
    'lesson_materials',
    'module_progress',
    'program_access_links',
    'program_modules',
    'zoom_meetings'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "cuenta activa requerida" on public.%I', t);
      execute format(
        'create policy "cuenta activa requerida" on public.%I as restrictive for all to authenticated
           using (public.account_is_active()) with check (public.account_is_active())',
        t
      );
    end if;
  end loop;
end;
$$;

drop policy if exists "course-materials cuenta activa requerida" on storage.objects;
create policy "course-materials cuenta activa requerida" on storage.objects
  as restrictive for select to authenticated
  using (bucket_id <> 'course-materials' or public.account_is_active());

-- ============================================================
-- 5. Aplicar a las cuentas ya marcadas como suspendidas
-- ============================================================
update auth.users u
   set banned_until = 'infinity'::timestamptz
  from public.profiles p
 where p.id = u.id
   and p.is_active is false
   and not public.has_role(p.id, 'admin'::app_role)
   and (u.banned_until is null or u.banned_until < now());

delete from auth.sessions s
 using public.profiles p
 where p.id = s.user_id
   and p.is_active is false
   and not public.has_role(p.id, 'admin'::app_role);
