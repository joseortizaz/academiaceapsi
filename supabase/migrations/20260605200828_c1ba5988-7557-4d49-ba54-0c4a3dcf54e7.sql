ALTER VIEW public.teachers_public SET (security_invoker = off);
GRANT SELECT ON public.teachers_public TO anon, authenticated;