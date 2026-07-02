# Integración con Balance Activo

## Qué implica esta integración

Balance Activo es una app externa (SaaS multi-tenant, aunque esté construida en Lovable, sigue siendo otro proyecto con su propia base de datos). Para que la academia pueda mostrar facturas y pagos que viven allá, hacen falta tres cosas:

1. **Una API en Balance Activo** que exponga, con autenticación, los endpoints necesarios (listar facturas por cliente, listar pagos, opcionalmente crear factura). Sin API no hay integración posible; habría que construirla primero en ese proyecto.
2. **Una credencial de tu tenant** (API key o token OAuth) que la academia guardará como secreto para llamar a Balance Activo en nombre de tu cuenta.
3. **Un mecanismo de identidad**: cómo sabe Balance Activo que "alumno X de la academia" = "cliente Y en su base". Lo resolvemos guardando un `balance_activo_customer_id` en el perfil del alumno.

### Implicaciones importantes
- **Privacidad y RLS**: cada alumno solo puede ver sus propias facturas. Toda llamada saliente se hace desde el servidor (server function) validando `auth.uid()`, nunca desde el navegador con la API key.
- **Secretos**: la API key de Balance Activo se guarda con `add_secret`, nunca en el código ni en `.env` público.
- **Latencia y caché**: consultar Balance Activo en cada carga es lento y castiga su API. Guardamos una copia sincronizada en tablas locales (`external_invoices`, `external_payments`) y refrescamos por webhook o cron.
- **Fuente de verdad**: Balance Activo manda en lo contable. La academia solo lee/replica; nunca edita montos localmente.
- **Fallo del proveedor**: si Balance Activo está caído, el alumno debe seguir viendo la última copia cacheada, no una pantalla rota.
- **Cumplimiento fiscal**: los PDF de factura los genera y numera Balance Activo (con validez legal). La academia solo enlaza al PDF, no lo reimprime.

## Decisiones por defecto (asumidas)
- **Sentido**: bidireccional ligero — la academia lee facturas/pagos, y cuando un admin aprueba una inscripción, opcionalmente crea la factura en Balance Activo con un botón manual (evitamos automatismo total hasta validar).
- **Vínculo**: por `email` como fallback + `balance_activo_customer_id` guardado en `profiles` cuando se confirma el match.
- **Qué ve el alumno**: listado de facturas (número, fecha, concepto, monto, estado), enlace al PDF, historial de pagos y saldo pendiente.
- **Sincronización**: webhook desde Balance Activo (`invoice.created`, `invoice.updated`, `payment.recorded`) + botón "Sincronizar ahora" en admin.

## Plan paso a paso

### Fase 1 — Prerrequisitos en Balance Activo (tú + equipo de esa app)
1. Confirmar que Balance Activo expone (o construir) estos endpoints REST autenticados por API key:
   - `GET /api/customers?email=…` → buscar/crear cliente
   - `GET /api/invoices?customer_id=…` → listar facturas
   - `GET /api/invoices/:id/pdf` → PDF (URL firmada temporal)
   - `GET /api/payments?customer_id=…` → pagos
   - `POST /api/invoices` → crear factura (opcional fase 2)
   - Webhook saliente firmado con HMAC → `invoice.*`, `payment.*`
2. Emitir una API key para el tenant "Academia CEAPSI" y un `WEBHOOK_SECRET`.

### Fase 2 — Backend en la academia
3. **Secretos**: `add_secret` para `BALANCE_ACTIVO_API_URL`, `BALANCE_ACTIVO_API_KEY`, `BALANCE_ACTIVO_WEBHOOK_SECRET`.
4. **Migración DB**:
   - `profiles.balance_activo_customer_id` (text, nullable).
   - Tabla `external_invoices` (id externo, user_id, número, fecha, concepto, monto, moneda, estado, pdf_url, raw jsonb, synced_at).
   - Tabla `external_payments` (id externo, invoice_id externo, user_id, fecha, monto, método, raw jsonb).
   - RLS: alumno ve solo sus filas (`auth.uid() = user_id`); admin ve todo; service_role total. GRANT correspondiente.
5. **Cliente HTTP** en `src/lib/balance-activo.server.ts` con `fetch` + API key + reintentos + manejo de errores.
6. **Server functions** en `src/lib/balance-activo.functions.ts`:
   - `listMyInvoices` (usa `requireSupabaseAuth`, devuelve de `external_invoices`).
   - `syncMyInvoices` (refresca desde la API para el usuario actual).
   - `adminLinkCustomer` (admin: setea `balance_activo_customer_id`).
   - `adminCreateInvoice` (admin: `POST /api/invoices` + upsert local).
7. **Webhook público** en `src/routes/api/public/balance-activo-webhook.ts`: verifica HMAC del `WEBHOOK_SECRET`, hace upsert en `external_invoices`/`external_payments`. Nunca confía en el payload sin firma.

### Fase 3 — UI
8. **Alumno** — nueva pestaña "Facturación" en `estudiante.cuenta.tsx` (o sección aparte) con:
   - Resumen: saldo pendiente, próxima fecha.
   - Tabla de facturas con estado (pagada/pendiente/vencida) y botón "Descargar PDF".
   - Historial de pagos.
   - Estado vacío si aún no hay `balance_activo_customer_id` vinculado.
9. **Admin** — nueva ruta `/admin/facturacion`:
   - Buscar alumno → vincular con cliente de Balance Activo (autocomplete por email).
   - Botón "Crear factura" desde una inscripción aprobada.
   - Botón "Resincronizar" por alumno.
   - Log de webhooks recibidos (similar a `zoom_webhook_logs`).

### Fase 4 — Validación
10. Prueba end-to-end con 1 alumno real: vincular → crear factura desde admin → recibir webhook → alumno ve la factura y el PDF → registrar pago en Balance Activo → alumno ve pago aplicado y saldo en 0.

## Lo que necesito de ti para empezar
- **URL base y documentación** de la API de Balance Activo (o confirmación de que hay que construirla primero en ese proyecto — en cuyo caso empezamos por allá).
- **API key** de tu tenant (la pediré con `add_secret` cuando llegue el momento, no la pegues en el chat).
- Confirmación de las decisiones por defecto arriba (vínculo por email, ver facturas+pagos+PDF, sincronización por webhook).

Cuando confirmes esos tres puntos arranco por la Fase 2 (migración + secretos + cliente HTTP).
