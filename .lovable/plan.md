# Retirar datos de ejemplo del panel Docente

Las secciones **Resumen**, **Calificaciones** y **Comunidad** del panel del docente actualmente muestran datos ficticios codificados en el frontend (nombres como "María Pérez", "Carlos Rodríguez", tareas inventadas, preguntas de ejemplo, etc.). Estos datos no provienen de la base de datos: están hardcodeados como arrays constantes dentro de cada archivo.

## Cambios propuestos

### 1. Resumen del Docente (`src/routes/_authenticated/docente.index.tsx`)
- **Eliminar** el array `tareasPendientes` con las 4 tareas ficticias.
- **Eliminar** los KPIs hardcodeados "Calificaciones por revisar: 7" y "Mensajes pendientes: 4" — sustituir por `0` o por un valor real si hay una fuente; por ahora `0` ya que no existe tabla de entregas/mensajes.
- **Reemplazar** la tarjeta "Tareas pendientes" por un estado vacío ("No tienes tareas pendientes por ahora.") manteniendo el enlace a Calificaciones.
- **Conservar intacto**: el saludo al docente, los KPIs reales (Alumnos asignados, Cursos activos) que sí vienen de Supabase, y la tarjeta "Próximas clases en vivo" que ya consulta `program_modules`.

### 2. Calificaciones (`src/routes/_authenticated/docente.calificaciones.tsx`)
- **Eliminar** el array `initialEntregas` con las 6 entregas ficticias.
- Mantener la UI completa (buscador, filtros, tabla, diálogo de calificación) pero arrancar con lista vacía.
- Mostrar un estado vacío informativo: "Aún no hay entregas para calificar." (el componente ya tiene la fila "Sin entregas." en la tabla, así que el cambio principal es inicializar `entregas` como `[]`).
- **No tocar** la lógica de filtros, edición ni el diálogo: queda lista para conectarse a una tabla real cuando exista.

### 3. Comunidad y Soporte (`src/routes/_authenticated/docente.comunidad.tsx`)
- **Eliminar** el array `initialPreguntas` con las 5 preguntas ficticias.
- Inicializar `preguntas` como `[]` y `selected` como `null`.
- El panel derecho ya muestra correctamente el estado vacío ("Selecciona una pregunta para responder."); se ajustará el texto a algo como "Aún no hay preguntas de alumnos." cuando el inbox esté vacío.
- **No tocar** la lógica de respuesta, filtros, ni la UI: queda lista para conectarse a una tabla real más adelante.

## Lo que NO se modifica
- Datos reales que ya vienen de Supabase (docente, programas, inscripciones, módulos en vivo, perfil público).
- Funcionalidad de los formularios, diálogos, filtros y navegación.
- Rutas, esquema de base de datos, ni políticas RLS.
- Otras secciones del panel docente (Cursos, Clases en vivo, Evaluaciones, Cuenta).

## Notas técnicas
Las tres páginas usan estado local con `useState(initialX)`. El cambio es puramente frontend: reemplazar los arrays seed por `[]` y eliminar las constantes mock. No se requiere migración ni cambios de backend.
