-- Mora: avisos de pago y restricción de contenidos a alumnos morosos.
--
-- Reglas (dirección de Ceapsi, 2026-10-06):
--   * Las cuotas vienen de Balance Activo (external_invoices.raw->'cuotas'), cada una
--     con su fecha de vencimiento, monto, pagado y saldo.
--   * Recordatorio previo 5 días antes de cada vencimiento (el 25 para las del 30).
--   * 5 días de gracia. Avisos a los 4, 10 y 25 días del vencimiento de la cuota
--     impaga más antigua.
--   * Restricción con dos cuotas vencidas sin cubrir, o 30 días o más de atraso.
--     Se levanta en cuanto deja de cumplirse (al pagar la cuota más antigua).
--   * Un acuerdo de pago vigente pausa avisos y restricción.
--   * Sin datos de Balance Activo de las últimas 24 h no se avisa ni se restringe.
--   * Avisos y restricción se encienden con interruptores (apagados por defecto:
--     modo simulación).
-- Escrita de forma idempotente.

-- ============================================================
-- Fecha de hoy en República Dominicana
-- ============================================================
create or replace function public.mora_hoy()
returns date
language sql
stable
as $$ select (now() at time zone 'America/Santo_Domingo')::date $$;

-- ============================================================
-- 1. Configuración (una sola fila)
-- ============================================================
create table if not exists public.mora_config (
  id boolean primary key default true,
  avisos_activos boolean not null default false,
  restriccion_activa boolean not null default false,
  contacto_direccion text not null default 'admin@ceapsird.com',
  medios_pago text,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  constraint mora_config_singleton check (id),
  constraint mora_config_contacto_len check (char_length(contacto_direccion) <= 200),
  constraint mora_config_medios_len check (medios_pago is null or char_length(medios_pago) <= 1000)
);

insert into public.mora_config (id) values (true) on conflict (id) do nothing;

alter table public.mora_config enable row level security;

drop policy if exists "mora_config lectura" on public.mora_config;
create policy "mora_config lectura" on public.mora_config
  for select to authenticated using (true);

drop policy if exists "mora_config admin actualiza" on public.mora_config;
create policy "mora_config admin actualiza" on public.mora_config
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

drop trigger if exists update_mora_config_updated_at on public.mora_config;
create trigger update_mora_config_updated_at
  before update on public.mora_config
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- 2. Acuerdos de pago
-- ============================================================
create table if not exists public.mora_acuerdos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  desde date not null default public.mora_hoy(),
  hasta date not null,
  nota text,
  creado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  cerrado_at timestamptz,
  cerrado_por uuid,
  constraint mora_acuerdos_fechas check (hasta >= desde),
  constraint mora_acuerdos_nota_len check (nota is null or char_length(nota) <= 2000)
);

create index if not exists mora_acuerdos_user_idx on public.mora_acuerdos (user_id, hasta desc);

alter table public.mora_acuerdos enable row level security;

drop policy if exists "mora_acuerdos admin" on public.mora_acuerdos;
create policy "mora_acuerdos admin" on public.mora_acuerdos
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 3. Estado de mora por alumno (lo escribe solo mora_evaluar)
-- ============================================================
create table if not exists public.mora_estado (
  user_id uuid primary key references auth.users(id) on delete cascade,
  etapa text not null default 'al_dia',
  dias_mora integer not null default 0,
  cuotas_vencidas integer not null default 0,
  monto_vencido numeric(14,2) not null default 0,
  cuota_antigua_ref text,
  cuota_antigua_venc date,
  cuota_antigua_saldo numeric(14,2),
  proxima_ref text,
  proxima_venc date,
  proxima_saldo numeric(14,2),
  deberia_restringir boolean not null default false,
  restringido boolean not null default false,
  restringido_desde timestamptz,
  acuerdo_id uuid references public.mora_acuerdos(id) on delete set null,
  datos_sync_at timestamptz,
  datos_frescos boolean not null default false,
  aviso_hoy text,
  aviso_ref text,
  previo_ref text,
  evaluado_at timestamptz not null default now(),
  constraint mora_estado_etapa_check check (
    etapa in ('al_dia', 'gracia', 'mora', 'por_restringir', 'restringido', 'acuerdo')
  )
);

create index if not exists mora_estado_restringido_idx on public.mora_estado (user_id) where restringido;

alter table public.mora_estado enable row level security;

drop policy if exists "mora_estado propio" on public.mora_estado;
create policy "mora_estado propio" on public.mora_estado
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "mora_estado admin" on public.mora_estado;
create policy "mora_estado admin" on public.mora_estado
  for select to authenticated using (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 4. Registro de avisos enviados (uno por alumno, tipo y cuota)
-- ============================================================
create table if not exists public.mora_avisos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  ref text not null,
  fecha date not null default public.mora_hoy(),
  canales text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint mora_avisos_tipo_check check (tipo in ('previo', 'aviso1', 'aviso2', 'aviso3', 'aviso4')),
  constraint mora_avisos_unico unique (user_id, tipo, ref)
);

