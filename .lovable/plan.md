## Objetivo

Que la clase en vivo se abra **dentro** de la ruta `/clase-vivo/$meetingId` (en un contenedor de la propia app) en lugar de redirigir a Zoom en una pestaña nueva.

## Estado actual

- Backend ya está listo:
  - `getMeetingSdkSignature` (en `src/lib/zoom.functions.ts`) firma el JWT del Meeting SDK con rol correcto (host para admin/docente titular, attendee para alumnos con inscripción activa/completada) y devuelve `signature`, `sdkKey`, `meetingNumber`, `password`, `titulo`.
  - Secretos `ZOOM_SDK_KEY` y `ZOOM_SDK_SECRET` ya están configurados en Lovable Cloud.
- Frontend (`src/components/ZoomEmbed.tsx`) sólo muestra un botón "Unirse a la reunión" que abre `zoom.us` en otra pestaña — no embebe nada.

## Cambios propuestos

### 1. Dependencia

Añadir `@zoom/meetingsdk` (SDK oficial de Zoom para web) al proyecto.

### 2. Reescribir `src/components/ZoomEmbed.tsx` usando **Component View**

Component View es el modo recomendado por Zoom para embeber la reunión dentro de un `<div>` de la app sin ocupar toda la pantalla ni requerir cross-origin isolation. Flujo:

1. Al montar: llamar `getMeetingSdkSignature` (ya existe).
2. Import dinámico de `@zoom/meetingsdk/embedded` (para evitar SSR y aligerar el bundle inicial).
3. `ZoomMtgEmbedded.createClient()` → `client.init({ zoomAppRoot: divRef, language: "es-ES", customize: { video: { isResizable: true, viewSizes: { default: { width: 1000, height: 600 } } } } })`.
4. `client.join({ signature, sdkKey, meetingNumber, password, userName, userEmail })` usando nombre/email del `useAuth()` actual.
5. Al desmontar: `client.leave()` + `ZoomMtgEmbedded.destroyClient()`.
6. Manejo de errores: si el navegador bloquea (Safari <16, iOS sin WebRTC), mostrar fallback con el botón externo actual (`joinUrl` / `startUrl`).

### 3. Pasar `userName` y `userEmail` al backend

Extender `getMeetingSdkSignature` para incluir en la respuesta el nombre y correo del usuario autenticado (leídos de `profiles`), así el componente los envía a `client.join()` sin exponer datos privados de otros.

### 4. Ruta `/_authenticated/clase-vivo/$meetingId`

Ajustar el layout del contenedor para dar altura suficiente al iframe embebido (mínimo 600px) y ocultar el shell del sidebar cuando la clase está activa (opcional pero recomendado para no comprimir el video).

### 5. Configuración requerida en Zoom Marketplace (usuario)

Para que el Meeting SDK funcione, la app **Meeting SDK** de Zoom (no la Server-to-Server OAuth que ya está) debe tener:

- Tipo de app: **Meeting SDK** (o **General App** con Meeting SDK activado).
- **Domain allow list**: añadir los dominios donde correrá la app:
  - `academiaceapsi.com`
  - `www.academiaceapsi.com`
  - `ceapsird.lovable.app`
  - `*.lovable.app` (para previews)
- Activada y publicada internamente (Intra-account).

Si `ZOOM_SDK_KEY`/`ZOOM_SDK_SECRET` corresponden a una app distinta a la S2S, ya es correcto; sólo hace falta verificar el allow list.

### 6. Consideraciones

- **Component View** funciona sin COOP/COEP headers y soporta hasta 25 videos simultáneos, suficiente para el caso de uso.
- Si en el futuro necesitan Gallery View >25 vídeos, hay que añadir cabeceras `Cross-Origin-Opener-Policy` y `Cross-Origin-Embedder-Policy` — no incluido en este cambio.
- El bundle del SDK (~2.5 MB gz) se carga sólo en la ruta de clase en vivo gracias al import dinámico.

## Archivos afectados

- `package.json` — nueva dependencia.
- `src/components/ZoomEmbed.tsx` — reescrito.
- `src/lib/zoom.functions.ts` — extender `getMeetingSdkSignature` para devolver `userName`/`userEmail`.
- `src/routes/_authenticated/clase-vivo.$meetingId.tsx` — ajuste de layout.

## Pregunta pendiente

¿Los `ZOOM_SDK_KEY` / `ZOOM_SDK_SECRET` actuales pertenecen a una app tipo **Meeting SDK** en el Zoom Marketplace, o son de la misma app Server-to-Server OAuth? Si es lo segundo, hay que crear una app Meeting SDK aparte antes de que el embed funcione (te guío en los pasos exactos).
