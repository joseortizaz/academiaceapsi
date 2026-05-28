# Integración real con Zoom

Reemplaza el mock actual (`src/lib/zoom-mock.ts`) por una integración real basada en tres piezas de Zoom que trabajan juntas:

1. **Meeting SDK (web)** — para embeber la videollamada dentro de la plataforma sin salir a zoom.us.
2. **Server-to-Server OAuth App** — para crear/listar/borrar reuniones bajo la cuenta central de la academia.
3. **Webhook de Zoom** — para recibir `recording.completed` y publicar la grabación automáticamente.

> Necesitas **dos apps** en el Zoom Marketplace porque Meeting SDK y Server-to-Server OAuth son tipos distintos. Ambas viven bajo la misma cuenta administradora de la academia.

---

## 1. Apps a crear en marketplace.zoom.us

### App A — "Ceapsi Plataforma S2S" (Server-to-Server OAuth)
Usada por el backend para crear reuniones y suscribirse a webhooks.

Credenciales que entrega:
- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_WEBHOOK_SECRET_TOKEN`

Scopes mínimos:
- `meeting:write:admin`, `meeting:read:admin`
- `recording:read:admin`
- `user:read:admin`

Event Subscriptions (webhook):
- URL: `https://project--574a587a-0476-4791-be9b-3d7e669d64c8.lovable.app/api/public/zoom-webhook`
- Eventos: `recording.completed`, `meeting.started`, `meeting.ended`
- Validación: URL Validation (CRC) automática.

### App B — "Ceapsi Aula Virtual" (Meeting SDK)
Usada por el frontend para embeber el cliente de Zoom.

Credenciales:
- `ZOOM_SDK_KEY` (public, va en `import.meta.env.VITE_ZOOM_SDK_KEY`)
- `ZOOM_SDK_SECRET` (privado, solo backend, para firmar el JWT del SDK)

---

## 2. Secrets a registrar en Lovable Cloud

| Secret | Dónde se usa |
|---|---|
| `ZOOM_ACCOUNT_ID` | server fn (token S2S) |
| `ZOOM_CLIENT_ID` | server fn |
| `ZOOM_CLIENT_SECRET` | server fn |
| `ZOOM_SDK_KEY` | server fn (firma JWT) — también expuesta como `VITE_ZOOM_SDK_KEY` en frontend |
| `ZOOM_SDK_SECRET` | server fn (firma JWT) |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | ruta pública `/api/public/zoom-webhook` |

El secret existente `ZoomSDK` se renombra/divide según corresponda.

---

## 3. Cambios en base de datos

Nueva tabla `zoom_meetings` (acceso solo a roles `admin`/`docente`/inscritos):
- `programa_id`, `modulo_id`
- `titulo`, `docente_nombre`
- `zoom_meeting_id`, `zoom_join_url`, `zoom_start_url`, `zoom_password`
- `start_at`, `duration_min`
- `status` (`scheduled` / `live` / `ended` / `recorded`)
- `recording_url`, `recording_duration_min`, `recording_password`
- `created_by`, timestamps

Una tabla de auditoría `zoom_webhook_logs` para guardar eventos recibidos (debug + idempotencia por `event_id`).

RLS: admin/docente CRUD; estudiante SELECT solo si tiene inscripción `confirmado`/`activo` en el programa.

---

## 4. Backend — server functions y ruta pública

### `src/lib/zoom.server.ts` (helpers)
- `getZoomAccessToken()` — POST a `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=...` con Basic Auth. Cachea token en memoria (válido 1h).
- `zoomApi(path, init)` — wrapper de `fetch` contra `https://api.zoom.us/v2`.
- `signMeetingSdkJwt({ meetingNumber, role })` — firma JWT del Meeting SDK (HS256, payload `appKey/sdkKey/mn/role/iat/exp/tokenExp`).

### `src/lib/zoom.functions.ts` (server fns, middleware `requireSupabaseAuth` + check rol)
- `createZoomMeeting({ titulo, programaId, startAt, durationMin, autoRecord })` → crea en Zoom, guarda en `zoom_meetings`.
- `deleteZoomMeeting({ id })`
- `listZoomMeetings({ programaId? })`
- `getMeetingSdkSignature({ meetingId, role })` → devuelve `{ signature, sdkKey }` al frontend (role 1 = host docente, role 0 = estudiante; valida inscripción del estudiante antes de firmar).

