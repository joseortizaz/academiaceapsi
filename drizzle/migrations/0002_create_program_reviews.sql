create table public.program_reviews (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references public.programs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comentario text check (comentario is null or char_length(comentario) <= 1000),
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  motivo_rechazo text,
  moderado_por uuid references auth.users(id) on delete set null,
  moderado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (programa_id, user_id)
);
create index program_reviews_programa_estado_idx on public.program_reviews (programa_id, estado);
create index program_reviews_estado_idx on public.program_reviews (estado, created_at desc);

grant select on public.program_reviews to anon;
grant select, insert, update, delete on public.program_reviews to authenticated;
grant all on public.program_reviews to service_role;

alter table public.program_reviews enable row level security;

create or replace function public.can_review_program(_user_id uuid, _programa_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments e
    where e.user_id = _user_id and e.programa_id = _programa_id
      and (e.estado = 'completado' or (e.estado = 'activo' and coalesce(e.progreso_porcentaje,0) >= 35))
  );
$$;

create policy "Ver valoraciones aprobadas" on public.program_reviews
  for select to anon, authenticated using (estado = 'aprobado');
create policy "Ver mis valoraciones" on public.program_reviews
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins gestionan valoraciones" on public.program_reviews
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Alumno crea su valoracion" on public.program_reviews
  for insert to authenticated with check (
    auth.uid() = user_id and estado = 'pendiente'
    and moderado_por is null and moderado_at is null and motivo_rechazo is null
    and public.can_review_program(auth.uid(), programa_id)
  );
create policy "Alumno edita su valoracion" on public.program_reviews
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.can_review_program(auth.uid(), programa_id));
create policy "Alumno elimina su valoracion" on public.program_reviews
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.program_reviews_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if public.has_role(auth.uid(), 'admin') then
    if new.estado is distinct from old.estado then
      new.moderado_por := auth.uid();
      new.moderado_at := now();
      if new.estado <> 'rechazado' then new.motivo_rechazo := null; end if;
    end if;
  else
    new.programa_id := old.programa_id;
    new.user_id := old.user_id;
    new.estado := 'pendiente';
    new.motivo_rechazo := null;
    new.moderado_por := null;
    new.moderado_at := null;
  end if;
  return new;
end $$;
create trigger program_reviews_before_update before update on public.program_reviews
  for each row execute function public.program_reviews_before_update();

create or replace function public.notify_admins_on_pending_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_programa_titulo text;
  v_enlace text;
begin
  if new.estado <> 'pendiente' then
    return new;
  end if;
  select titulo into v_programa_titulo from public.programs where id = new.programa_id;
  v_enlace := '/admin/resenas';

  insert into public.notifications (user_id, tipo, titulo, mensaje, enlace, programa_id)
  select ur.user_id,
         'review_pending',
         'Nueva valoración pendiente',
         coalesce(v_programa_titulo, 'Un programa') || ' — ' || new.rating::text || ' estrellas',
         v_enlace,
         new.programa_id
  from public.user_roles ur
  where ur.role = 'admin';

  return new;
exception when others then
  return new;
end $$;
create trigger program_reviews_notify_admins
  after insert or update of estado on public.program_reviews
  for each row execute function public.notify_admins_on_pending_review();

create view public.program_rating_stats with (security_invoker = true) as
  select programa_id,
         round(avg(rating)::numeric, 1) as promedio,
         count(*)::int as total,
         count(*) filter (where rating = 1)::int as c1,
         count(*) filter (where rating = 2)::int as c2,
         count(*) filter (where rating = 3)::int as c3,
         count(*) filter (where rating = 4)::int as c4,
         count(*) filter (where rating = 5)::int as c5
  from public.program_reviews where estado = 'aprobado' group by programa_id;
grant select on public.program_rating_stats to anon, authenticated;

create or replace function public.get_program_reviews(_programa_id uuid, _limit int default 10, _offset int default 0)
returns table (id uuid, autor text, rating smallint, comentario text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id,
         trim(coalesce(split_part(p.nombre,' ',1),'Alumno') || ' ' || coalesce(nullif(left(p.apellido,1),'') || '.','')) as autor,
         r.rating, r.comentario, r.created_at
  from public.program_reviews r
  left join public.profiles p on p.id = r.user_id
  where r.programa_id = _programa_id and r.estado = 'aprobado'
  order by r.created_at desc
  limit least(coalesce(_limit,10), 50) offset greatest(coalesce(_offset,0),0);
$$;
grant execute on function public.get_program_reviews(uuid,int,int) to anon, authenticated;
grant execute on function public.can_review_program(uuid,uuid) to authenticated;