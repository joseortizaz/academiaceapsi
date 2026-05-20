-- ============================================================
-- ACADEMIA CEAPSI RD — MODELO DE DATOS LMS (PASO 2)
-- ============================================================

-- 1. ENUM DE ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'docente', 'estudiante');

-- 2. TABLA DE PERFILES
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    telefono TEXT,
    avatar_url TEXT,
    pais TEXT DEFAULT 'República Dominicana',
    ciudad TEXT,
    bio TEXT,
    especialidad TEXT,
    linkedin_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. TABLA DE ROLES DE USUARIO (RBAC)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES auth.users(id),
    UNIQUE (user_id, role)
);

-- 4. FUNCIÓN has_role (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. TABLA DE DOCENTES
CREATE TABLE public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT,
    titulo TEXT,
    especialidad TEXT,
    biografia TEXT,
    avatar_url TEXT,
    linkedin_url TEXT,
    visible BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. TABLA DE CATEGORÍAS
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    icono TEXT,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. TABLA DE PROGRAMAS (Diplomados y Cursos)
CREATE TABLE public.programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    descripcion TEXT NOT NULL,
    resumen TEXT,
    tipo TEXT NOT NULL CHECK (tipo IN ('diplomado', 'curso')),
    modalidad TEXT NOT NULL CHECK (modalidad IN ('sincrono', 'asincrono', 'mixto')),
    categoria_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    docente_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
    precio NUMERIC(10,2) NOT NULL DEFAULT 0,
    precio_descuento NUMERIC(10,2),
    duracion_horas INTEGER,
    duracion_semanas INTEGER,
    fecha_inicio DATE,
    fecha_fin DATE,
    horario TEXT,
    zoom_link TEXT,
    zoom_meeting_id TEXT,
    max_estudiantes INTEGER,
    min_estudiantes INTEGER DEFAULT 1,
    imagen_url TEXT,
    video_intro_url TEXT,
    syllabus_url TEXT,
    certificado_incluido BOOLEAN DEFAULT true,
    estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicado', 'en_curso', 'finalizado', 'archivado')),
    destacado BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. TABLA DE MÓDULOS
CREATE TABLE public.program_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programa_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    orden INTEGER NOT NULL DEFAULT 0,
    duracion_minutos INTEGER,
    video_url TEXT,
    material_url TEXT,
    zoom_link TEXT,
    fecha_sesion TIMESTAMP WITH TIME ZONE,
    es_en_vivo BOOLEAN DEFAULT false,
    docente_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. TABLA DE INSCRIPCIONES
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    programa_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'activo', 'completado', 'cancelado', 'suspendido')),
    progreso_porcentaje INTEGER NOT NULL DEFAULT 0 CHECK (progreso_porcentaje BETWEEN 0 AND 100),
    fecha_inscripcion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    fecha_completado TIMESTAMP WITH TIME ZONE,
    fecha_vencimiento TIMESTAMP WITH TIME ZONE,
    pago_id UUID,
    notas TEXT,
    UNIQUE (user_id, programa_id)
);

-- 10. TABLA DE PROGRESO POR MÓDULO
CREATE TABLE public.module_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    modulo_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
    completado BOOLEAN DEFAULT false,
    fecha_completado TIMESTAMP WITH TIME ZONE,
    tiempo_visto_segundos INTEGER DEFAULT 0,
    notas_estudiante TEXT,
    UNIQUE (enrollment_id, modulo_id)
);

-- 11. TABLA DE CERTIFICADOS
CREATE TABLE public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    programa_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
    numero_certificado TEXT NOT NULL UNIQUE,
    fecha_emision TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    fecha_expiracion TIMESTAMP WITH TIME ZONE,
    url_pdf TEXT,
    estado TEXT NOT NULL DEFAULT 'emitido' CHECK (estado IN ('emitido', 'revocado')),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 12. TABLA DE PAGOS
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    programa_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    monto NUMERIC(10,2) NOT NULL,
    moneda TEXT NOT NULL DEFAULT 'DOP',
    metodo TEXT NOT NULL CHECK (metodo IN ('transferencia', 'tarjeta', 'efectivo', 'paypal', 'stripe', 'otro')),
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completado', 'fallido', 'reembolsado')),
    referencia TEXT,
    comprobante_url TEXT,
    notas TEXT,
    procesado_por UUID REFERENCES auth.users(id),
    fecha_pago TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 13. TABLA DE ANUNCIOS