create index if not exists mora_avisos_user_idx on public.mora_avisos (user_id, created_at desc);

alter table public.mora_avisos enable row level security;

drop policy if exists "mora_avisos admin" on public.mora_avisos;
create policy "mora_avisos admin" on public.mora_avisos
  for select to authenticated using (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 5. Auditoría (solo cambios con sentido: acuerdos, configuración, restricción)
-- ============================================================
drop trigger if exists zz_audit_mora_acuerdos on public.mora_acuerdos;
create trigger zz_audit_mora_acuerdos
  after insert or update or delete on public.mora_acuerdos
  for each row execute function public.audit_row_change();

drop trigger if exists zz_audit_mora_config on public.mora_config;
create trigger zz_audit_mora_config
  after update on public.mora_config
  for each row execute function public.audit_row_change('avisos_activos,restriccion_activa,contacto_direccion,medios_pago');

drop trigger if exists zz_audit_mora_estado on public.mora_estado;
create trigger zz_audit_mora_estado
  after update on public.mora_estado
  for each row execute function public.audit_row_change('restringido');

-- ============================================================
-- 6. Evaluación
-- ============================================================
create or replace function public.mora_evaluar(_user uuid default null, _hoy date default null)
returns setof public.mora_estado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy date := coalesce(_hoy, public.mora_hoy());
  v_cfg public.mora_config;
begin
  select * into v_cfg from public.mora_config where id;

  return query
  with cuotas as (
    select
      i.user_id,
      c.value->>'id' as ref,
      coalesce((c.value->>'numero')::int, 0) as numero,
      (c.value->>'fecha_vencimiento')::date as venc,
      greatest(
        coalesce(
          (c.value->>'saldo')::numeric,
          (c.value->>'monto')::numeric - coalesce((c.value->>'monto_pagado')::numeric, 0)
        ),
        0
      ) as saldo
    from public.external_invoices i
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(i.raw->'cuotas') = 'array' then i.raw->'cuotas' else '[]'::jsonb end
    ) c
    where i.user_id is not null
      and coalesce(i.estado, '') not in ('anulada', 'pagada')
      and (_user is null or i.user_id = _user)
      and c.value->>'fecha_vencimiento' is not null
  ),
  impagas as (
    select * from cuotas where saldo > 1
  ),
  vencidas as (
    select user_id, count(*)::int as n, sum(saldo) as monto
    from impagas where venc < v_hoy group by user_id
  ),
  antigua as (
    select distinct on (user_id) user_id, ref, venc, saldo
    from impagas where venc < v_hoy
    order by user_id, venc, numero
  ),
  proxima as (
    select distinct on (user_id) user_id, ref, venc, saldo
    from impagas where venc >= v_hoy
    order by user_id, venc, numero
  ),
  sync as (
    select user_id, max(synced_at) as s
    from public.external_invoices
    where user_id is not null and (_user is null or user_id = _user)
    group by user_id
  ),
  acuerdo as (
    select distinct on (user_id) user_id, id
    from public.mora_acuerdos
    where cerrado_at is null and v_hoy between desde and hasta
      and (_user is null or user_id = _user)
    order by user_id, hasta desc
  ),
  usuarios as (
    select user_id from cuotas
    union
    select user_id from public.mora_estado where _user is null or user_id = _user
  ),
  base as (
    select
      u.user_id,
      coalesce(v.n, 0) as n,
      coalesce(v.monto, 0) as monto,
      a.ref as a_ref, a.venc as a_venc, a.saldo as a_saldo,
      case when a.venc is null then 0 else v_hoy - a.venc end as dias,
      p.ref as p_ref, p.venc as p_venc, p.saldo as p_saldo,
      s.s as sync_at,
      coalesce(s.s > now() - interval '24 hours', false) as frescos,
      ac.id as acuerdo_id,
      coalesce(e.restringido, false) as estaba_restringido,
      e.restringido_desde as desde_prev
    from usuarios u
    left join vencidas v on v.user_id = u.user_id
    left join antigua a on a.user_id = u.user_id
    left join proxima p on p.user_id = u.user_id
    left join sync s on s.user_id = u.user_id
    left join acuerdo ac on ac.user_id = u.user_id
    left join public.mora_estado e on e.user_id = u.user_id
  ),
  calc as (
    select b.*,
      (b.acuerdo_id is null and (b.n >= 2 or b.dias >= 30)) as deberia
    from base b
  ),
  efectivo as (
    select c.*,
      case
        when not v_cfg.restriccion_activa then false
        when not c.deberia then false
        -- Sin datos frescos no se restringe a nadie nuevo; quien ya lo estaba sigue igual.
        when c.frescos then true
        else c.estaba_restringido
      end as restr
    from calc c
  ),
  avisos as (
    select e.*,
      case
        when e.acuerdo_id is not null or not e.frescos or e.a_ref is null then null
        when e.restr then 'aviso4'
        when e.dias >= 25 then 'aviso3'
        when e.dias >= 10 then 'aviso2'
        -- El aviso 1 anuncia el último día sin mora: solo tiene sentido dentro de la gracia.
        when e.dias between 4 and 5 then 'aviso1'
      end as tipo_calc,
      case
        when e.acuerdo_id is null and e.frescos and e.p_ref is not null
             and (e.p_venc - v_hoy) between 1 and 5 then e.p_ref
      end as previo_calc
    from efectivo e
  ),
  final as (
    select a.*,
      case when a.tipo_calc is not null and not exists (
        select 1 from public.mora_avisos m
        where m.user_id = a.user_id and m.tipo = a.tipo_calc and m.ref = a.a_ref
      ) then a.tipo_calc end as aviso,
      case when a.previo_calc is not null and not exists (
        select 1 from public.mora_avisos m
        where m.user_id = a.user_id and m.tipo = 'previo' and m.ref = a.previo_calc
      ) then a.previo_calc end as previo
    from avisos a
  ),
  upsert as (
    insert into public.mora_estado as me (
      user_id, etapa, dias_mora, cuotas_vencidas, monto_vencido,
      cuota_antigua_ref, cuota_antigua_venc, cuota_antigua_saldo,
      proxima_ref, proxima_venc, proxima_saldo,
      deberia_restringir, restringido, restringido_desde, acuerdo_id,
      datos_sync_at, datos_frescos, aviso_hoy, aviso_ref, previo_ref, evaluado_at
    )
    select
      f.user_id,
      case
        when f.acuerdo_id is not null then 'acuerdo'
        when f.restr then 'restringido'
        when f.deberia then 'por_restringir'
        when f.dias > 5 then 'mora'
        when f.dias >= 1 then 'gracia'
        else 'al_dia'
      end,
      greatest(f.dias, 0), f.n, f.monto,
      f.a_ref, f.a_venc, f.a_saldo,
      f.p_ref, f.p_venc, f.p_saldo,
      f.deberia, f.restr,
      case when f.restr then coalesce(f.desde_prev, now()) end,
      f.acuerdo_id,
      f.sync_at, f.frescos,
      f.aviso, case when f.aviso is not null then f.a_ref end, f.previo,
      now()
    from final f
    on conflict (user_id) do update set
      etapa = excluded.etapa,
      dias_mora = excluded.dias_mora,
      cuotas_vencidas = excluded.cuotas_vencidas,
      monto_vencido = excluded.monto_vencido,
      cuota_antigua_ref = excluded.cuota_antigua_ref,
      cuota_antigua_venc = excluded.cuota_antigua_venc,
      cuota_antigua_saldo = excluded.cuota_antigua_saldo,
      proxima_ref = excluded.proxima_ref,
      proxima_venc = excluded.proxima_venc,
      proxima_saldo = excluded.proxima_saldo,
      deberia_restringir = excluded.deberia_restringir,
      restringido = excluded.restringido,
      restringido_desde = excluded.restringido_desde,
      acuerdo_id = excluded.acuerdo_id,
      datos_sync_at = excluded.datos_sync_at,
      datos_frescos = excluded.datos_frescos,
      aviso_hoy = excluded.aviso_hoy,
      aviso_ref = excluded.aviso_ref,
      previo_ref = excluded.previo_ref,
      evaluado_at = excluded.evaluado_at
    returning me.*
  )
  select * from upsert;
