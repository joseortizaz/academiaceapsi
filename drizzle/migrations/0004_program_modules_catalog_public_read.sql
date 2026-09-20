alter view public.program_modules_catalog set (security_invoker = off);
revoke insert, update, delete, truncate, references, trigger on public.program_modules_catalog from anon, authenticated;
grant select on public.program_modules_catalog to anon, authenticated;