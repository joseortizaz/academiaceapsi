ALTER VIEW public.teachers_public SET (security_invoker = on);

GRANT SELECT ON public.teachers TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view visible teachers" ON public.teachers;
CREATE POLICY "Public can view visible teachers"
ON public.teachers FOR SELECT
TO anon, authenticated
USING (visible = true);