CREATE TABLE public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'general' CHECK (tipo IN ('general', 'programa', 'sistema')),
    programa_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
    autor_id UUID NOT NULL REFERENCES auth.users(id),
    fecha_publicacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    fecha_expiracion TIMESTAMP WITH TIME ZONE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 14. TABLA DE ARTÍCULOS DEL BLOG
CREATE TABLE public.blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    resumen TEXT,
    contenido TEXT NOT NULL,
    imagen_url TEXT,
    categoria_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    autor_id UUID NOT NULL REFERENCES auth.users(id),
    estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicado', 'archivado')),
    fecha_publicacion TIMESTAMP WITH TIME ZONE,
    destacado BOOLEAN DEFAULT false,
    tags TEXT[],
    vistas INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 15. TABLA DE TESTIMONIOS
CREATE TABLE public.testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    ocupacion TEXT,
    contenido TEXT NOT NULL,
    imagen_url TEXT,
    programa_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
    calificacion INTEGER CHECK (calificacion BETWEEN 1 AND 5),
    aprobado BOOLEAN DEFAULT false,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 16. TABLA DE MENSAJES DE CONTACTO
CREATE TABLE public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT,
    asunto TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    leido BOOLEAN DEFAULT false,
    respondido BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS (ROW LEVEL SECURITY)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Cualquiera puede ver perfiles públicos"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuarios pueden editar su propio perfil"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins pueden gestionar todos los perfiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- USER_ROLES
CREATE POLICY "Ver roles propios"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins pueden gestionar roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- TEACHERS (público para leer, admin para escribir)
CREATE POLICY "Ver docentes"
ON public.teachers FOR SELECT
TO anon, authenticated
USING (visible = true);

CREATE POLICY "Admins gestionan docentes"
ON public.teachers FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- CATEGORIES
CREATE POLICY "Ver categorías"
ON public.categories FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins gestionan categorías"
ON public.categories FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- PROGRAMS
CREATE POLICY "Ver programas publicados"
ON public.programs FOR SELECT
TO anon, authenticated
USING (estado = 'publicado' OR estado = 'en_curso' OR estado = 'finalizado');

CREATE POLICY "Admins y docentes ven todos"
ON public.programs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'docente'));

CREATE POLICY "Admins gestionan programas"
ON public.programs FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- PROGRAM_MODULES
CREATE POLICY "Ver módulos de programas publicados"
ON public.program_modules FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.programs p
        WHERE p.id = programa_id
        AND p.estado IN ('publicado', 'en_curso', 'finalizado')
    )
);

CREATE POLICY "Admins gestionan módulos"
ON public.program_modules FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ENROLLMENTS
CREATE POLICY "Ver propias inscripciones"
ON public.enrollments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins ven todas las inscripciones"
ON public.enrollments FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Crear inscripción propia"
ON public.enrollments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Actualizar propias inscripciones"
ON public.enrollments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins gestionan inscripciones"
ON public.enrollments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- MODULE_PROGRESS
CREATE POLICY "Ver progreso propio"
ON public.module_progress FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.id = enrollment_id AND e.user_id = auth.uid()
    )
);

CREATE POLICY "Admins ven todo progreso"
ON public.module_progress FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Actualizar progreso propio"
ON public.module_progress FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.id = enrollment_id AND e.user_id = auth.uid()
    )
);

CREATE POLICY "Insertar progreso propio"
ON public.module_progress FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.id = enrollment_id AND e.user_id = auth.uid()
    )
);

-- CERTIFICATES
CREATE POLICY "Ver certificados propios"
ON public.certificates FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins gestionan certificados"
ON public.certificates FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- PAYMENTS
CREATE POLICY "Ver pagos propios"
ON public.payments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins gestionan pagos"
ON public.payments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ANNOUNCEMENTS
CREATE POLICY "Ver anuncios activos"
ON public.announcements FOR SELECT
TO anon, authenticated
USING (activo = true AND (fecha_expiracion IS NULL OR fecha_expiracion > now()));

CREATE POLICY "Admins gestionan anuncios"
ON public.announcements FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- BLOG_POSTS
CREATE POLICY "Ver artículos publicados"
ON public.blog_posts FOR SELECT
TO anon, authenticated
USING (estado = 'publicado');

