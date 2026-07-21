import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CertificatePreviewDialog } from "@/components/CertificatePreviewDialog";
import { buildVerifyUrl } from "@/lib/certificate-pdf";
import {
  ArrowLeft, CheckCircle2, Circle, Video, Download, Award, Lock, Radio,
} from "lucide-react";
import { LessonComments } from "@/components/LessonComments";
import { LessonMaterialsManager } from "@/components/LessonMaterialsManager";


export const Route = createFileRoute("/_authenticated/mis-cursos/$slug")({
  component: CursoPlayer,
});

function CursoPlayer() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [certPreviewOpen, setCertPreviewOpen] = useState(false);

  const { data: programa } = useQuery({
    queryKey: ["mc-programa", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("programs").select("*").eq("slug", slug).maybeSingle();
      return data;
    },
  });

  const { data: enrollment } = useQuery({
    queryKey: ["mc-enrollment", programa?.id, user?.id],
    enabled: !!programa?.id && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("*")
        .eq("programa_id", programa!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: modulos = [] } = useQuery({
    queryKey: ["mc-modulos", programa?.id],
    enabled: !!programa?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("program_modules")
        .select("*")
        .eq("programa_id", programa!.id)
        .order("orden");
      return data ?? [];
    },
  });

  const { data: courseModules = [] } = useQuery({
    queryKey: ["mc-course-modules", programa?.id],
    enabled: !!programa?.id && programa?.tipo === "diplomado",
    queryFn: async () => {
      const { data } = await (supabase.from as any)("course_modules")
        .select("id,titulo,orden")
        .eq("programa_id", programa!.id)
        .order("orden");
      return (data as { id: string; titulo: string; orden: number }[]) ?? [];
    },
  });

  const { data: progresos = [] } = useQuery({
    queryKey: ["mc-progress", enrollment?.id],
    enabled: !!enrollment?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("module_progress")
        .select("*")
        .eq("enrollment_id", enrollment!.id);
      return data ?? [];
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ["mc-links", programa?.id],
    enabled: !!programa?.id && enrollment?.estado === "activo",
    queryFn: async () => {
      const { data } = await supabase
        .from("program_access_links")
        .select("*")
        .eq("programa_id", programa!.id)
        .eq("activo", true);
      return data ?? [];
    },
  });

  const { data: certificate } = useQuery({
    queryKey: ["mc-cert", enrollment?.id],
    enabled: !!enrollment?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("certificates")
        .select("*")
        .eq("enrollment_id", enrollment!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: cohortInfo } = useQuery({
    queryKey: ["mc-cohort", enrollment?.id],
    enabled: !!enrollment?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("cohort_enrollments" as any)
        .select("cohort_id, program_cohorts:cohort_id ( fecha_inicio, nombre )")
        .eq("enrollment_id", enrollment!.id)
        .eq("estado", "activo")
        .maybeSingle();
      return (data as any) ?? null;
    },
  });

  const { data: liveMeetings = [] } = useQuery({
    queryKey: ["mc-zoom", programa?.id, user?.id],
    enabled: !!programa?.id && !!user?.id && enrollment?.estado === "activo",
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: ce } = await supabase
        .from("cohort_enrollments")
        .select("cohort_id")
        .eq("user_id", user!.id)
        .eq("estado", "activo");
      const myCohortIds = new Set((ce ?? []).map((r: any) => r.cohort_id));
      const { data } = await supabase
        .from("zoom_meetings_student" as never)
        .select("id,titulo,start_at,duration_min,status,zoom_meeting_id,docente_nombre,cohort_id,programa_id")
        .eq("programa_id", programa!.id)
        .order("start_at", { ascending: true });
      const rows = ((data ?? []) as any[]).filter(
        (r) => r.cohort_id == null || myCohortIds.has(r.cohort_id),
      );
      return rows;
    },
  });

  const now = Date.now();
  const liveNow = liveMeetings.find((c: any) => {
    const start = new Date(c.start_at).getTime();
    const end = start + (c.duration_min ?? 60) * 60 * 1000;
    return c.status === "live" || (now >= start - 5 * 60 * 1000 && now <= end);
  });
  const nextUpcoming = liveMeetings
    .filter((c: any) => c.status === "scheduled" && new Date(c.start_at).getTime() > now)
    .sort((a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

  const cohortStart: Date | null = useMemo(() => {
    const f = cohortInfo?.program_cohorts?.fecha_inicio;
    return f ? new Date(f + "T00:00:00") : null;
  }, [cohortInfo]);

  const progressMap = useMemo(
    () => new Map(progresos.map((p) => [p.modulo_id, p])),
    [progresos],
  );

  const isCompleted = enrollment?.estado === "completado";

  const getUnlockDate = (m: any): Date | null => {
    if (isCompleted) return null;
    if (
      m?.disponible_offset_dias !== null &&
      m?.disponible_offset_dias !== undefined &&
      cohortStart
    ) {
      const d = new Date(cohortStart);
      d.setDate(d.getDate() + Number(m.disponible_offset_dias));
      return d;
    }
    if (m?.disponible_desde) return new Date(m.disponible_desde);
    return null;
  };
  const isLocked = (m: any) => {
    const d = getUnlockDate(m);
    return !!d && d.getTime() > Date.now();
  };
  const formatFecha = (iso: string | Date) =>
    new Date(iso).toLocaleString("es-DO", {
      dateStyle: "long",
      timeStyle: "short",
    });

  const completados = progresos.filter((p) => p.completado).length;
  const total = modulos.length;
  const pct = total > 0 ? Math.round((completados / total) * 100) : 0;

  const activeModule =
    modulos.find((m) => m.id === activeModuleId) ?? modulos[0];

  const toggleComplete = async (moduloId: string) => {
    if (!enrollment) return;
    const existing = progressMap.get(moduloId);
    const nuevoEstado = !existing?.completado;
    try {
      if (existing) {
        await supabase
          .from("module_progress")
          .update({
            completado: nuevoEstado,
            fecha_completado: nuevoEstado ? new Date().toISOString() : null,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("module_progress").insert({
          enrollment_id: enrollment.id,
          modulo_id: moduloId,
          completado: nuevoEstado,
          fecha_completado: nuevoEstado ? new Date().toISOString() : null,
        });
      }
      // El porcentaje, estado y fecha_completado de la inscripción los
      // recalcula automáticamente un trigger en la base de datos.
      qc.invalidateQueries({ queryKey: ["mc-progress", enrollment.id] });
      qc.invalidateQueries({ queryKey: ["mc-enrollment", programa?.id, user?.id] });
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo actualizar el progreso");
    }
  };

  const emitirCertificado = async () => {
    if (!enrollment || !programa || !user || pct < 100) return;
    try {
      const { error } = await supabase.from("certificates").insert({
        user_id: user.id,
        programa_id: programa.id,
        enrollment_id: enrollment.id,
        numero_certificado: `CEAPSI-${new Date().getFullYear()}-${enrollment.id.slice(0, 8)}`,
        estado: "emitido",
      });
      if (error) throw error;
      toast.success("¡Certificado emitido!");
      qc.invalidateQueries({ queryKey: ["mc-cert", enrollment.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Solicita a un administrador la emisión del certificado");
    }
  };

  if (!programa) {
    return <div className="p-8 text-muted-foreground">Cargando…</div>;
  }
  if (!enrollment) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <p className="text-muted-foreground">No estás inscrito en este programa.</p>
        <Button asChild className="mt-4">
          <Link to="/programas/$slug" params={{ slug }}>Ver detalle</Link>
        </Button>
      </div>
    );
  }
  if (enrollment.estado === "pendiente") {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h2 className="text-xl font-bold">Pago pendiente</h2>
        <p className="mt-2 text-muted-foreground">
          Tu inscripción está registrada pero tu pago aún no ha sido verificado.
          Tendrás acceso al contenido en cuanto el equipo confirme tu pago.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/mis-cursos">Volver a mis cursos</Link>
        </Button>
      </div>
    );
  }
  if (programa.modalidad === "presencial") {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h2 className="text-xl font-bold">Programa presencial</h2>
        <p className="mt-2 text-muted-foreground">
          Este programa se dicta de forma presencial y no cuenta con campus virtual.
          Consulta con tu docente o coordinador el aula, horario y materiales del curso.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/mis-cursos">Volver a mis cursos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Button asChild size="sm" variant="ghost">
            <Link to="/mis-cursos">
              <ArrowLeft className="mr-2 h-4 w-4" /> Mis cursos
            </Link>
          </Button>
          <div className="hidden text-sm font-medium md:block">{programa.titulo}</div>
          <div className="flex items-center gap-3">
            {isCompleted && (
              <Badge variant="secondary" className="text-[11px]">Modo repaso</Badge>
            )}
            <span className="text-sm text-muted-foreground">{pct}%</span>
            <div className="hidden w-32 sm:block">
              <Progress value={pct} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-4 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-2">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Contenido
            </h2>
            {programa.tipo === "diplomado" && courseModules.length > 0 ? (
              <div className="mt-3 space-y-4">
                {courseModules.map((cm, ci) => {
                  const lecs = modulos.filter((m) => (m as any).modulo_id === cm.id);
                  const doneCount = lecs.filter((m) => progressMap.get(m.id)?.completado).length;
                  return (
                    <div key={cm.id}>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-foreground/70">
                        Módulo {ci + 1}: {cm.titulo}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {doneCount}/{lecs.length}
                        </span>
                      </p>
                      <ol className="space-y-1">
                        {lecs.map((m, i) => {
                          const done = progressMap.get(m.id)?.completado;
                          const isActive = activeModule?.id === m.id;
                          const locked = isLocked(m);
                          return (
                            <li key={m.id}>
                              <button
                                onClick={() => setActiveModuleId(m.id)}
                                className={`flex w-full items-start gap-2 rounded-md p-2 text-left text-sm transition ${
                                  isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                } ${locked ? "opacity-70" : ""}`}
                              >
                                {locked ? (
                                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                ) : done ? (
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                ) : (
                                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                )}
                                <span className="flex-1">
                                  <span className="font-medium">{i + 1}. {m.titulo}</span>
                                  {m.es_en_vivo && (
                                    <Video className="ml-1 inline h-3 w-3 text-primary" />
                                  )}
                                  {locked && (
                                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                      Disponible el {formatFecha(getUnlockDate(m)!)}
                                    </span>
                                  )}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  );
                })}
              </div>
            ) : (
              <ol className="mt-3 space-y-1">
                {modulos.map((m, i) => {
                  const done = progressMap.get(m.id)?.completado;
                  const isActive = activeModule?.id === m.id;
                  const locked = isLocked(m);
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => setActiveModuleId(m.id)}
                        className={`flex w-full items-start gap-2 rounded-md p-2 text-left text-sm transition ${
                          isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
                        } ${locked ? "opacity-70" : ""}`}
                      >
                        {locked ? (
                          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : done ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="flex-1">
                          <span className="font-medium">{i + 1}. {m.titulo}</span>
                          {m.es_en_vivo && (
                            <Video className="ml-1 inline h-3 w-3 text-primary" />
                          )}
                          {locked && (
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              Disponible el {formatFecha(getUnlockDate(m)!)}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {links.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Accesos del programa
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {links.map((l) => (
                  <li key={l.id}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {l.tipo}
                    </a>
                    {l.password && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        Clave: {l.password}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pct === 100 && programa.certificado_incluido && (
            <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-4 text-center">
              <Award className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-2 text-sm font-medium">¡Has completado el programa!</p>
              {certificate ? (
                <Button
                  className="mt-3 w-full"
                  size="sm"
                  onClick={() => setCertPreviewOpen(true)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Ver / descargar certificado
                </Button>
              ) : (
                <Button onClick={emitirCertificado} size="sm" className="mt-3 w-full">
                  Generar certificado
                </Button>
              )}
              {certificate && (
                <CertificatePreviewDialog
                  open={certPreviewOpen}
                  onOpenChange={setCertPreviewOpen}
                  data={{
                    studentName:
                      `${user?.nombre ?? ""} ${user?.apellido ?? ""}`.trim() || "Estudiante",
                    programTitle: programa.titulo,
                    programType: programa.tipo,
                    durationHours: programa.duracion_horas,
                    issueDate: certificate.fecha_emision,
                    verificationCode:
                      (certificate as any).verification_code ?? certificate.numero_certificado,
                    certificateNumber: certificate.numero_certificado,
                    verifyUrl: buildVerifyUrl(
                      (certificate as any).verification_code ?? certificate.numero_certificado,
                    ),
                  }}
                />
              )}
            </div>
          )}
        </aside>

        <main className="rounded-lg border bg-card p-6">
          {activeModule && isLocked(activeModule) ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <Lock className="h-10 w-10 text-muted-foreground" />
              </div>
              <h1 className="mt-4 text-2xl font-bold">{activeModule.titulo}</h1>
              <p className="mt-2 max-w-md text-muted-foreground">
                Esta lección aún no está disponible. Podrás acceder a su contenido a partir del{" "}
                <strong className="text-foreground">
                  {formatFecha(getUnlockDate(activeModule)!)}
                </strong>.
              </p>
            </div>
          ) : activeModule ? (
            <article>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold">{activeModule.titulo}</h1>
                  {activeModule.es_en_vivo && (
                    <Badge variant="outline" className="mt-2 gap-1">
                      <Video className="h-3 w-3" /> Sesión en vivo
                    </Badge>
                  )}
                </div>
                <Button
                  variant={progressMap.get(activeModule.id)?.completado ? "outline" : "default"}
                  onClick={() => toggleComplete(activeModule.id)}
                >
                  {progressMap.get(activeModule.id)?.completado
                    ? "Marcar como pendiente"
                    : "Marcar completado"}
                </Button>
              </div>

              {activeModule.video_url && (() => {
                const raw = activeModule.video_url.trim();
                const isYouTube = /youtube\.com|youtu\.be/.test(raw);
                const isVimeo = /vimeo\.com/.test(raw);
                let embedSrc = raw;
                if (isYouTube) {
                  const idMatch =
                    raw.match(/[?&]v=([^&]+)/) ||
                    raw.match(/youtu\.be\/([^?&]+)/) ||
                    raw.match(/embed\/([^?&]+)/);
                  if (idMatch) embedSrc = `https://www.youtube.com/embed/${idMatch[1]}`;
                } else if (isVimeo && !/player\.vimeo\.com/.test(raw)) {
                  const m = raw.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/);
                  if (m) embedSrc = `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ""}`;
                }
                return (
                  <div className="mx-auto mb-6 w-full max-w-3xl">
                    <div
                      className="relative w-full overflow-hidden rounded-lg bg-black"
                      style={{ paddingBottom: "56.25%" }}
                    >
                      {isYouTube || isVimeo ? (
                        <iframe
                          key={`${activeModule.id}-${embedSrc}`}
                          src={embedSrc}
                          title={activeModule.titulo}
                          allowFullScreen
                          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                          referrerPolicy="strict-origin-when-cross-origin"
                          className="absolute inset-0 h-full w-full border-0"
                        />
                      ) : (
                        <video
                          key={activeModule.id}
                          controls
                          preload="metadata"
                          src={embedSrc}
                          className="absolute inset-0 h-full w-full object-contain"
                        />
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      ¿No se ve el video?{" "}
                      <a
                        href={raw}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Abrir en una pestaña nueva
                      </a>
                    </p>
                  </div>
                );
              })()}

              {activeModule.audio_url && (
                <div className="mb-6 rounded-lg border bg-muted/30 p-4">
                  <p className="mb-2 text-sm font-medium">🎧 Audio de la lección</p>
                  <audio controls src={activeModule.audio_url} className="w-full" />
                </div>
              )}

              {activeModule.descripcion && (
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/90">
                  {activeModule.descripcion}
                </div>
              )}

              <div className="mt-6">
                <h4 className="mb-2 text-sm font-semibold">Material complementario</h4>
                <LessonMaterialsManager
                  moduloId={activeModule.id}
                  programaId={programa.id}
                  editable={false}
                />
              </div>


              {activeModule.fecha_sesion && (
                <p className="mt-4 text-sm text-muted-foreground">
                  📅 Sesión en vivo:{" "}
                  {new Date(activeModule.fecha_sesion).toLocaleString("es-DO")}
                </p>
              )}

              <LessonComments
                moduloId={activeModule.id}
                programaId={programa.id}
                docenteId={activeModule.docente_id ?? programa.docente_id}
              />
            </article>
          ) : (
            <p className="text-muted-foreground">Selecciona un módulo para comenzar.</p>
          )}
        </main>
      </div>
    </div>
  );
}