end;
$$;

revoke all on function public.mora_evaluar(uuid, date) from public, anon, authenticated;
grant execute on function public.mora_evaluar(uuid, date) to service_role;

-- ============================================================
-- 7. Acceso al contenido: cuenta activa y sin restricción por mora
--    (administradores y docentes no se ven afectados por la mora)
-- ============================================================
create or replace function public.content_access_allowed(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.account_is_active(_user_id)
     and (
       _user_id is null
       or public.has_role(_user_id, 'admin'::app_role)
       or public.has_role(_user_id, 'docente'::app_role)
       or not exists (
         select 1 from public.mora_estado m where m.user_id = _user_id and m.restringido
       )
     );
$$;

revoke all on function public.content_access_allowed(uuid) from public;
grant execute on function public.content_access_allowed(uuid) to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array[
    'announcements',
    'assessments',
    'assessment_submissions',
    'certificates',
    'community_posts',
    'course_modules',
    'lesson_comments',
    'lesson_materials',
    'module_progress',
    'program_access_links',
    'program_modules',
    'zoom_meetings'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "cuenta activa requerida" on public.%I', t);
      execute format('drop policy if exists "acceso a contenido" on public.%I', t);
      execute format(
        'create policy "acceso a contenido" on public.%I as restrictive for all to authenticated
           using (public.content_access_allowed()) with check (public.content_access_allowed())',
        t
      );
    end if;
  end loop;
end;
$$;

drop policy if exists "course-materials cuenta activa requerida" on storage.objects;
drop policy if exists "course-materials acceso a contenido" on storage.objects;
create policy "course-materials acceso a contenido" on storage.objects
  as restrictive for select to authenticated
  using (bucket_id <> 'course-materials' or public.content_access_allowed());
