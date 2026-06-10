## Diagnóstico

El código del generador de contenidos ya está listo para Firecrawl:

- `src/lib/ai-generators.functions.ts` → `generateLessonFromWeb` lee `process.env.FIRECRAWL_API_KEY`, llama a `https://api.firecrawl.dev/v2/search` con `scrapeOptions: { formats: ["markdown"] }`, toma hasta 5 fuentes y se las pasa al modelo (`google/gemini-2.5-pro`) para generar la lección con citas `[n]`.
- `src/components/ai/AiContentGenerator.tsx` ya muestra el aviso "Firecrawl no está conectado" cuando la variable falta, y ya está montado en `src/routes/_authenticated/admin.modulos.tsx` (botón "Generar con IA desde la web" en cada lección).

El único problema es que **la conexión de Firecrawl existe en tu workspace pero no está vinculada a este proyecto**, por eso `FIRECRAWL_API_KEY` no aparece como variable de entorno en el backend y la función cae al modo "sin fuentes web".

## Plan

1. **Vincular la conexión Firecrawl al proyecto** con `standard_connectors--connect` (connector_id `firecrawl`). Esto inyecta `FIRECRAWL_API_KEY` en el entorno del servidor sin pedirte nada más, ya que la conexión ya está autorizada.
2. **Verificar** que el secreto quedó disponible y probar el generador desde `/admin/modulos` → editar una lección → "Generar con IA desde la web". Debe mostrar "Contenido generado con N fuente(s) web" y citas `[1]`, `[2]` en el markdown.

## Mejoras opcionales (te pregunto antes de hacerlas)

- **Exponer también el generador en programas/módulos**, no sólo dentro de cada lección, para crear borradores de cursos completos.
- **Permitir elegir idioma/región y filtro temporal** (`tbs: qdr:m/y`) y número de fuentes (hoy fijo en 5) desde el diálogo.
- **Generar el quiz de evaluación** (`generateQuizFromPdf` ya existe) directamente a partir de la lección recién generada con IA, no solo de un PDF subido.

## Detalles técnicos

- No requiere migraciones ni cambios de RLS.
- No expone la API key al cliente: la llamada a Firecrawl vive en un `createServerFn` con `requireSupabaseAuth`.
- El modelo por defecto del gateway sigue siendo `google/gemini-2.5-pro` para esta ruta; si quieres cambiarlo a `google/gemini-3-flash-preview` (más rápido/barato) lo ajusto en el mismo paso.
