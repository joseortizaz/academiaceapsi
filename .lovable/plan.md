## Objetivo
Automatizar la sincronización de los estados de cuenta de los alumnos con Balance Activo mediante **webhooks en tiempo real + un cron nocturno de respaldo** que reconcilia solo a los alumnos con inscripción activa.

## Arquitectura

```
Balance Activo ──(evento factura/pago)──► /api/public/balance-activo-webhook  (ya existe)
                                                    │
                                                    └──► upsert external_invoices / external_payments

pg_cron (03:15 AM diario) ──► /api/public/hooks/sync-active-students
                                                    │
                                                    ├─ selecciona alumnos con enrollment activo + BA vinculado
                                                    ├─ por cada uno: GET /facturas y /cobros de BA
                                                    └─ upsert en external_invoices / external_payments
```

## Cambios

### 1. Nuevo endpoint de sincronización masiva
Archivo nuevo: `src/routes/api/public/hooks/sync-active-students.ts`
- Verifica header `apikey` contra la anon key.
- Consulta con `supabaseAdmin`:
  ```sql
  select distinct p.id, p.balance_activo_customer_id
  from profiles p
  join enrollments e on e.user_id = p.id
  where p.balance_activo_customer_id is not null
    and e.estado in ('activo','pendiente')
  ```
- Por cada alumno, reutiliza la lógica de `adminSyncUser` (extraída a un helper compartido en `balance-activo.server.ts` para no duplicar).
- Procesa en lotes con concurrencia limitada (ej. 5 en paralelo) para no saturar BA.
- Registra resumen en `balance_activo_webhook_logs` con tipo `cron_sync` (o crea tabla `balance_activo_sync_runs` si prefieres separar; por simplicidad, reutilizar logs).
- Devuelve `{ processed, invoices, payments, errors }`.

### 2. Extracción del helper de sync
En `src/lib/balance-activo.server.ts` añadir:
```ts
export async function syncCustomerData(userId: string, customerId: string)
```
Y refactorizar `syncMyInvoices` y `adminSyncUser` para llamar a este helper (elimina duplicación actual).

### 3. Programar el cron
Vía `supabase--insert` (no migración, contiene URL y key específicos del proyecto):
```sql
select cron.schedule(
  'sync-balance-activo-active-students',
  '15 3 * * *',   -- 03:15 AM diario
  $$
  select net.http_post(
    url := 'https://project--574a587a-0476-4791-be9b-3d7e669d64c8.lovable.app/api/public/hooks/sync-active-students',
    headers := '{"Content-Type":"application/json","apikey":"<ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```
Requiere extensiones `pg_cron` y `pg_net` habilitadas (verificar; si faltan, activarlas por migración previa).

### 4. Panel de administrador — visibilidad
En `src/routes/_authenticated/admin.facturacion.tsx`, pestaña **Conexión** o nueva pestaña **Sincronización**:
- Mostrar última corrida del cron (fecha, alumnos procesados, errores) leyendo `balance_activo_webhook_logs` filtrados por `event_type = 'cron_sync'`.
- Botón "Ejecutar sincronización ahora" que invoca una nueva server function `adminRunFullSync` (protegida con `requireSupabaseAuth` + `has_role admin`) que llama al mismo helper.

### 5. Webhooks (ya existentes)
- Verificar que `/api/public/balance-activo-webhook` esté configurado en el panel de Balance Activo apuntando a la URL estable del proyecto. Se incluirá una nota en el panel admin con la URL y el header/secret esperado para que el usuario lo configure en BA si aún no lo hizo.

## Detalles técnicos

- **Concurrencia**: usar un pool simple (`Promise.all` en chunks de 5) para evitar 429 del API de BA.
- **Timeouts**: cada llamada a BA con timeout de 15s; los fallos por alumno se capturan individualmente y no abortan el lote.
- **Idempotencia**: los upserts usan `onConflict: "external_id"`, así que reejecutar es seguro.
- **Observabilidad**: cada corrida inserta una fila en `balance_activo_webhook_logs` con:
  - `event_type: 'cron_sync'`
  - `payload: { processed, invoices, payments, duration_ms }`
  - `errors: [ { userId, message } ]` en caso de fallos.
- **Seguridad**: el endpoint `/api/public/hooks/sync-active-students` valida la anon key en header `apikey` (patrón canónico); no expone datos, solo escribe.

## Archivos afectados

Nuevos:
- `src/routes/api/public/hooks/sync-active-students.ts`

Editados:
- `src/lib/balance-activo.server.ts` (helper `syncCustomerData`)
- `src/lib/balance-activo.functions.ts` (refactor + nueva `adminRunFullSync`)
- `src/routes/_authenticated/admin.facturacion.tsx` (UI de estado del cron + botón manual)

SQL (vía `supabase--insert`, no migración):
- Programación del `cron.schedule`.

Migración solo si `pg_cron`/`pg_net` no están habilitadas aún.
