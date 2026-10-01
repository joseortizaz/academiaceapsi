-- Biblioteca Virtual (fase 1): tablas, vista pública, RLS, buckets de Storage,
-- auditoría, contador de descargas y lista blanca de log_activity.
-- Escrita de forma idempotente: se puede ejecutar más de una vez sin error.

-- ============================================================
-- Categorías
-- ============================================================
create table if not exists public.library_categories (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_categories_nombre_key unique (nombre),
  constraint library_categories_slug_key unique (slug),
  constraint library_categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

alter table public.library_categories enable row level security;

drop policy if exists "library_categories public read" on public.library_categories;
create policy "library_categories public read" on public.library_categories
  for select to anon, authenticated using (true);

drop policy if exists "library_categories admin write" on public.library_categories;
create policy "library_categories admin write" on public.library_categories
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

revoke all on public.library_categories from anon;
grant select on public.library_categories to anon;
grant select, insert, update, delete on public.library_categories to authenticated;

-- ============================================================
-- Documentos
-- ============================================================
create table if not exists public.library_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  titulo text not null,
  autores text,
  descripcion text,
  categoria_id uuid references public.library_categories(id) on delete set null,
  etiquetas text[] not null default '{}',
  anio integer,
  idioma text not null default 'es',
  paginas integer,
  tamano_bytes bigint,
  portada_url text,
  file_path text,
  licencia text,
  estado text not null default 'borrador',
  destacado boolean not null default false,
  descargas integer not null default 0,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_documents_slug_key unique (slug),
  constraint library_documents_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint library_documents_estado_check check (estado in ('borrador','publicado','oculto')),
  constraint library_documents_titulo_len check (char_length(btrim(titulo)) between 1 and 300),
  constraint library_documents_descripcion_len check (descripcion is null or char_length(descripcion) <= 5000),
  constraint library_documents_anio_check check (anio is null or anio between 1500 and 2100),
  constraint library_documents_paginas_check check (paginas is null or paginas > 0),
  constraint library_documents_descargas_check check (descargas >= 0),
  -- Solo se puede publicar si hay PDF y licencia declarada.
  constraint library_documents_publicable check (
    estado <> 'publicado' or (file_path is not null and nullif(btrim(licencia), '') is not null)
  )
);

create index if not exists library_documents_estado_idx on public.library_documents (estado, published_at desc);
create index if not exists library_documents_categoria_idx on public.library_documents (categoria_id);
create index if not exists library_documents_etiquetas_idx on public.library_documents using gin (etiquetas);

alter table public.library_documents enable row level security;

-- Solo el admin lee o escribe la tabla. El público usa la vista library_catalog,
-- que no expone file_path ni created_by.
drop policy if exists "library_documents admin all" on public.library_documents;
create policy "library_documents admin all" on public.library_documents
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

revoke all on public.library_documents from anon;
grant select, insert, update, delete on public.library_documents to authenticated;

-- published_at automático y slug fijo una vez publicado.
create or replace function public.library_documents_before_write()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.estado = 'publicado' and (TG_OP = 'INSERT' or OLD.estado is distinct from 'publicado') and NEW.published_at is null then
    NEW.published_at := now();
  end if;
  if TG_OP = 'UPDATE' and OLD.published_at is not null and NEW.slug is distinct from OLD.slug then
    raise exception 'El enlace (slug) no se puede cambiar después de publicar el documento';
  end if;
  NEW.updated_at := now();
  return NEW;
end $$;

drop trigger if exists library_documents_before_write on public.library_documents;
create trigger library_documents_before_write
  before insert or update on public.library_documents
  for each row execute function public.library_documents_before_write();

drop trigger if exists update_library_categories_updated_at on public.library_categories;
create trigger update_library_categories_updated_at
  before update on public.library_categories
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- Vista pública del catálogo (sin file_path ni created_by)
-- ============================================================
create or replace view public.library_catalog as
select d.id, d.slug, d.titulo, d.autores, d.descripcion,
       d.categoria_id, c.nombre as categoria_nombre, c.slug as categoria_slug,
       d.etiquetas, d.anio, d.idioma, d.paginas, d.tamano_bytes,
       d.portada_url, d.licencia, d.destacado, d.descargas,
       d.published_at, d.updated_at
from public.library_documents d
left join public.library_categories c on c.id = d.categoria_id
where d.estado = 'publicado';

alter view public.library_catalog set (security_invoker = off);
revoke all on public.library_catalog from anon, authenticated;
grant select on public.library_catalog to anon, authenticated;

