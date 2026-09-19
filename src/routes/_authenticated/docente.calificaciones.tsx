import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, CheckCircle2, FileText, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/docente/calificaciones")({
  component: DocenteCalificaciones,
});

type Submission = {
  id: string;
  assessment_id: string;
  user_id: string;
  respuestas: Record<string, unknown> | null;
  puntaje_obtenido: number | null;
  puntaje_maximo: number | null;
  porcentaje: number | null;
  estado: string;
  feedback: string | null;
  fecha_entrega: string;
  auto_calificado: boolean;
};

function DocenteCalificaciones() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "pendiente" | "calificado">("todos");
  const [editing, setEditing] = useState<Submission | null>(null);
  const [nota, setNota] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  // Enlace desde la notificación: /docente/calificaciones?assessmentId=...
  const [assessmentFilter, setAssessmentFilter] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("assessmentId")
      : null,
  );

  // Programas del docente por cualquiera de las vías (titular, grupo o módulo)
  const scopesQ = useQuery({
    queryKey: ["calif-scopes", user?.id, isAdmin],
    enabled: !!user?.id,
    queryFn: async () => {
      if (isAdmin) return null; // null = todos
      const { data, error } = await (supabase.rpc as any)("my_teacher_programs");
      if (error) throw error;
      return ((data ?? []) as { programa_id: string }[]).map((s) => s.programa_id);
    },
  });

  const programIds = scopesQ.data;

  const assessmentsQ = useQuery({
    queryKey: ["calif-assessments", programIds],
    enabled: scopesQ.isSuccess,
    queryFn: async () => {
      let q = supabase
        .from("assessments")
        .select("id, titulo, tipo, puntaje_maximo, programa_id, programs(titulo)");
      if (programIds) {
        if (programIds.length === 0) return [];
        q = q.in("programa_id", programIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const assessmentIds = (assessmentsQ.data ?? []).map((a) => a.id as string);

  const submissionsQ = useQuery({
    queryKey: ["calif-submissions", assessmentIds],
    enabled: assessmentsQ.isSuccess,
    queryFn: async () => {
      if (assessmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("assessment_submissions")
        .select(
          "id, assessment_id, user_id, respuestas, puntaje_obtenido, puntaje_maximo, porcentaje, estado, feedback, fecha_entrega, auto_calificado",
        )
        .in("assessment_id", assessmentIds)
        .order("fecha_entrega", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Submission[];
    },
  });

  const studentIds = Array.from(new Set((submissionsQ.data ?? []).map((s) => s.user_id)));

  const profilesQ = useQuery({
    queryKey: ["calif-profiles", studentIds],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nombre, apellido")
        .in("id", studentIds);
      return (data ?? []) as { id: string; nombre: string; apellido: string }[];
    },
  });

  const questionsQ = useQuery({
    queryKey: ["calif-questions", editing?.assessment_id],
    enabled: !!editing?.assessment_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("assessment_questions")
        .select("id, enunciado, tipo, respuesta_correcta, puntaje, orden")
        .eq("assessment_id", editing!.assessment_id)
        .order("orden");
      return data ?? [];
    },
  });

  const assessmentById = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of assessmentsQ.data ?? []) m.set(a.id, a);
    return m;
  }, [assessmentsQ.data]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profilesQ.data ?? []) {
      m.set(p.id, `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim() || "Alumno");
    }
    return m;
  }, [profilesQ.data]);

  const rows = (submissionsQ.data ?? []).map((s) => {
    const a = assessmentById.get(s.assessment_id);
    return {
      sub: s,
      alumno: nameById.get(s.user_id) ?? "Alumno",
      curso: a?.programs?.titulo ?? "",
      tarea: a?.titulo ?? "Evaluación",
      calificado: s.estado === "calificado",
    };
  });

  const filtered = rows.filter((r) => {
    if (assessmentFilter && r.sub.assessment_id !== assessmentFilter) return false;
    if (filter === "pendiente" && r.calificado) return false;
    if (filter === "calificado" && !r.calificado) return false;
    if (search && !`${r.alumno} ${r.curso} ${r.tarea}`.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const pendientes = rows.filter((r) => !r.calificado).length;

  const openEdit = (s: Submission) => {
    setEditing(s);
    setNota(s.puntaje_obtenido != null ? String(s.puntaje_obtenido) : "");
    setFeedback(s.feedback ?? "");
  };

  const handleSave = async () => {
    if (!editing) return;
    const max = Number(editing.puntaje_maximo ?? assessmentById.get(editing.assessment_id)?.puntaje_maximo ?? 100);
    const num = Number(nota);
    if (nota.trim() === "" || Number.isNaN(num) || num < 0 || num > max) {
      toast.error(`La nota debe estar entre 0 y ${max}.`);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("assessment_submissions")
      .update({
        puntaje_obtenido: num,
        puntaje_maximo: max,
        porcentaje: max > 0 ? Math.round((num / max) * 10000) / 100 : null,
        feedback,
        estado: "calificado",
        calificado_por: user?.id ?? null,
        fecha_calificacion: new Date().toISOString(),
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error(error.message ?? "No se pudo guardar la calificación");
      return;
    }
    toast.success("Calificación guardada.");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["calif-submissions"] });
  };

  const archivoUrl =
    typeof editing?.respuestas?.["archivo_url"] === "string"
      ? (editing!.respuestas!["archivo_url"] as string)
      : null;
  const comentario =
    typeof editing?.respuestas?.["comentario"] === "string"
      ? (editing!.respuestas!["comentario"] as string)
      : null;

  const loading = scopesQ.isLoading || assessmentsQ.isLoading || submissionsQ.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calificaciones</h1>
        <p className="text-muted-foreground">{pendientes} entregas pendientes de revisión.</p>
        {assessmentFilter && (
          <Button variant="link" className="h-auto p-0" onClick={() => setAssessmentFilter(null)}>
            Mostrando una sola evaluación · Ver todas las entregas
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar alumno, curso o tarea…" className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(["todos", "pendiente", "calificado"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
              {f}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Tarea</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(({ sub, alumno, curso, tarea, calificado }) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">{alumno}</TableCell>
                  <TableCell className="text-muted-foreground">{curso}</TableCell>
                  <TableCell>{tarea}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(sub.fecha_entrega).toLocaleDateString("es-DO")}
                  </TableCell>
                  <TableCell>
                    {calificado ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {sub.puntaje_obtenido ?? 0}/{sub.puntaje_maximo ?? 100}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Pendiente</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant={calificado ? "outline" : "default"} onClick={() => openEdit(sub)}>
                      {calificado ? "Ver" : "Calificar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    {loading ? "Cargando entregas…" : "Sin entregas."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Calificar: {editing ? assessmentById.get(editing.assessment_id)?.titulo ?? "Evaluación" : ""}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {nameById.get(editing.user_id) ?? "Alumno"} ·{" "}
                  {assessmentById.get(editing.assessment_id)?.programs?.titulo ?? ""} ·{" "}
                  {new Date(editing.fecha_entrega).toLocaleString("es-DO")}
                </p>

                {archivoUrl && (
                  <a
                    href={archivoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-primary underline"
                  >
                    <FileText className="h-4 w-4" /> Ver documento entregado
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {comentario && <p className="mt-2 whitespace-pre-wrap">{comentario}</p>}

                {(questionsQ.data ?? []).length > 0 && (
                  <div className="mt-3 space-y-3">
                    {(questionsQ.data ?? []).map((q: any, i: number) => {
                      const resp = editing.respuestas?.[q.id];
                      const correcta =
                        q.respuesta_correcta &&
                        typeof resp === "string" &&
                        resp.trim().toLowerCase() === String(q.respuesta_correcta).trim().toLowerCase();
                      return (
                        <div key={q.id} className="rounded-md border bg-background p-3">
                          <p className="font-medium">
                            {i + 1}. {q.enunciado}{" "}
                            <span className="text-xs text-muted-foreground">({q.puntaje} pts)</span>
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">
                            {typeof resp === "string" && resp.trim() !== "" ? resp : "— sin respuesta —"}
                          </p>
                          {q.respuesta_correcta && (
                            <p className={`mt-1 text-xs ${correcta ? "text-emerald-600" : "text-muted-foreground"}`}>
                              Respuesta correcta: {q.respuesta_correcta}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!archivoUrl && !comentario && (questionsQ.data ?? []).length === 0 && (
                  <p className="mt-2 text-muted-foreground">La entrega no incluye documento ni respuestas.</p>
                )}
              </div>

              <div>
                <Label htmlFor="nota">
                  Nota (0-{editing.puntaje_maximo ?? assessmentById.get(editing.assessment_id)?.puntaje_maximo ?? 100})
                </Label>
                <Input id="nota" type="number" min={0} value={nota} onChange={(e) => setNota(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="feedback">Retroalimentación</Label>
                <Textarea id="feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} placeholder="Comentarios para el alumno…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cerrar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar calificación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
