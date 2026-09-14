import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ClipboardCheck, CheckCircle2, Trophy, FileText, Clock, Loader2, ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FileUploader } from "@/components/FileUploader";

export const Route = createFileRoute("/_authenticated/estudiante/evaluaciones")({
  validateSearch: (search: Record<string, unknown>) => ({
    assessmentId:
      typeof search.assessmentId === "string" ? search.assessmentId : undefined,
    returnTo:
      typeof search.returnTo === "string" && search.returnTo.startsWith("/")
        ? search.returnTo
        : undefined,
  }),
  component: Evaluaciones,
});


type Assessment = {
  id: string;
  programa_id: string;
  titulo: string;
  descripcion: string | null;
  instrucciones: string | null;
  tipo: "examen" | "quiz" | "tarea";
  puntaje_maximo: number;
  duracion_minutos: number | null;
  fecha_limite: string | null;
  programs?: { titulo: string; slug: string } | null;
};

type Question = {
  id: string;
  enunciado: string;
  tipo: "opcion_multiple" | "verdadero_falso" | "respuesta_corta" | "desarrollo";
  opciones: string[] | null;
  puntaje: number;
  orden: number;
};

type Submission = {
  id: string;
  assessment_id: string;
  puntaje_obtenido: number | null;
  puntaje_maximo: number | null;
  porcentaje: number | null;
  estado: "entregado" | "calificado" | "revision";
  feedback: string | null;
  fecha_entrega: string;
  auto_calificado: boolean;
  respuestas?: Record<string, unknown> | null;
};

const tipoLabel: Record<string, string> = {
  examen: "Examen", quiz: "Quiz", tarea: "Tarea",
};

