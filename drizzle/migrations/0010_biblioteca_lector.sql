-- Biblioteca Virtual (fase 5): lector con progreso, resaltados y notas.
-- Privacidad: cada fila solo es visible y editable por su autor. Ningún otro rol,
-- tampoco el administrador, tiene política de lectura. Por eso estas tablas NO
-- llevan triggers de auditoría (copiarían el texto de las notas a audit_log).
-- Escrita de forma idempotente.

-- ============================================================
-- Progreso de lectura: una fila por usuario y documento
-- ============================================================
create table if not exists public.library_reading_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid not null references public.library_documents(id) on delete cascade,
  pagina integer not null default 1,
  total_paginas integer,
  escala text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, document_id),
  constraint library_reading_progress_pagina_check check (pagina >= 1 and pagina <= 100000),
  constraint library_reading_progress_total_check check (total_paginas is null or total_paginas between 1 and 100000),
  constraint library_reading_progress_escala_len check (escala is null or char_length(escala) <= 20)
);

create index if not exists library_reading_progress_user_idx
  on public.library_reading_progress (user_id, updated_at desc);

alter table public.library_reading_progress enable row level security;

drop policy if exists "library_reading_progress own select" on public.library_reading_progress;
create policy "library_reading_progress own select" on public.library_reading_progress
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "library_reading_progress own insert" on public.library_reading_progress;
create policy "library_reading_progress own insert" on public.library_reading_progress
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.library_catalog c where c.id = document_id)
  );

drop policy if exists "library_reading_progress own update" on public.library_reading_progress;
create policy "library_reading_progress own update" on public.library_reading_progress
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "library_reading_progress own delete" on public.library_reading_progress;
create policy "library_reading_progress own delete" on public.library_reading_progress
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.library_reading_progress from anon;
grant select, insert, update, delete on public.library_reading_progress to authenticated;

drop trigger if exists update_library_reading_progress_updated_at on public.library_reading_progress;
create trigger update_library_reading_progress_updated_at
  before update on public.library_reading_progress
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- Resaltados y notas
-- rects: posiciones en fracciones de la página (0 a 1): [{"x","y","w","h"}, ...].
-- Una nota de página sin texto seleccionado tiene rects = [].
-- ============================================================
create table if not exists public.library_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid not null references public.library_documents(id) on delete cascade,
  pagina integer not null,
  color text not null default 'amarillo',
  rects jsonb not null default '[]'::jsonb,
  texto text,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_annotations_pagina_check check (pagina between 1 and 100000),
  constraint library_annotations_color_check check (color in ('amarillo','verde','azul','rosa')),
  constraint library_annotations_rects_check check (
    jsonb_typeof(rects) = 'array' and jsonb_array_length(rects) <= 300
  ),
  constraint library_annotations_texto_len check (texto is null or char_length(texto) <= 3000),
  constraint library_annotations_nota_len check (nota is null or char_length(nota) <= 5000),
  constraint library_annotations_contenido check (
    jsonb_array_length(rects) > 0 or nullif(btrim(nota), '') is not null
  )
);

create index if not exists library_annotations_user_doc_idx
  on public.library_annotations (user_id, document_id, pagina);

alter table public.library_annotations enable row level security;

drop policy if exists "library_annotations own select" on public.library_annotations;
create policy "library_annotations own select" on public.library_annotations
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "library_annotations own insert" on public.library_annotations;
create policy "library_annotations own insert" on public.library_annotations
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.library_catalog c where c.id = document_id)
  );

drop policy if exists "library_annotations own update" on public.library_annotations;
create policy "library_annotations own update" on public.library_annotations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "library_annotations own delete" on public.library_annotations;
create policy "library_annotations own delete" on public.library_annotations
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.library_annotations from anon;
grant select, insert, update, delete on public.library_annotations to authenticated;

drop trigger if exists update_library_annotations_updated_at on public.library_annotations;
create trigger update_library_annotations_updated_at
  before update on public.library_annotations
  for each row execute function public.update_updated_at_column();

-- Impide mover una anotación a otro usuario o documento después de creada.
create or replace function public.library_annotations_lock_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.user_id is distinct from OLD.user_id or NEW.document_id is distinct from OLD.document_id then
    raise exception 'No se puede cambiar el autor ni el documento de una anotación';
  end if;
  return NEW;
end $$;

drop trigger if exists library_annotations_lock_owner on public.library_annotations;
create trigger library_annotations_lock_owner
  before update on public.library_annotations
  for each row execute function public.library_annotations_lock_owner();

drop trigger if exists library_reading_progress_lock_owner on public.library_reading_progress;
create trigger library_reading_progress_lock_owner
  before update on public.library_reading_progress
  for each row execute function public.library_annotations_lock_owner();
