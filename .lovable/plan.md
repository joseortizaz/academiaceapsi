
## Objetivo

Dejar operativo el flujo de clases en vivo descrito en tu diagrama:

```text
[Plataforma] --(S2S OAuth)--> [API Zoom: crea reunión]
     |                                |
 (Firma Meeting SDK)          (Webhooks: estado + grabación)
     v                                v
[SDK Web incrustado en pantalla del alumno/docente]
```

Las credenciales ya existen (`ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_SDK_KEY`, `ZOOM_SDK_SECRET`, `ZOOM_WEBHOOK_SECRET_TOKEN`). El código base ya implementa el flujo, pero requiere los ajustes que se detallan abajo.

---

## URL para Event Subscriptions de Zoom

Registra este endpoint en tu **Server-to-Server OAuth App → Feature → Event Subscriptions**:

```
https://www.academiaceapsi.com/api/public/zoom-webhook
```

- Maneja automáticamente el **CRC URL Validation** (responde con `plainToken`/`encryptedToken`).
- Verifica la firma `x-zm-signature` con `ZOOM_WEBHOOK_SECRET_TOKEN`.
- Eventos que debes suscribir en Zoom:
  - `meeting.started`
  - `meeting.ended`
  - `recording.completed`
  - (opcional) `endpoint.url_validation` — Zoom la envía automáticamente al validar.

---

## Cambios a aplicar

### 1. Dependencia del Meeting SDK
Verificar que `@zoom/meetingsdk` esté instalado (lo importa `src/components/ZoomEmbed.tsx`). Si falta, instalarlo. Sin esto, la pantalla de "Clase en vivo" rompe en runtime.

### 2. Hoja de estilos del Meeting SDK
El SDK requiere cargar su CSS para renderizar correctamente botones, layout y controles. Añadir en `ZoomEmbed.tsx`:
```ts
import "@zoom/meetingsdk/dist/css/bootstrap.css";
import "@zoom/meetingsdk/dist/css/react-select.css";
```

### 3. Identidad del asistente en el join
Hoy `userEmail` se pasa como `undefined`. Reemplazar por el email del usuario autenticado (útil para reportes de asistencia y para que Zoom no marque al usuario como anónimo). Se obtiene desde la sesión Supabase.

### 4. Validación del CRC con `timingSafeEqual`
Actualmente la verificación de firma del webhook usa `crypto.timingSafeEqual` directamente; si los buffers tienen tamaños distintos lanza excepción y devuelve 500 en vez de 401. Envolver en try/catch ya está, pero conviene validar longitud previa para responder consistentemente 401.

### 5. Re-procesado idempotente de webhooks
La actualización de `zoom_webhook_logs` tras procesar usa una combinación `event + event_ts + zoom_meeting_id` que puede no ser única. Cambiar para guardar el `id` devuelto por el `INSERT` inicial y actualizar por ese `id`. Evita "actualizaciones fantasma" si Zoom reintenta el evento.

### 6. Permitir al docente crear/eliminar reuniones de SUS programas
Hoy `assertAdminOrDocente` permite a cualquier docente crear reuniones sobre cualquier programa. Endurecer en `createZoomMeeting` y `deleteZoomMeeting`:
- Admin: sin restricción.
- Docente: validar `is_teacher_of_program(programaId)` antes de crear/borrar.

### 7. Vista para estudiante: usar `zoom_meetings_student`
La política RLS ya expone una vista segura sin `zoom_start_url`. Confirmar que `mis-cursos.$slug.tsx` y la pantalla de "Clases en vivo del estudiante" leen de la vista, no de la tabla.

### 8. Estado "live" basado en tiempo si no llega webhook
Si Zoom no entrega `meeting.started` por algún motivo, el botón "Entrar" puede quedar deshabilitado. Habilitar el botón también cuando `now() ∈ [start_at - 10min, start_at + duration_min + 30min]`. Es solo UI, no cambia datos.

---

## Configuración manual que debes hacer en Zoom Marketplace

Una vez aplicados los cambios:

1. **Server-to-Server OAuth App**:
   - Scopes mínimos: `meeting:write:admin`, `meeting:read:admin`, `recording:read:admin`, `user:read:admin`.
   - Event Subscriptions → Add Event Subscription:
     - Event notification endpoint URL: `https://www.academiaceapsi.com/api/public/zoom-webhook`
     - Events: Meeting Started, Meeting Ended, Recording Completed.
     - Secret Token: el mismo valor de `ZOOM_WEBHOOK_SECRET_TOKEN`.
     - Click **Validate** → debe responder OK (CRC handshake).

2. **Meeting SDK App** (separada de la S2S):
   - Activar el SDK para "Web".
   - Copiar SDK Key/Secret y confirmar que coinciden con `ZOOM_SDK_KEY` / `ZOOM_SDK_SECRET`.
   - Dominios permitidos: `academiaceapsi.com`, `www.academiaceapsi.com`, `ceapsird.lovable.app`.

---

## Archivos que se tocarán

- `src/components/ZoomEmbed.tsx` — imports de CSS, email de usuario.
- `src/routes/api/public/zoom-webhook.ts` — verificación robusta + update por id.
- `src/lib/zoom.functions.ts` — validar `is_teacher_of_program` en create/delete.
- `src/routes/_authenticated/mis-cursos.$slug.tsx` y/o vistas de estudiante — leer de `zoom_meetings_student`.
- `src/routes/_authenticated/clase-vivo.$meetingId.tsx` — UI del botón "Entrar".
- `package.json` — agregar `@zoom/meetingsdk` si no estuviera.

## Lo que NO se cambia

- No se eliminan ni rotan secretos.
- No se modifica la estructura de tablas `zoom_meetings` / `zoom_webhook_logs`.
- No se toca el cliente Supabase autogenerado.
- Las políticas RLS existentes se conservan; solo se endurece la lógica del servidor.
