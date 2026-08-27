import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listZoomMeetings } from "@/lib/zoom.functions";
import {
  Users, BookOpen, ClipboardCheck, MessageCircle, Video, Calendar, ArrowRight, PlayCircle, Radio,
} from "lucide-react";


export const Route = createFileRoute("/_authenticated/docente/")({
  component: DocenteResumen,
});


function DocenteResumen() {
  const { user } = useAuth();
  const { teacher, programas, totalAlumnos } = useTeacherPrograms();


  const listMeetingsFn = useServerFn(listZoomMeetings);
  type MeetingRow = {
    id: string;
    titulo: string;
    start_at: string;
    duration_min: number;
    status: "scheduled" | "live" | "ended" | "recorded";
    zoom_start_url: string | null;
    cohort?: { nombre: string } | null;
  };
  const { data: meetings = [] } = useQuery<MeetingRow[]>({
    queryKey: ["docente-zoom-meetings"],
    queryFn: async () => (await listMeetingsFn({ data: {} })) as MeetingRow[],
    refetchInterval: 30_000,
  });

  const now = Date.now();
  const isLiveNow = (m: MeetingRow) => {
    const start = new Date(m.start_at).getTime();
    const end = start + m.duration_min * 60 * 1000;
    return now >= start - 5 * 60 * 1000 && now <= end;
  };
  const proximas = meetings
    .filter((m) => m.status !== "ended" && m.status !== "recorded")
    .filter((m) => isLiveNow(m) || new Date(m.start_at).getTime() >= now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 5);


  const cursosActivos = programas.filter((p) => p.estado === "publicado" || p.estado === "en_curso").length;
  const totalAlumnos = enrollments.length;

  const kpis = [
    { label: "Alumnos asignados", value: totalAlumnos, icon: Users, color: "text-blue-600" },
    { label: "Cursos activos", value: cursosActivos, icon: BookOpen, color: "text-emerald-600" },
    { label: "Calificaciones por revisar", value: 0, icon: ClipboardCheck, color: "text-amber-600" },
    { label: "Mensajes pendientes", value: 0, icon: MessageCircle, color: "text-rose-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bienvenido, {teacher?.nombre ?? user?.nombre}</h1>
        <p className="text-muted-foreground">Aquí tienes un resumen de tu actividad docente.</p>
      </div>

      {!teacher && (
        <div className="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground">
          Tu cuenta aún no está vinculada a un perfil de docente. Solicita al administrador que asocie tu usuario.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{k.label}</p>
                <k.icon className={`h-5 w-5 ${k.color}`} />
              </div>
              <p className="mt-2 text-3xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Tareas pendientes</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link to="/docente/calificaciones">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">No tienes tareas pendientes por ahora.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Próximas clases en vivo</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link to="/docente/clases-vivo">Gestionar <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {proximas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tienes sesiones programadas próximamente.</p>
            ) : proximas.map((m) => {
              const live = isLiveNow(m) || m.status === "live";
              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{m.titulo}</p>
                      {live && (
                        <Badge className="animate-pulse bg-red-500/15 text-red-700 hover:bg-red-500/15">
                          <Radio className="mr-1 h-3 w-3" /> En vivo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.start_at).toLocaleString("es-DO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {m.cohort?.nombre ? ` · ${m.cohort.nombre}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant={live ? "default" : "outline"}>
                      <Link to="/clase-vivo/$meetingId" params={{ meetingId: m.id }}>
                        <PlayCircle className="mr-1 h-3 w-3" /> Iniciar clase
                      </Link>
                    </Button>
                    <Badge variant="outline" className="gap-1 hidden sm:inline-flex"><Video className="h-3 w-3" /> Zoom</Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