function Evaluaciones() {
  const { user } = useAuth();
  const { assessmentId, returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const [active, setActive] = useState<Assessment | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);

  const goBackToCourse = () => {
    if (returnTo) navigate({ to: returnTo } as never);
  };


  const enrollmentsQ = useQuery({
    queryKey: ["student-enrollments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("programa_id")
        .eq("user_id", user!.id)
        .in("estado", ["activo", "completado"]);
      if (error) throw error;
      return data.map((e) => e.programa_id);
    },
  });

  const assessmentsQ = useQuery({
    queryKey: ["student-assessments", enrollmentsQ.data],
    enabled: !!enrollmentsQ.data && enrollmentsQ.data.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("id, programa_id, titulo, descripcion, instrucciones, tipo, puntaje_maximo, duracion_minutos, fecha_limite, programs(titulo, slug)")
        .eq("publicado", true)
        .in("programa_id", enrollmentsQ.data!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Assessment[];
    },
  });

  const submissionsQ = useQuery({
    queryKey: ["student-submissions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_submissions")
        .select("id, assessment_id, puntaje_obtenido, puntaje_maximo, porcentaje, estado, feedback, fecha_entrega, auto_calificado, respuestas")
        .eq("user_id", user!.id)
        .order("fecha_entrega", { ascending: false });
      if (error) throw error;
      return data as Submission[];
    },
  });

  const submissionsByAssessment = useMemo(() => {
    const m = new Map<string, Submission>();
    (submissionsQ.data ?? []).forEach((s) => {
      if (!m.has(s.assessment_id)) m.set(s.assessment_id, s);
    });
    return m;
  }, [submissionsQ.data]);

  const historial = useMemo(() => {
    const assessments = assessmentsQ.data ?? [];
    return (submissionsQ.data ?? []).map((s) => ({
      submission: s,
      assessment: assessments.find((a) => a.id === s.assessment_id),
    }));
  }, [submissionsQ.data, assessmentsQ.data]);

  const loading = enrollmentsQ.isLoading || assessmentsQ.isLoading;

  // Abre automáticamente la evaluación indicada en la URL (?assessmentId=...)
  useEffect(() => {
    if (autoOpened || !assessmentId) return;
    const found = (assessmentsQ.data ?? []).find((a) => a.id === assessmentId);
    if (found) {
      setActive(found);
      setAutoOpened(true);
    }
  }, [assessmentId, assessmentsQ.data, autoOpened]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evaluaciones y Tareas</h1>
          <p className="text-muted-foreground">
            Realiza tus evaluaciones publicadas y revisa tus calificaciones.
          </p>
        </div>
        {returnTo && (
          <Button variant="outline" size="sm" onClick={goBackToCourse}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al curso
          </Button>
        )}
      </div>

      {active ? (
        <AssessmentPlayer
          assessment={active}
          previous={submissionsByAssessment.get(active.id) ?? null}
          onExit={() => {
            setActive(null);
            if (returnTo) goBackToCourse();
          }}
        />
      ) : (

        <>
          <section>
            <h2 className="mb-3 text-lg font-bold">Disponibles</h2>
            {loading ? (
              <Card><CardContent className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>
            ) : enrollmentsQ.error || assessmentsQ.error ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <ClipboardCheck className="h-10 w-10 text-destructive" />
                  <p className="font-medium">No pudimos cargar tus evaluaciones</p>
                  <p className="text-sm text-muted-foreground">
                    Vuelve a intentarlo en unos minutos o escribe a soporte.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => { enrollmentsQ.refetch(); assessmentsQ.refetch(); }}>
                    Reintentar
                  </Button>
                </CardContent>
              </Card>
            ) : (assessmentsQ.data?.length ?? 0) === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <ClipboardCheck className="h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">No tienes evaluaciones disponibles</p>
                  <p className="text-sm text-muted-foreground">
                    Cuando tus docentes publiquen evaluaciones o tareas, aparecerán aquí.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {assessmentsQ.data!.map((a) => {
                  const sub = submissionsByAssessment.get(a.id);
                  const vencido = a.fecha_limite && new Date(a.fecha_limite) < new Date();
                  return (
                    <Card key={a.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{a.titulo}</CardTitle>
                          <Badge variant="outline">{tipoLabel[a.tipo]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{a.programs?.titulo}</p>
                        {a.descripcion && <p className="text-sm text-muted-foreground line-clamp-2">{a.descripcion}</p>}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>Puntaje: {a.puntaje_maximo}</span>
                          {a.duracion_minutos && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{a.duracion_minutos} min</span>}
                          {a.fecha_limite && (
                            <span className={vencido ? "text-destructive font-medium" : ""}>
                              Límite: {new Date(a.fecha_limite).toLocaleDateString("es-DO")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          {sub ? (
                            <Badge className={sub.estado === "calificado" ? "bg-emerald-600 hover:bg-emerald-600" : "bg-amber-500 hover:bg-amber-500"}>
                              {sub.estado === "calificado"
                                ? `Calificado: ${sub.porcentaje}%`
                                : "En revisión"}
                            </Badge>
                          ) : vencido ? (
                            <Badge variant="destructive">Vencido</Badge>
                          ) : (
                            <Badge variant="secondary">Pendiente</Badge>
                          )}
                          <Button size="sm" onClick={() => setActive(a)}>
                            {sub ? "Ver entrega" : "Comenzar"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-amber-500" /> Historial de calificaciones
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {historial.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Aún no has entregado evaluaciones.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Evaluación</TableHead>
                        <TableHead>Curso</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Nota</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historial.map(({ submission, assessment }) => (
                        <TableRow key={submission.id}>
                          <TableCell className="font-medium">{assessment?.titulo ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{assessment?.programs?.titulo ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(submission.fecha_entrega).toLocaleDateString("es-DO")}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {submission.porcentaje != null ? `${submission.porcentaje}%` : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={submission.estado === "calificado" ? "default" : "secondary"}
                              className={submission.estado === "calificado" ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20" : ""}
                            >
                              {submission.estado === "calificado" ? "Calificado" : "En revisión"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function AssessmentPlayer({
  assessment, previous, onExit,
}: { assessment: Assessment; previous: Submission | null; onExit: () => void }) {
  const qc = useQueryClient();
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [archivoUrl, setArchivoUrl] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const readOnly = !!previous;
  const prevArchivo =
    typeof previous?.respuestas?.["archivo_url"] === "string"
      ? (previous!.respuestas!["archivo_url"] as string)
      : null;
  const prevComentario =
    typeof previous?.respuestas?.["comentario"] === "string"
      ? (previous!.respuestas!["comentario"] as string)
      : "";

  const questionsQ = useQuery({
    queryKey: ["assessment-questions", assessment.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_assessment_questions_for_student", {
        _assessment_id: assessment.id,
      });
      if (error) throw error;
      return (data ?? []).map((q: {
        id: string; enunciado: string; tipo: string; opciones: unknown;
        puntaje: number; orden: number;
      }) => ({
        id: q.id,
        enunciado: q.enunciado,
        tipo: q.tipo as Question["tipo"],
        opciones: Array.isArray(q.opciones) ? (q.opciones as string[]) : null,
        puntaje: q.puntaje,
        orden: q.orden,
      })) as Question[];
    },
  });

  const handleSubmit = async () => {
    const questions = questionsQ.data ?? [];
    const missing = questions.filter((q) => !respuestas[q.id] || respuestas[q.id].trim() === "");
    if (missing.length > 0) {
      toast.error(`Debes responder todas las preguntas (${missing.length} pendiente${missing.length > 1 ? "s" : ""}).`);
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("submit_assessment", {
        _assessment_id: assessment.id,
        _respuestas: respuestas,
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.auto_calificado) {
        toast.success(`¡Entregado! Calificación: ${result.porcentaje}%`);
      } else {
        toast.success("¡Entrega enviada! Tu docente la revisará pronto.");
      }
      await qc.invalidateQueries({ queryKey: ["student-submissions"] });
      onExit();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{assessment.titulo}</CardTitle>
            <p className="text-sm text-muted-foreground">{assessment.programs?.titulo}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onExit}>Volver</Button>
        </div>
        {assessment.instrucciones && (
          <div className="mt-2 rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium flex items-center gap-1"><FileText className="h-4 w-4" /> Instrucciones</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{assessment.instrucciones}</p>
          </div>
        )}
        {previous && (
          <div className="mt-2 rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Ya entregaste esta evaluación</p>
            <p className="text-muted-foreground">
              {previous.estado === "calificado"
                ? `Nota: ${previous.porcentaje}% (${previous.puntaje_obtenido}/${previous.puntaje_maximo})`
                : "Pendiente de revisión por tu docente."}
            </p>
            {previous.feedback && (
              <div className="mt-2">
                <p className="font-medium">Retroalimentación:</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{previous.feedback}</p>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {questionsQ.isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {questionsQ.data?.map((q, i) => (
          <div key={q.id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{i + 1}. {q.enunciado}</p>
              <Badge variant="outline" className="shrink-0">{q.puntaje} pts</Badge>
            </div>

            {q.tipo === "opcion_multiple" && q.opciones && (
              <div className="grid gap-2">
                {q.opciones.map((op, j) => {
                  const selected = respuestas[q.id] === op;
                  return (
                    <button
                      key={j}
                      type="button"
                      disabled={readOnly}
                      onClick={() => setRespuestas({ ...respuestas, [q.id]: op })}
                      className={cn(
                        "flex items-center justify-between rounded-md border p-3 text-left text-sm transition",
                        selected && "border-primary bg-primary/5",
                        !readOnly && !selected && "hover:bg-muted/50",
                        readOnly && "opacity-60",
                      )}
                    >
                      <span>{op}</span>
                      {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}

            {q.tipo === "verdadero_falso" && (
              <div className="grid grid-cols-2 gap-2">
                {["Verdadero", "Falso"].map((op) => {
                  const selected = respuestas[q.id] === op;
                  return (
                    <button
                      key={op}
                      type="button"
                      disabled={readOnly}
                      onClick={() => setRespuestas({ ...respuestas, [q.id]: op })}
                      className={cn(
                        "rounded-md border p-3 text-sm transition",
                        selected && "border-primary bg-primary/5",
                        !readOnly && !selected && "hover:bg-muted/50",
                        readOnly && "opacity-60",
                      )}
                    >
                      {op}
                    </button>
                  );
                })}
              </div>
            )}

            {q.tipo === "respuesta_corta" && (
              <Input
                disabled={readOnly}
                value={respuestas[q.id] ?? ""}
                onChange={(e) => setRespuestas({ ...respuestas, [q.id]: e.target.value })}
                placeholder="Tu respuesta"
              />
            )}

            {q.tipo === "desarrollo" && (
              <div>
                <Label className="text-xs text-muted-foreground">Respuesta larga (será revisada por tu docente)</Label>
                <Textarea
                  disabled={readOnly}
                  value={respuestas[q.id] ?? ""}
                  onChange={(e) => setRespuestas({ ...respuestas, [q.id]: e.target.value })}
                  rows={5}
                  placeholder="Desarrolla tu respuesta…"
                />
              </div>
            )}
          </div>
        ))}

        {questionsQ.data?.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">
            Esta evaluación aún no tiene preguntas configuradas.
          </p>
        )}

        {!readOnly && (questionsQ.data?.length ?? 0) > 0 && (
          <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enviar entrega
          </Button>
        )}

        {readOnly && previous?.estado === "calificado" && previous.porcentaje != null && (
          <div className="rounded-lg border bg-muted/30 p-5 text-center">
            <Trophy className="mx-auto h-10 w-10 text-amber-500" />
            <p className="text-3xl font-extrabold text-primary">{previous.porcentaje}%</p>
            <p className="text-sm text-muted-foreground">
              {previous.porcentaje >= 70 ? "¡Aprobado! 🎉" : "Sigue practicando 💪"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
