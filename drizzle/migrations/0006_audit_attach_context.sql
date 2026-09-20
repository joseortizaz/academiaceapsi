create or replace function public.audit_attach_context(_user_id uuid, _ip text, _ua text)
returns void language sql security definer set search_path = public as $$
  update public.audit_log
     set ip = left(_ip, 64), user_agent = left(_ua, 300)
   where id = (
     select id from public.audit_log
      where actor_id = _user_id and categoria = 'acceso' and accion = 'login'
        and ip is null and occurred_at > now() - interval '10 minutes'
      order by id desc limit 1);
$$;
revoke all on function public.audit_attach_context(uuid, text, text) from public, anon, authenticated;
grant execute on function public.audit_attach_context(uuid, text, text) to service_role;