import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RecordingPlayer } from "@/components/RecordingPlayer";
import {
  BookOpen, CheckCircle2, Clock, PlayCircle, Calendar, Megaphone, ArrowRight,
  Radio, Video, FileVideo,
} from "lucide-react";

type ZoomMeetingLite = {
  id: string;
  titulo: string;
  start_at: string;
  duration_min: number;
  status: "scheduled" | "live" | "ended" | "recorded";
  zoom_meeting_id: string;
  docente_nombre: string | null;
  recording_share_url: string | null;
  recording_duration_min: number | null;
  programa_id: string;
  cohort_id: string | null;
  cohort_nombre: string | null;
};

function isLiveZoom(c: ZoomMeetingLite) {
  const start = new Date(c.start_at).getTime();
  const end = start + c.duration_min * 60 * 1000;
  const now = Date.now();
  return c.status === "live" || (now >= start - 5 * 60 * 1000 && now <= end);
}

export const Route = createFileRoute("/_authenticated/estudiante/")({
  component: EstudianteDashboard,
});

function EstudianteDashboard() {
  const { user } = useAuth();

  const { data: zoomClasses = [] } = useQuery({
    queryKey: ["estudiante-zoom-meetings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Cohorts activos del estudiante
      const { data: ce } = await supabase
        .from("cohort_enrollments")
        .select("cohort_id")
        .eq("user_id", user!.id)
        .eq("estado", "activo");
      const myCohortIds = new Set((ce ?? []).map((r) => r.cohort_id));

      const { data } = await supabase
        .from("zoom_meetings_student" as never)
        .select("id,titulo,start_at,duration_min,status,zoom_meeting_id,docente_nombre,recording_share_url,recording_duration_min,programa_id,cohort_id,cohort_nombre")
        .order("start_at", { ascending: false });
      const rows = (data ?? []) as ZoomMeetingLite[];
      // Sin cohort_id => visible a todo el programa. Con cohort_id => solo si el alumno pertenece.
      return rows.filter((r) => r.cohort_id == null || myCohortIds.has(r.cohort_id));
    },
    refetchInterval: 30_000,
  });


  const liveZoomClass = zoomClasses.find(isLiveZoom);
  const upcomingZoom = zoomClasses
    .filter((c) => c.status === "scheduled" && new Date(c.start_at).getTime() > Date.now())
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];
  const recordedZoom = zoomClasses.filter((c) => c.status === "recorded").slice(0, 4);
  const [playing, setPlaying] = useState<ZoomMeetingLite | null>(null);


  const { data } = useQuery({
    queryKey: ["estudiante-dash", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [enrolls, certs, announcements] = await Promise.all([
        supabase.from("enrollments").select("*").eq("user_id", user!.id)
          .order("fecha_inscripcion", { ascending: false }),
        supabase.from("certificates").select("*").eq("user_id", user!.id),
        supabase.from("announcements").select("*").eq("activo", true)
          .order("fecha_publicacion", { ascending: false }).limit(3),
      ]);
      const programaIds = (enrolls.data ?? []).map((e) => e.programa_id);
      const programs = programaIds.length
        ? (await supabase.from("programs")
            .select("id,titulo,slug,imagen_url,duracion_horas,fecha_inicio")
            .in("id", programaIds)).data ?? []
        : [];
      const pmap = new Map(programs.map((p) => [p.id, p]));

      const liveSessions = programaIds.length
        ? (await supabase.from("program_modules")
            .select("id,titulo,fecha_sesion,programa_id")
            .in("programa_id", programaIds)
            .eq("es_en_vivo", true)
            .gte("fecha_sesion", new Date().toISOString())
            .order("fecha_sesion", { ascending: true })
            .limit(5)).data ?? []
        : [];

      return {
        enrollments: (enrolls.data ?? []).map((e) => ({ ...e, programa: pmap.get(e.programa_id) })),
        certificates: certs.data ?? [],
        announcements: announcements.data ?? [],
        liveSessions: liveSessions.map((s) => ({ ...s, programa: pmap.get(s.programa_id) })),
      };
    },
  });

  // Evaluaciones y tareas publicadas de sus programas
  const { data: tareas = [] } = useQuery({
    queryKey: ["estudiante-dash-assessments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: enrolls } = await supabase
        .from("enrollments")
        .select("programa_id")
        .eq("user_id", user!.id)
        .in("estado", ["activo", "completado"]);
      const ids = (enrolls ?? []).map((e) => e.programa_id);
      if (ids.length === 0) return [];

      const [{ data: assess }, { data: subs }] = await Promise.all([
        supabase
          .from("assessments")
          .select("id,titulo,tipo,fecha_limite,puntaje_maximo,programa_id,programs(titulo)")
          .eq("publicado", true)
          .in("programa_id", ids)
          .order("created_at", { ascending: false }),
        supabase
          .from("assessment_submissions")
          .select("assessment_id,estado,porcentaje")
          .eq("user_id", user!.id),
      ]);
      const subMap = new Map((subs ?? []).map((s) => [s.assessment_id, s]));
      return (assess ?? []).map((a: any) => ({
        ...a,
        entrega: subMap.get(a.id) ?? null,
      }));
    },
  });

  const tareasPendientes = tareas.filter((t: any) => !t.entrega);

  const enrollments = data?.enrollments ?? [];
  const activos = enrollments.filter((e) => e.estado === "activo");
  const finalizados = enrollments.filter((e) => e.estado === "completado");
  const horasTotales = enrollments.reduce(
    (s, e) => s + Math.round(((e.programa?.duracion_horas ?? 0) * (e.progreso_porcentaje ?? 0)) / 100),
    0,
  );
  const ultimoCurso = activos
    .slice()
    .sort((a, b) => (b.progreso_porcentaje ?? 0) - (a.progreso_porcentaje ?? 0))[0]
    ?? activos[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">¡Hola, {user?.nombre}! 👋</h1>
          <p className="text-muted-foreground">Aquí tienes el resumen de tu aprendizaje.</p>
        </div>
        <NextLiveClassWidget live={liveZoomClass} upcoming={upcomingZoom} />
      </div>

      {liveZoomClass && <LiveZoomBanner cls={liveZoomClass} />}
      {!liveZoomClass && upcomingZoom && <UpcomingZoomCountdown cls={upcomingZoom} />}



      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Cursos en curso"
          value={activos.length}
          icon={PlayCircle}
          accent="bg-blue-500/10 text-blue-600"
        />
        <StatCard
          label="Cursos finalizados"
          value={finalizados.length}
          icon={CheckCircle2}
          accent="bg-emerald-500/10 text-emerald-600"
        />
        <StatCard
          label="Horas de estudio"
          value={`${horasTotales}h`}
          icon={Clock}
          accent="bg-amber-500/10 text-amber-600"
        />
      </div>

      {/* Continue learning */}
      {ultimoCurso?.programa?.slug && (
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
          <div className="grid gap-0 md:grid-cols-[260px_1fr]">
            <div className="aspect-video bg-muted md:aspect-auto">
              {ultimoCurso.programa.imagen_url ? (
                <img
                  src={ultimoCurso.programa.imagen_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-primary/30">
                  <BookOpen className="h-16 w-16" />
                </div>
              )}
            </div>
            <div className="flex flex-col justify-between gap-4 p-6">
              <div>
                <Badge variant="outline" className="mb-2">Continuar aprendiendo</Badge>
                <h2 className="text-xl font-bold leading-tight">
                  {ultimoCurso.programa.titulo}
                </h2>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">Tu progreso</span>
                    <span className="font-semibold">{ultimoCurso.progreso_porcentaje ?? 0}%</span>
                  </div>
                  <Progress value={ultimoCurso.progreso_porcentaje ?? 0} className="h-2.5" />
                </div>
              </div>
              <Button asChild size="lg" className="self-start">
                <Link to="/mis-cursos/$slug" params={{ slug: ultimoCurso.programa.slug }}>
                  <PlayCircle className="mr-2 h-5 w-5" /> Reanudar clase
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Mis cursos resumido */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Mis cursos activos</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/mis-cursos">
                Ver todos <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {activos.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                Aún no estás inscrito en ningún programa activo.
                <div className="mt-3">
                  <Button asChild size="sm">
                    <Link to="/programas">Explorar catálogo</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {activos.slice(0, 4).map((e) => (
                  <li key={e.id}>
                    {e.programa?.slug ? (
                      <Link
                        to="/mis-cursos/$slug"
                        params={{ slug: e.programa.slug }}
                        className="flex items-center gap-3 rounded-md p-2 transition hover:bg-muted/50"
                      >
                        <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-muted">
                          {e.programa?.imagen_url && (
                            <img src={e.programa.imagen_url} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{e.programa?.titulo}</p>
                          <Progress value={e.progreso_porcentaje ?? 0} className="mt-1.5 h-1.5" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {e.progreso_porcentaje ?? 0}%
                        </span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 rounded-md p-2 opacity-70">
                        <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-muted" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">Curso temporalmente no disponible</p>
                          <Progress value={e.progreso_porcentaje ?? 0} className="mt-1.5 h-1.5" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {e.progreso_porcentaje ?? 0}%
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Agenda */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-primary" /> Próximas clases
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.liveSessions ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin sesiones en vivo programadas.
              </p>
            ) : (
              <ul className="space-y-3">
                {data!.liveSessions.map((s) => (
                  <li key={s.id} className="flex gap-3 border-l-2 border-primary pl-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.programa?.titulo}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-primary">
                        {new Date(s.fecha_sesion!).toLocaleString("es-DO", {
                          weekday: "short", day: "2-digit", month: "short",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evaluaciones y tareas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-primary" /> Evaluaciones y tareas
            {tareasPendientes.length > 0 && (
              <Badge variant="destructive">{tareasPendientes.length} pendiente{tareasPendientes.length > 1 ? "s" : ""}</Badge>
            )}
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/estudiante/evaluaciones">
              Ver todas <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {tareas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no tienes evaluaciones o tareas asignadas.
            </p>
          ) : (
            <ul className="divide-y">
              {tareas.slice(0, 5).map((t: any) => {
                const vencido = t.fecha_limite && new Date(t.fecha_limite) < new Date();
                return (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.programs?.titulo}
                        {t.fecha_limite
                          ? ` · Límite: ${new Date(t.fecha_limite).toLocaleDateString("es-DO")}`
                          : ""}
                      </p>
                    </div>
                    {t.entrega ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">
                        {t.entrega.estado === "calificado" ? `Calificado: ${t.entrega.porcentaje}%` : "En revisión"}
                      </Badge>
                    ) : vencido ? (
                      <Badge variant="destructive">Vencido</Badge>
                    ) : (
                      <Badge variant="secondary">Pendiente</Badge>
                    )}
                    <Button asChild size="sm" variant={t.entrega ? "outline" : "default"}>
                      <Link
                        to="/estudiante/evaluaciones"
                        search={{ assessmentId: t.id, returnTo: undefined }}
                      >
                        {t.entrega ? "Ver entrega" : "Comenzar"}
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {recordedZoom.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileVideo className="h-4 w-4 text-primary" /> Grabaciones recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {recordedZoom.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.titulo}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.docente_nombre ?? ""}{c.recording_duration_min ? ` · ${c.recording_duration_min} min` : ""} · {new Date(c.start_at).toLocaleDateString("es-DO")}
                    </p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">
                    Grabación disponible
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => setPlaying(c)}>
                    <PlayCircle className="mr-1 h-3 w-3" /> Ver
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!playing} onOpenChange={(o) => !o && setPlaying(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{playing?.titulo}</DialogTitle>
          </DialogHeader>
          {playing && (
            <RecordingPlayer
              meetingRowId={playing.id}
              fallbackUrl={playing.recording_share_url}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Anuncios */}
      {(data?.announcements ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-primary" /> Anuncios recientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data!.announcements.map((a) => (
              <article key={a.id} className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{a.titulo}</h3>
                  <Badge variant="outline" className="capitalize">{a.tipo}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.contenido}</p>
              </article>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, accent,
}: { label: string; value: number | string; icon: any; accent: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-lg p-3 ${accent}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function NextLiveClassWidget({
  live, upcoming,
}: { live?: ZoomMeetingLite; upcoming?: ZoomMeetingLite }) {
  const cls = live ?? upcoming;
  if (!cls) {
    return (
      <div className="hidden min-w-[260px] rounded-lg border bg-card p-3 text-sm shadow-sm sm:block">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Video className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Próxima clase en vivo</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Sin sesiones programadas.</p>
      </div>
    );
  }
  const isLive = !!live;
  return (
    <div className={`min-w-[260px] rounded-lg border p-3 text-sm shadow-sm ${isLive ? "border-red-500/40 bg-red-500/5" : "border-primary/30 bg-primary/5"}`}>
      <div className="flex items-center gap-2">
        {isLive ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wide text-red-600">En vivo ahora</span>
          </>
        ) : (
          <>
            <Video className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">Próxima clase en vivo</span>
          </>
        )}
      </div>
      <p className="mt-1 truncate text-sm font-semibold">{cls.titulo}</p>
      <p className="truncate text-xs text-muted-foreground">
        {new Date(cls.start_at).toLocaleString("es-DO", {
          weekday: "short", day: "2-digit", month: "short",
          hour: "2-digit", minute: "2-digit",
        })}
      </p>
      {isLive ? (
        <Button asChild size="sm" className="mt-2 w-full bg-red-600 hover:bg-red-700">
          <Link to="/clase-vivo/$meetingId" params={{ meetingId: cls.id }}>
            <Radio className="mr-1 h-3 w-3" /> Unirse
          </Link>
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline" className="mt-2 w-full">
          <Link to="/clase-vivo/$meetingId" params={{ meetingId: cls.id }}>
            <Video className="mr-1 h-3 w-3" /> Unirse a la clase
          </Link>
        </Button>
      )}
    </div>
  );
}

function LiveZoomBanner({ cls }: { cls: ZoomMeetingLite }) {
  return (
    <Card className="border-red-500/40 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-red-500 text-white hover:bg-red-500">EN VIVO AHORA</Badge>
              <span className="text-sm font-semibold">{cls.titulo}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {cls.docente_nombre ?? ""} · ID Zoom {cls.zoom_meeting_id}
            </p>
          </div>
        </div>
        <Button asChild size="lg" className="bg-red-600 hover:bg-red-700">
          <Link to="/clase-vivo/$meetingId" params={{ meetingId: cls.id }}>
            <Radio className="mr-2 h-4 w-4" /> Unirse a la clase
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function UpcomingZoomCountdown({ cls }: { cls: ZoomMeetingLite }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, new Date(cls.start_at).getTime() - now);
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/15 p-3 text-primary">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Próxima clase en vivo</p>
            <p className="text-xs text-muted-foreground">
              {cls.titulo}{cls.docente_nombre ? ` · ${cls.docente_nombre}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <TimeBox label="d" value={days} />
          <span className="text-xl font-bold text-primary">:</span>
          <TimeBox label="h" value={hours} />
          <span className="text-xl font-bold text-primary">:</span>
          <TimeBox label="m" value={minutes} />
          <span className="text-xl font-bold text-primary">:</span>
          <TimeBox label="s" value={seconds} />
        </div>
      </CardContent>
    </Card>
  );
}

function TimeBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[44px] flex-col items-center rounded-md bg-card px-2 py-1 shadow-sm">
      <span className="text-lg font-bold tabular-nums">{String(value).padStart(2, "0")}</span>
      <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
    </div>
  );
}