### `src/routes/api/public/zoom-webhook.ts` (server route)
- Maneja URL Validation challenge (`event === 'endpoint.url_validation'` → devolver `plainToken` + `encryptedToken` HMAC-SHA256 con `ZOOM_WEBHOOK_SECRET_TOKEN`).
- Verifica firma de eventos: header `x-zm-signature` = `v0=HMAC_SHA256(secret, "v0:" + x-zm-request-timestamp + ":" + body)`.
- Idempotencia por `payload.event_ts` + `payload.object.uuid`.
- En `recording.completed`: extrae `share_url` / `play_url` de la primera grabación MP4 y actualiza `zoom_meetings.recording_url`, `status='recorded'`.
- En `meeting.started` / `meeting.ended`: actualiza `status`.

---

## 5. Frontend

### Reemplazar `src/lib/zoom-mock.ts`
Eliminar el store mock. Reemplazar por hooks basados en TanStack Query que llaman a las server fns reales.

### `src/routes/_authenticated/admin.integraciones.tsx`
- Quitar el flujo OAuth simulado.
- Mostrar estado real: ping a una server fn `getZoomConnectionStatus()` que pide `/users/me` con el token S2S — si responde 200, "Conectado a {account}".
- Botón "Probar conexión" + "Ver logs" (lectura de `zoom_webhook_logs`).

### `src/routes/_authenticated/docente.clases-vivo.tsx`
- `CreateClassDialog` llama a `createZoomMeeting` real.
- Botón "Iniciar" abre una nueva vista embebida (ver abajo) en lugar de `window.open(zoomStartUrl)`.

### Nueva ruta `src/routes/_authenticated/clase-vivo.$meetingId.tsx`
Embed del Meeting SDK:
- Instalar `@zoom/meetingsdk` (`bun add @zoom/meetingsdk`).
- Cargar el cliente vía `ZoomMtgEmbedded.createClient()`, pedir signature a `getMeetingSdkSignature`, hacer `client.join({ sdkKey, signature, meetingNumber, password, userName, role })`.
- Resolver role automáticamente: si el usuario es el docente del programa → host; si es estudiante inscrito confirmado → attendee; si no → 403.

### Vista de grabaciones (alumnos)
En `mis-cursos.$slug.tsx`, listar grabaciones (`status='recorded'`) con `<video>` apuntando al `recording_url` (vía proxy server fn si Zoom requiere auth) o link al `share_url` con `recording_password`.

---

## 6. Pasos en orden de implementación

1. Crear migración para `zoom_meetings` + `zoom_webhook_logs` con RLS.
2. Registrar los 6 secrets (te pediré que los pegues una vez creadas las apps en Zoom).
3. Implementar `zoom.server.ts` + `zoom.functions.ts`.
4. Implementar `/api/public/zoom-webhook.ts` y probar URL Validation desde Zoom Marketplace.
5. Reemplazar UI de admin/integraciones y docente/clases-vivo (sin el mock).
6. Agregar dependencia `@zoom/meetingsdk` y crear la ruta de clase embebida.
7. Borrar `src/lib/zoom-mock.ts` cuando todo funcione.

---

## Notas técnicas

- **Server-to-Server OAuth** no requiere flujo de redirección — el token se genera con credenciales y dura 1h. Lo refresca el backend automáticamente.
- **Meeting SDK signature** es un JWT HS256 firmado en el backend; nunca expongas `ZOOM_SDK_SECRET` al cliente.
- **Webhook**: la URL debe estar pública antes de poder validarla en el Marketplace. El proyecto ya tiene URL estable (`project--<id>.lovable.app`), no cambia al renombrar.
- **Grabación en la nube** requiere que la cuenta Zoom tenga plan Pro o superior (Basic solo permite grabación local, sin webhook `recording.completed`).
- El bucket privado existente `course-materials` puede servir como respaldo si decides descargar las grabaciones de Zoom y rehospedarlas (no incluido en este plan; usa el `share_url` de Zoom por simplicidad).