CREATE POLICY "Autores ven sus borradores"
ON public.blog_posts FOR SELECT
TO authenticated
USING (autor_id = auth.uid());

CREATE POLICY "Autores editan sus artículos"
ON public.blog_posts FOR UPDATE
TO authenticated
USING (autor_id = auth.uid());

CREATE POLICY "Admins gestionan blog"
ON public.blog_posts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- TESTIMONIALS
CREATE POLICY "Ver testimonios aprobados"
ON public.testimonials FOR SELECT
TO anon, authenticated
USING (aprobado = true);

CREATE POLICY "Admins gestionan testimonios"
ON public.testimonials FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- CONTACT_MESSAGES
CREATE POLICY "Admins leen mensajes"
ON public.contact_messages FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Cualquiera puede enviar mensajes"
ON public.contact_messages FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at
    BEFORE UPDATE ON public.teachers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_programs_updated_at
    BEFORE UPDATE ON public.programs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_program_modules_updated_at
    BEFORE UPDATE ON public.program_modules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON public.announcements
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blog_posts_updated_at
    BEFORE UPDATE ON public.blog_posts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role public.app_role;
BEGIN
    -- Extraer nombre del metadata de raw_user_meta_data si existe
    INSERT INTO public.profiles (
        id,
        nombre,
        apellido,
        telefono,
        avatar_url
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
        NEW.raw_user_meta_data->>'telefono',
        NEW.raw_user_meta_data->>'avatar_url'
    );

    -- Asignar rol por defecto: estudiante
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'estudiante');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para generar número de certificado
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_certificado IS NULL THEN
        NEW.numero_certificado := 'CEAPSI-' || to_char(NEW.fecha_emision, 'YYYY') || '-' || substr(NEW.id::text, 1, 8);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER before_certificate_insert
    BEFORE INSERT ON public.certificates
    FOR EACH ROW EXECUTE FUNCTION public.generate_certificate_number();

-- Insertar categorías por defecto
INSERT INTO public.categories (nombre, slug, descripcion, orden) VALUES
    ('Psicología Clínica', 'psicologia-clinica', 'Diplomados y cursos en psicología clínica y terapia', 1),
    ('Educación', 'educacion', 'Formación docente y pedagogía', 2),
    ('Ciencias del Comportamiento', 'ciencias-del-comportamiento', 'Neurociencia, conducta y análisis aplicado', 3),
    ('Desarrollo Profesional', 'desarrollo-profesional', 'Habilidades blandas y crecimiento personal', 4)
ON CONFLICT (slug) DO NOTHING;

-- Insertar docentes de ejemplo
INSERT INTO public.teachers (nombre, apellido, email, titulo, especialidad, biografia, visible, orden) VALUES
    ('Dra. María Elena', 'Santos', 'maria.santos@ceapsi.edu.do', 'Doctora en Psicología Clínica', 'Terapia Cognitivo-Conductual', 'Especialista en intervenciones psicológicas con más de 15 años de experiencia clínica en República Dominicana.', true, 1),
    ('Dr. Carlos', 'Méndez', 'carlos.mendez@ceapsi.edu.do', 'Doctor en Neurociencias', 'Neuropsicología', 'Investigador y docente con publicaciones en revistas internacionales sobre neuroplasticidad y rehabilitación.', true, 2),
    ('Lic. Ana', 'Fernández', 'ana.fernandez@ceapsi.edu.do', 'Licenciada en Psicología Educativa', 'Psicología Infantil', 'Experta en evaluación y desarrollo infantil, con enfoque en autismo y TDAH.', true, 3)
ON CONFLICT DO NOTHING;

-- Insertar testimonios de ejemplo
INSERT INTO public.testimonials (nombre, ocupacion, contenido, calificacion, aprobado, orden) VALUES
    ('Laura Gómez', 'Psicóloga', 'El diplomado de Psicología Clínica transformó mi práctica profesional. Los docentes son excepcionales.', 5, true, 1),
    ('Pedro Jiménez', 'Docente', 'Excelente plataforma, muy profesional y con contenido de alta calidad.', 5, true, 2),
    ('Carmen Reyes', 'Estudiante de Maestría', 'Los cursos en vivo por Zoom son muy dinámicos. Aprendí muchísimo.', 5, true, 3)
ON CONFLICT DO NOTHING;