-- ============================================================
-- Contador de descargas (solo lo llama el servidor con service role)
-- ============================================================
create or replace function public.library_increment_downloads(_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.library_documents set descargas = descargas + 1
  where id = _id and estado = 'publicado';
$$;

revoke all on function public.library_increment_downloads(uuid) from public, anon, authenticated;
grant execute on function public.library_increment_downloads(uuid) to service_role;

-- ============================================================
-- Storage: PDF privados y portadas públicas
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-files', 'library-files', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = array['application/pdf'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-covers', 'library-covers', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- library-files: solo el admin sube, ve, cambia o borra. Los usuarios descargan
-- mediante un enlace firmado que genera el servidor.
drop policy if exists "library-files admin read" on storage.objects;
create policy "library-files admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'library-files' and public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "library-files admin insert" on storage.objects;
create policy "library-files admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'library-files' and public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "library-files admin update" on storage.objects;
create policy "library-files admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'library-files' and public.has_role(auth.uid(), 'admin'::app_role))
  with check (bucket_id = 'library-files' and public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "library-files admin delete" on storage.objects;
create policy "library-files admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'library-files' and public.has_role(auth.uid(), 'admin'::app_role));

-- library-covers: lectura pública, escritura solo admin.
drop policy if exists "library-covers public read" on storage.objects;
create policy "library-covers public read" on storage.objects
  for select to public
  using (bucket_id = 'library-covers');

drop policy if exists "library-covers admin insert" on storage.objects;
create policy "library-covers admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'library-covers' and public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "library-covers admin update" on storage.objects;
create policy "library-covers admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'library-covers' and public.has_role(auth.uid(), 'admin'::app_role))
  with check (bucket_id = 'library-covers' and public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "library-covers admin delete" on storage.objects;
create policy "library-covers admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'library-covers' and public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- Auditoría
-- ============================================================
drop trigger if exists zz_audit_library_categories on public.library_categories;
create trigger zz_audit_library_categories
  after insert or update or delete on public.library_categories
  for each row execute function public.audit_row_change();

drop trigger if exists zz_audit_library_documents on public.library_documents;
create trigger zz_audit_library_documents
  after insert or update or delete on public.library_documents
  for each row execute function public.audit_row_change('', 'descargas');

-- log_activity: misma función que en 0007, añadiendo ver_libro y descargar_libro.
create or replace function public.log_activity(
  _accion text, _entidad text default null, _entidad_id text default null,
  _etiqueta text default null, _programa_id uuid default null, _detalle jsonb default null)
returns void language plpgsql security definer set search_path = public, auth as $$
declare a record; v_window interval; v_recent int;
begin
  if auth.uid() is null then return; end if;
  if _accion not in ('ver_leccion','descargar_material','descargar_certificado','ver_grabacion','abrir_evaluacion',
                     'ver_libro','descargar_libro') then return; end if;
  v_window := case _accion when 'ver_leccion' then interval '60 minutes' when 'ver_grabacion' then interval '30 minutes'
                           when 'ver_libro' then interval '60 minutes' else interval '10 minutes' end;
  if exists (select 1 from public.audit_log
              where actor_id = auth.uid() and categoria = 'actividad' and accion = _accion
                and entidad_id is not distinct from left(_entidad_id, 100)
                and occurred_at > now() - v_window) then return; end if;
  select count(*) into v_recent from public.audit_log
   where actor_id = auth.uid() and categoria = 'actividad' and occurred_at > now() - interval '1 hour';
  if v_recent >= 150 then return; end if;
  select * into a from public.audit_resolve_actor(auth.uid());
  insert into public.audit_log (actor_id, actor_nombre, actor_email, actor_rol, categoria, accion, entidad, entidad_id, entidad_etiqueta, programa_id, sujeto_id, detalle, sensible)
  values (a.actor_id, a.actor_nombre, a.actor_email, a.actor_rol, 'actividad', _accion, left(_entidad, 50), left(_entidad_id, 100), left(_etiqueta, 200), _programa_id, auth.uid(),
          case when _detalle is not null and pg_column_size(_detalle) <= 1024 then _detalle end, false);
exception when others then
  raise warning 'log_activity fallo: %', sqlerrm;
end $$;
revoke all on function public.log_activity(text, text, text, text, uuid, jsonb) from public, anon;
grant execute on function public.log_activity(text, text, text, text, uuid, jsonb) to authenticated;
