import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, BookOpen, Users, Video, FileCheck, ClipboardCheck,
  MessagesSquare, UserCog, ArrowLeft, HelpCircle,
} from "lucide-react";
import heroImg from "@/assets/guide-teacher-hero.jpg";

export const Route = createFileRoute("/_authenticated/docente/instructivo")({
  head: () => ({
    meta: [
      { title: "Instructivo del docente | CEAPSI" },
      { name: "description", content: "Guía paso a paso para gestionar tus cursos, clases en vivo y evaluaciones en la Academia CEAPSI." },
    ],
  }),
  component: InstructivoDocente,
});

const secciones = [
  {
    icon: LayoutDashboard,
    titulo: "Resumen",
    ruta: "/docente",
    texto:
      "Es tu panel principal. Aquí verás un vistazo rápido de tus programas, cantidad de estudiantes activos, próximas clases en vivo y evaluaciones pendientes por calificar.",
    tips: [
      "Revísalo al inicio de cada jornada para planificar tu día.",
    ],
  },
  {
    icon: BookOpen,
    titulo: "Mis Cursos",
    ruta: "/docente/cursos",
    texto:
      "Encuentra todos los programas que tienes asignados. Al entrar a un curso podrás gestionar sus módulos y lecciones, subir materiales, videos y ver las asignaciones entregadas por tus estudiantes.",
    tips: [
      "Sube materiales de apoyo desde cada lección para enriquecer la experiencia.",
      "Revisa periódicamente las asignaciones entregadas para retroalimentar a tiempo.",
    ],
  },
  {
    icon: Users,
    titulo: "Mis Grupos",
    ruta: "/docente/grupos",
    texto:
      "Consulta el listado de estudiantes inscritos en cada uno de tus programas. Podrás ver su progreso general, contactarlos y hacer seguimiento a quienes se están rezagando.",
    tips: [
      "Identifica estudiantes con bajo avance y bríndales acompañamiento oportuno.",
    ],
  },
  {
    icon: Video,
    titulo: "Clases en Vivo",
    ruta: "/docente/clases-vivo",
    texto:
      "Programa, edita e inicia tus sesiones sincrónicas. Las clases se realizan embebidas dentro de la Academia; solo debes hacer clic en «Iniciar» a la hora acordada.",
    tips: [
      "Programa la clase con al menos 24 horas de antelación para que los estudiantes reciban la notificación.",
      "Inicia la sesión 5 minutos antes para verificar audio, video y compartir pantalla.",
    ],
  },
  {
    icon: FileCheck,
    titulo: "Evaluaciones",
    ruta: "/docente/evaluaciones",
    texto:
      "Crea cuestionarios, exámenes y asignaciones para tus programas. Puedes definir el tiempo, los intentos permitidos y la nota mínima. El sistema califica automáticamente las preguntas de opción múltiple.",
    tips: [
      "Añade instrucciones claras al inicio de cada evaluación.",
      "Aprovecha el generador con IA para acelerar la creación de cuestionarios.",
    ],
  },
  {
    icon: ClipboardCheck,
    titulo: "Calificaciones",
    ruta: "/docente/calificaciones",
    texto:
      "Revisa y califica las entregas de tus estudiantes. Podrás dejar comentarios personalizados y publicar la nota final para que aparezca en el expediente del estudiante.",
    tips: [
      "Una retroalimentación breve y específica es más útil que una nota sola.",
    ],
  },
  {
    icon: MessagesSquare,
    titulo: "Comunidad",
    ruta: "/docente/comunidad",
    texto:
      "Interactúa con tus estudiantes mediante anuncios, respuestas a comentarios en lecciones y mensajes directos. Un canal activo mejora significativamente la experiencia del curso.",
    tips: [
      "Responde los comentarios al menos una vez al día para mantener la motivación del grupo.",
    ],
  },
  {
    icon: UserCog,
    titulo: "Mi Cuenta",
    ruta: "/docente/cuenta",
    texto:
      "Actualiza tu perfil profesional, foto, biografía y datos de contacto. Esta información se mostrará a los estudiantes en la ficha de tus programas.",
    tips: [
      "Una biografía completa y profesional genera confianza en tus estudiantes.",
    ],
  },
];

function InstructivoDocente() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/docente"><ArrowLeft className="mr-2 h-4 w-4" /> Volver a mi panel</Link>
        </Button>
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <HelpCircle className="h-3.5 w-3.5" /> Guía docente
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Bienvenido(a) al Panel Docente</h1>
            <p className="mt-3 text-muted-foreground">
              Sabemos que tu tiempo es valioso. Esta guía te muestra, sección por sección, cómo
              gestionar tus cursos, dictar clases en vivo, evaluar a tus estudiantes y mantener una
              comunidad viva alrededor de tus programas.
            </p>
          </div>
          <img
            src={heroImg}
            alt="Ilustración de docente dictando clases en línea"
            className="mx-auto w-48 rounded-2xl md:w-56"
            width={1024}
            height={1024}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recomendaciones iniciales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Completa tu perfil docente para inspirar confianza a tus estudiantes.</p>
          <p>• Familiarízate con la estructura de tus programas antes de programar la primera clase.</p>
          <p>• Usa Chrome o Edge actualizados para una mejor experiencia con las videollamadas embebidas.</p>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {secciones.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={s.titulo} className="overflow-hidden">
              <CardHeader className="bg-muted/30">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Paso {i + 1}</p>
                    <CardTitle className="text-lg">{s.titulo}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <p className="text-sm leading-relaxed">{s.texto}</p>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Buenas prácticas
                  </p>
                  <ul className="space-y-1 text-sm">
                    {s.tips.map((t) => (<li key={t}>• {t}</li>))}
                  </ul>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={s.ruta as never}>Ir a esta sección</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-2 pt-6 text-sm">
          <p className="font-semibold">Estamos a tu lado</p>
          <p className="text-muted-foreground">
            Si algo no funciona como esperas o tienes una sugerencia para mejorar la plataforma,
            escríbenos desde la sección de Comunidad. Tu experiencia como docente es tan importante
            como la de nuestros estudiantes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
