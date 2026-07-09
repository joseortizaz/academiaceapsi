import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, BookOpen, ClipboardCheck, Award, Receipt, UserCog,
  Video, MessageCircle, ArrowLeft, HelpCircle,
} from "lucide-react";
import heroImg from "@/assets/guide-student-hero.jpg";

export const Route = createFileRoute("/_authenticated/estudiante/instructivo")({
  head: () => ({
    meta: [
      { title: "Instructivo del estudiante | CEAPSI" },
      { name: "description", content: "Guía paso a paso para aprovechar tu panel de estudiante en la Academia CEAPSI." },
    ],
  }),
  component: InstructivoEstudiante,
});

const secciones = [
  {
    icon: LayoutDashboard,
    titulo: "Mi Aprendizaje",
    ruta: "/estudiante",
    texto:
      "Es tu página de inicio. Aquí verás un resumen de tu progreso, los próximos eventos, las clases en vivo programadas y los anuncios importantes que compartimos contigo.",
    tips: [
      "Revisa esta sección al iniciar sesión para no perder ninguna clase en vivo.",
      "Los avisos y anuncios aparecen destacados en la parte superior.",
    ],
  },
  {
    icon: BookOpen,
    titulo: "Mis Cursos",
    ruta: "/mis-cursos",
    texto:
      "Accede a todos los programas en los que estás inscrito(a). Al entrar a un curso encontrarás los módulos, las lecciones en video, los materiales descargables y las asignaciones que debes entregar.",
    tips: [
      "Marca cada lección como completada para llevar tu progreso al día.",
      "Descarga los materiales cuando los necesites; siempre estarán disponibles.",
      "Para entregar una asignación, sube tu archivo desde la lección correspondiente.",
    ],
  },
  {
    icon: Video,
    titulo: "Clases en Vivo",
    ruta: "/mis-cursos",
    texto:
      "Cuando una clase esté por iniciar, aparecerá un botón para unirte directamente desde la plataforma. No necesitas instalar nada extra: la clase se abre embebida en la Academia.",
    tips: [
      "Ingresa unos minutos antes para verificar tu audio y video.",
      "Si tu navegador no permite la videollamada embebida, se abrirá Zoom automáticamente.",
    ],
  },
  {
    icon: ClipboardCheck,
    titulo: "Evaluaciones",
    ruta: "/estudiante/evaluaciones",
    texto:
      "Aquí encontrarás los exámenes y cuestionarios asignados a tus cursos. Cada evaluación indica el tiempo disponible, la cantidad de intentos y la nota mínima para aprobar.",
    tips: [
      "Lee todas las instrucciones antes de comenzar.",
      "No cierres la ventana mientras rindes una evaluación con tiempo.",
    ],
  },
  {
    icon: Award,
    titulo: "Certificados",
    ruta: "/certificados",
    texto:
      "Al completar un programa y aprobar sus evaluaciones, tu certificado se generará automáticamente. Podrás descargarlo en PDF y compartir el enlace de verificación con quien lo solicite.",
    tips: [
      "Cada certificado tiene un código único para verificar su autenticidad.",
    ],
  },
  {
    icon: Receipt,
    titulo: "Mi Estado de Cuenta",
    ruta: "/estudiante/facturacion",
    texto:
      "Consulta tus pagos realizados, cuotas pendientes y descarga tus recibos. Si tienes alguna duda con un cargo, desde aquí puedes contactarnos.",
    tips: [
      "Mantén tus pagos al día para conservar el acceso a las clases en vivo.",
    ],
  },
  {
    icon: UserCog,
    titulo: "Mi Cuenta",
    ruta: "/estudiante/cuenta",
    texto:
      "Actualiza tu información personal, tu foto de perfil y tu contraseña. Es importante que tus datos estén correctos, ya que se usan en la emisión de certificados.",
    tips: [
      "Verifica que tu nombre y apellido estén escritos tal como quieres que aparezcan en el certificado.",
    ],
  },
  {
    icon: MessageCircle,
    titulo: "Notificaciones",
    ruta: "#",
    texto:
      "La campana en la parte superior derecha te avisa sobre nuevas clases, calificaciones publicadas, mensajes de tus docentes y anuncios de la Academia.",
    tips: [
      "Marca las notificaciones como leídas para mantener tu bandeja ordenada.",
    ],
  },
];

function InstructivoEstudiante() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/estudiante"><ArrowLeft className="mr-2 h-4 w-4" /> Volver a mi panel</Link>
        </Button>
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <HelpCircle className="h-3.5 w-3.5" /> Guía de uso
            </div>
            <h1 className="text-3xl font-bold tracking-tight">¡Bienvenido(a) a tu Academia!</h1>
            <p className="mt-3 text-muted-foreground">
              Preparamos esta guía para que aproveches al máximo cada sección de tu panel. Sabemos que
              empezar en una plataforma nueva puede ser abrumador, así que aquí encontrarás, paso a
              paso y con ejemplos, todo lo que necesitas para estudiar con tranquilidad.
            </p>
          </div>
          <img
            src={heroImg}
            alt="Ilustración de estudiante aprendiendo en línea"
            className="mx-auto w-48 rounded-2xl md:w-56"
            width={1024}
            height={1024}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Antes de comenzar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Usa un navegador actualizado (Chrome, Edge, Safari o Firefox).</p>
          <p>• Verifica que tu conexión a internet sea estable, especialmente para las clases en vivo.</p>
          <p>• Ten a mano tus datos de acceso; puedes recuperarlos desde la pantalla de inicio de sesión si los olvidas.</p>
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
                    Consejos útiles
                  </p>
                  <ul className="space-y-1 text-sm">
                    {s.tips.map((t) => (<li key={t}>• {t}</li>))}
                  </ul>
                </div>
                {s.ruta !== "#" && (
                  <Button asChild size="sm" variant="outline">
                    <Link to={s.ruta as never}>Ir a esta sección</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-2 pt-6 text-sm">
          <p className="font-semibold">¿Necesitas ayuda adicional?</p>
          <p className="text-muted-foreground">
            Estamos para acompañarte. Si tienes cualquier duda, escríbenos desde la sección de
            Contacto o responde a la notificación de tu docente. Queremos que tu experiencia de
            aprendizaje sea excelente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
