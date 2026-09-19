# Academia Ceapsi Connect

Actúa como un desarrollador Full-Stack experto en React, Tailwind CSS y Supabase. Vamos a crear una plataforma web de Sistema de Gestión de Aprendizaje (LMS) llamada "Academia Ceapsi RD", ubicada en República Dominicana. Todo el portal, textos, botones e interfaz deben estar completamente en Español.

La plataforma ofrecerá Diplomados y Cursos tanto síncronos (en vivo por Zoom) como asincrónicos.

### 1. ROLES DE USUARIO Y PERMISOS (RBAC)

- **Administrador**: Acceso total. Gestión de usuarios, asignación de roles, creación de cualquier curso/diplomado, asignación de docentes a módulos y control global del sistema.

- **Docente**: Registrado únicamente por el Administrador. Puede gestionar su perfil, crear y administrar sus propios cursos asincrónicos, y matricular alumnos (solo en sus cursos). Puede gestionar el contenido de cursos o módulos en vivo solo si el Administrador lo asignó como docente de ese módulo.

- **Estudiante**: Puede registrarse directamente o ser matriculado por un Administrador. Puede ver el catálogo, cursar lecciones de forma secuencial y descargar certificados al finalizar.

### 2. MODELO DE DATOS E HIERARQUÍA DE CONTENIDO

- **Curso / Diplomado**: Título, descripción, tipo (En vivo por Zoom / Asincrónico), imagen de portada, precio en DOP (Pesos Dominicanos) y Docentes Asignados.

- **Módulos**: Estructura en la que se dividen los Cursos/Diplomados. Cada módulo dentro de un mismo curso puede tener un Docente distinto asignado.

- **Lecciones**: Pertenecen a un Módulo. Deben soportar 4 tipos de contenido:

  - Video (Enlaces de Vimeo o YouTube).

  - Audio (Subida de archivo o simulación de grabación directa).

  - Documentos PDF.

  - Contenido HTML / Texto enriquecido.

- **Restricción Secuencial (Drip Content)**: El acceso es gradual. Una lección o módulo se bloquea hasta que el estudiante complete la anterior (es requisito).

- **Evaluaciones y Asignaciones**: Quizzes y tareas que se programan e intercalan de forma libre entre las lecciones.

- **Generador de Certificados**: Módulo que genera un documento/PDF descargable automáticamente cuando el alumno alcanza el 100% de progreso.

### 3. ESTRUCTURA DE PÁGINAS E INTERFAZ

#### Sitio Web Externo (Público):

- **Navbar**: Logo, Enlaces (Inicio, Sobre nosotros, Docentes, Galería, Blog, Contactos) y dos botones destacados: "Registro" y "Accede".

- **Inicio**: Banner principal (Hero), cursos destacados, testimonios de alumnos dominicanos y beneficios de la academia.

- **Sobre nosotros**: Misión, visión y valores institucionales de Ceapsi RD.

- **Docentes**: Directorio o cuadrícula con las fotos y perfiles profesionales del cuerpo docente.

- **Galería**: Fotos de eventos presenciales, graduaciones o talleres en RD.

- **Blog**: Artículos de interés psicológico/educativo con opción de lectura individual.

- **Contactos**: Formulario de contacto, datos de ubicación en República Dominicana y enlaces a redes sociales.

#### Portal Interno (Autenticado):

- **Auth**: Páginas de Login y Registro optimizadas. El login redirige automáticamente según el rol del usuario.

- **Dashboard de Estudiante**: Panel con cursos activos, barras de progreso de avance gradual, área de reproducción de lecciones y descarga de certificados.

- **Dashboard de Docente**: Constructor de cursos asincrónicos, lista de alumnos matriculados bajo su tutoría y panel para calificar tareas.

- **Dashboard de Administrador**: Panel de control de usuarios (para asignar roles como Docente), catálogo general y asignación de profesores a módulos específicos.

---

### PLAN DE IMPLEMENTACIÓN PASO A PASO

Por favor, construye la aplicación de manera progresiva siguiendo estos pasos:

- **PASO 1: Sitio Web Público y Navegación**: Diseña toda la web externa (Inicio, Sobre nosotros, Docentes, Galería, Blog, Contactos) con un diseño UI/UX limpio, moderno y responsive. Crea también las pantallas visuales de Login y Registro.

- **PASO 2: Modelo de Datos y Rutas por Rol**: Configura las tablas o mocks para Usuarios, Cursos, Módulos, Lecciones y Progreso. Implementa la lógica para que el login separe los dashboards de Admin, Docente y Estudiante.

- **PASO 3: Reproductor de Curso Estudiante**: Desarrollar la interfaz de estudio. Aplica la restricción de avance gradual (bloquear contenido posterior) y las pestañas multimedia de la lección (Video, Audio, PDF, HTML).

- **PASO 4: Panel del Docente y Administrador**: Crear los formularios para añadir módulos, lecciones, intercalar evaluaciones y la opción del Administrador para delegar un docente diferente por módulo.

- **PASO 5: Generador de Certificados**: Programar la condición que detecta el 100% del curso completado y habilita el botón para descargar el certificado directamente en formato digital.

Comencemos construyendo el **PASO 1**: Toda la web externa pública y el diseño de la interfaz de autenticación (Accede/Registro), asegurando que el diseño use colores profesionales acordes a una academia de formación.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ceapsird.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/574a587a-0476-4791-be9b-3d7e669d64c8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
