-- ============================================================
-- FIXES DE SEGURIDAD v2 — PASO 2
-- ============================================================

-- 1. ARREGLAR TEACHERS: quitar policies existentes y recrear
DROP POLICY IF EXISTS "Ver docentes" ON public.teachers;
DROP POLICY IF EXISTS "Anon ve docentes públicos" ON public.teachers;
DROP POLICY IF EXISTS "Auth ve docentes" ON public.teachers;
DROP POLICY IF EXISTS "Admins gestionan docentes" ON public.teachers;

CREATE POLICY "Anon ve docentes públicos" 
ON public.teachers FOR SELECT
TO anon
USING (visible = true);

CREATE POLICY "Auth ve docentes" 
ON public.teachers FOR SELECT
TO authenticated
USING (visible = true);

CREATE POLICY "Admins gestionan docentes"
ON public.teachers FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. ARREGLAR PROFILES
DROP POLICY IF EXISTS "Cualquiera puede ver perfiles públicos" ON public.profiles;
DROP POLICY IF EXISTS "Ver perfil propio" ON public.profiles;
DROP POLICY IF EXISTS "Ver otros perfiles" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios pueden editar su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins pueden gestionar todos los perfiles" ON public.profiles;

CREATE POLICY "Ver perfil propio"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Ver otros perfiles"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() != id);

CREATE POLICY "Usuarios pueden editar su propio perfil"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins pueden gestionar todos los perfiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. ARREGLAR PAYMENTS
DROP POLICY IF EXISTS "Insertar pagos propios" ON public.payments;
CREATE POLICY "Insertar pagos propios"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. TABLA PARA LINKS SENSIBLES
DROP TABLE IF EXISTS public.program_access_links;

CREATE TABLE public.program_access_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programa_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    modulo_id UUID REFERENCES public.program_modules(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('zoom', 'material', 'grabacion')),
    url TEXT NOT NULL,
    meeting_id TEXT,
    password TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.program_access_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver links si está inscrito" ON public.program_access_links;
DROP POLICY IF EXISTS "Admins gestionan links" ON public.program_access_links;

CREATE POLICY "Ver links si está inscrito"
ON public.program_access_links FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.user_id = auth.uid()
        AND e.programa_id = program_access_links.programa_id
        AND e.estado IN ('activo', 'completado')
    )
);

CREATE POLICY "Admins gestionan links"
ON public.program_access_links FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5. REMOVER zoom_link de programs y modules
ALTER TABLE public.programs DROP COLUMN IF EXISTS zoom_link;
ALTER TABLE public.programs DROP COLUMN IF EXISTS zoom_meeting_id;
ALTER TABLE public.program_modules DROP COLUMN IF EXISTS zoom_link;

-- 6. CORREGIR ENROLLMENTS
DROP POLICY IF EXISTS "Crear inscripción propia" ON public.enrollments;
DROP POLICY IF EXISTS "Actualizar propias inscripciones" ON public.enrollments;

CREATE POLICY "Crear inscripción propia"
ON public.enrollments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Actualizar propias inscripciones"
ON public.enrollments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);