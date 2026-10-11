-- Supabase Auth (GoTrue, escrito en Go) no puede leer banned_until = 'infinity'.
-- Con una sola cuenta así, auth.admin.listUsers() falla para toda la instancia
-- ("Database error finding users") y la columna Correo de Admin > Usuarios queda vacía.
-- Se usa una fecha lejana pero finita. Idempotente.

create or replace function public.profiles_apply_account_status()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.is_active is false then
    update auth.users set banned_until = '2999-12-31 23:59:59+00'::timestamptz where id = new.id;
    delete from auth.sessions where user_id = new.id;
  else
    update auth.users set banned_until = null
     where id = new.id and banned_until is not null;
  end if;
  return new;
end;
$$;
update auth.users
   set banned_until = '2999-12-31 23:59:59+00'::timestamptz
 where banned_until = 'infinity'::timestamptz;
