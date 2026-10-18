CREATE OR REPLACE FUNCTION public.get_latest_public_reviews(_limit integer DEFAULT 6)
RETURNS TABLE(id uuid, autor text, pais text, rating smallint, comentario text, created_at timestamptz, programa_titulo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select r.id,
         trim(coalesce(split_part(p.nombre,' ',1),'Alumno') || ' ' || coalesce(nullif(left(p.apellido,1),'') || '.','')) as autor,
         nullif(trim(p.pais),'') as pais,
         r.rating, r.comentario, r.created_at, pr.titulo
  from public.program_reviews r
  join public.programs pr on pr.id = r.programa_id
  left join public.profiles p on p.id = r.user_id
  where r.estado = 'aprobado'
  order by r.created_at desc
  limit least(greatest(coalesce(_limit,6),1), 12);
$$;
REVOKE ALL ON FUNCTION public.get_latest_public_reviews(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_latest_public_reviews(integer) TO anon, authenticated;