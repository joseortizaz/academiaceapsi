-- Datos: separar el plan anterior (v1) y el nuevo (v2) en los 5 diplomados
-- actualizados que tienen grupos activos con el programa anterior.
-- Requiere 0019_plan_estudios_por_grupo.sql aplicada y el frontend del PR publicado.
-- Idempotente.

BEGIN;

-- 1. Módulos y grupos existentes = plan anterior (v1)
UPDATE public.course_modules
   SET plan_version = 1
 WHERE plan_version IS NULL
   AND programa_id IN (SELECT id FROM public.programs WHERE slug IN ('estimulacion-temprana-on-line', 'terapia-de-aprendizaje-on-line', 'terapia-del-lenguaje-on-line', 'intervencion-psicopedagogica-on-line', 'tecnicas-de-modificacion-conductual-on-line'));

UPDATE public.program_cohorts
   SET plan_version = 1
 WHERE plan_version IS NULL
   AND programa_id IN (SELECT id FROM public.programs WHERE slug IN ('estimulacion-temprana-on-line', 'terapia-de-aprendizaje-on-line', 'terapia-del-lenguaje-on-line', 'intervencion-psicopedagogica-on-line', 'tecnicas-de-modificacion-conductual-on-line'));

-- 2. Módulos del plan nuevo (v2), vacíos, para las próximas cohortes
INSERT INTO public.course_modules (programa_id, titulo, orden, plan_version)
SELECT p.id, v.titulo, v.orden, 2
  FROM (VALUES
  ('estimulacion-temprana-on-line', 1, 'Fundamentos de la atención temprana'),
  ('estimulacion-temprana-on-line', 2, 'Neurodesarrollo y desarrollo infantil de 0 a 6 años'),
  ('estimulacion-temprana-on-line', 3, 'Vigilancia, cribado y señales de alerta'),
  ('estimulacion-temprana-on-line', 4, 'Salud, nutrición y hábitos saludables'),
  ('estimulacion-temprana-on-line', 5, 'Familia, crianza y salud mental infantil temprana'),
  ('estimulacion-temprana-on-line', 6, 'Evaluación funcional y planificación de la intervención'),
  ('estimulacion-temprana-on-line', 7, 'Estrategias de estimulación e intervención por áreas'),
  ('estimulacion-temprana-on-line', 8, 'Necesidades específicas y trabajo interdisciplinario'),
  ('estimulacion-temprana-on-line', 9, 'Ética, marco legal y tecnología'),
  ('estimulacion-temprana-on-line', 10, 'Proyecto integrador'),
  ('terapia-de-aprendizaje-on-line', 1, 'Fundamentos: cómo se aprende a leer, escribir y calcular'),
  ('terapia-de-aprendizaje-on-line', 2, 'Trastornos y dificultades del aprendizaje'),
  ('terapia-de-aprendizaje-on-line', 3, 'Evaluación psicopedagógica y modelo multinivel'),
  ('terapia-de-aprendizaje-on-line', 4, 'Intervención en lectura'),
  ('terapia-de-aprendizaje-on-line', 5, 'Intervención en escritura'),
  ('terapia-de-aprendizaje-on-line', 6, 'Intervención en matemáticas'),
  ('terapia-de-aprendizaje-on-line', 7, 'Inclusión educativa, familia y tecnología'),
  ('terapia-de-aprendizaje-on-line', 8, 'Proyecto integrador y pasantía'),
  ('terapia-del-lenguaje-on-line', 1, 'Fundamentos de la comunicación humana: lenguaje, habla y voz'),
  ('terapia-del-lenguaje-on-line', 2, 'Desarrollo de la comunicación y detección temprana'),
  ('terapia-del-lenguaje-on-line', 3, 'Evaluación, razonamiento clínico y derivación'),
  ('terapia-del-lenguaje-on-line', 4, 'Trastornos del lenguaje en la infancia'),
  ('terapia-del-lenguaje-on-line', 5, 'Trastornos del habla'),
  ('terapia-del-lenguaje-on-line', 6, 'Trastornos de la fluidez'),
  ('terapia-del-lenguaje-on-line', 7, 'Voz infantil'),
  ('terapia-del-lenguaje-on-line', 8, 'Audición, CAA, tecnología y proyecto integrador'),
  ('intervencion-psicopedagogica-on-line', 1, 'El servicio psicopedagógico: rol, normativa y gestión'),
  ('intervencion-psicopedagogica-on-line', 2, 'Sistemas de apoyo por niveles y decisiones basadas en datos'),
  ('intervencion-psicopedagogica-on-line', 3, 'Evaluación psicopedagógica'),
  ('intervencion-psicopedagogica-on-line', 4, 'Educación inclusiva y Diseño Universal para el Aprendizaje'),
  ('intervencion-psicopedagogica-on-line', 5, 'Intervención psicopedagógica y apoyo conductual'),
  ('intervencion-psicopedagogica-on-line', 6, 'Ciencia del aprendizaje y neuroeducación basada en evidencia'),
  ('intervencion-psicopedagogica-on-line', 7, 'Orientación, convivencia y proyecto integrador'),
  ('tecnicas-de-modificacion-conductual-on-line', 1, 'Fundamentos del análisis de la conducta'),
  ('tecnicas-de-modificacion-conductual-on-line', 2, 'Contexto, ética y marco legal'),
  ('tecnicas-de-modificacion-conductual-on-line', 3, 'Medición, registro y diseños de caso único'),
  ('tecnicas-de-modificacion-conductual-on-line', 4, 'Evaluación funcional'),
  ('tecnicas-de-modificacion-conductual-on-line', 5, 'Procedimientos para enseñar y aumentar conductas'),
  ('tecnicas-de-modificacion-conductual-on-line', 6, 'Procedimientos para reducir conductas y plan de apoyo conductual'),
  ('tecnicas-de-modificacion-conductual-on-line', 7, 'Aplicaciones a lo largo del ciclo vital'),
  ('tecnicas-de-modificacion-conductual-on-line', 8, 'Entrenamiento a padres, docentes y cuidadores y proyecto integrador')
  ) AS v(slug, orden, titulo)
  JOIN public.programs p ON p.slug = v.slug
 WHERE NOT EXISTS (
   SELECT 1 FROM public.course_modules cm
    WHERE cm.programa_id = p.id AND cm.titulo = v.titulo AND cm.plan_version = 2
 );

COMMIT;

-- Las cohortes nuevas de estos programas se crean con «Plan v2» en Admin › Grupos.
