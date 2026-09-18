import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AdminPageHeader, CreateButton, EditButton, DeleteButton, FormDialog, EmptyState,
} from "@/components/admin/AdminUI";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ListChecks, Trash2, Plus } from "lucide-react";
import { AiQuizGenerator } from "@/components/ai/AiQuizGenerator";

type Assessment = {
  id?: string;
  programa_id: string;
  modulo_id: string | null;
  titulo: string;
  descripcion: string;
  instrucciones: string;
  tipo: "examen" | "quiz" | "tarea";
  puntaje_maximo: number;
  peso_porcentaje: number;
  duracion_minutos: number | null;
  fecha_limite: string | null;
  publicado: boolean;
};

type Question = {
  id?: string;
  assessment_id?: string;
  enunciado: string;
  tipo: "opcion_multiple" | "verdadero_falso" | "respuesta_corta" | "desarrollo";
  opciones: string[] | null;
  respuesta_correcta: string;
  puntaje: number;
  orden: number;
};

const empty = (programa_id: string): Assessment => ({
  programa_id, modulo_id: null, titulo: "", descripcion: "", instrucciones: "",
  tipo: "tarea", puntaje_maximo: 100, peso_porcentaje: 0,
  duracion_minutos: null, fecha_limite: null, publicado: false,
});

const tipoLabel: Record<string, string> = {
  examen: "Examen", quiz: "Quiz", tarea: "Tarea",
};

const tipoBadge: Record<string, string> = {
  examen: "destructive", quiz: "default", tarea: "secondary",
};

interface Props { scope: "admin" | "docente" }

export function AssessmentsManager({ scope }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [programaId, setProgramaId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [qOpen, setQOpen] = useState<Assessment | null>(null);

  const programsQ = useQuery({
    queryKey: ["assessments-programs", scope, user?.id],
    queryFn: async () => {
      if (scope === "docente" && user?.id) {
        // Incluye programas asignados por programa, grupo/cohorte o módulo
        const { data: scopes, error: rpcErr } = await (supabase.rpc as any)("my_teacher_programs");
        if (rpcErr) throw rpcErr;
        const ids = ((scopes ?? []) as { programa_id: string }[]).map((s) => s.programa_id);
        if (ids.length === 0) return [];
        const { data, error } = await supabase
          .from("programs").select("id, titulo, docente_id").in("id", ids).order("titulo");
        if (error) throw error;
        return data ?? [];
      }
      const { data, error } = await supabase
        .from("programs").select("id, titulo, docente_id").order("titulo");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });


  const modulosQ = useQuery({
    queryKey: ["assessments-modulos", programaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_modules").select("id, titulo, orden")
        .eq("programa_id", programaId).order("orden");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!programaId,
  });

  const assessmentsQ = useQuery({
    queryKey: ["assessments", programaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments").select("*")
        .eq("programa_id", programaId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Assessment[];
    },
    enabled: !!programaId,
  });

  const submit = async (values: Assessment) => {
    if (!user) return;
    const payload = {
      ...values,
      modulo_id: values.modulo_id || null,
      duracion_minutos: values.duracion_minutos || null,
      fecha_limite: values.fecha_limite || null,
      created_by: values.id ? undefined : user.id,
    };
    const { error } = values.id
      ? await supabase.from("assessments").update(payload).eq("id", values.id)
      : await supabase.from("assessments").insert(payload as never);
    if (error) { toast.error(error.message); return; }
    toast.success(values.id ? "Evaluación actualizada" : "Evaluación creada");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["assessments", programaId] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("assessments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Evaluación eliminada");
    qc.invalidateQueries({ queryKey: ["assessments", programaId] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Evaluaciones y Tareas"
        description="Crea exámenes, quizzes y asignaciones para tus cursos."
        action={
          programaId ? (
            <CreateButton
              onClick={() => { setEditing(empty(programaId)); setOpen(true); }}
              label="Nueva evaluación"
            />
          ) : null
        }
      />

      <div className="mb-6 grid gap-3 md:max-w-md">
        <Label>Programa / Curso</Label>
        <Select value={programaId} onValueChange={setProgramaId}>
          <SelectTrigger><SelectValue placeholder="Selecciona un programa" /></SelectTrigger>
          <SelectContent>
            {(programsQ.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {scope === "docente" && (programsQ.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No tienes programas asignados aún.</p>
        )}
      </div>

      {!programaId ? (
        <EmptyState>Selecciona un programa para gestionar sus evaluaciones.</EmptyState>
      ) : assessmentsQ.isLoading ? (
        <div className="text-muted-foreground">Cargando…</div>
      ) : (assessmentsQ.data ?? []).length === 0 ? (
        <EmptyState>Aún no hay evaluaciones para este programa.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Puntaje</TableHead>
                <TableHead>Peso</TableHead>
                <TableHead>Fecha límite</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(assessmentsQ.data ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.titulo}</TableCell>
                  <TableCell>
                    <Badge variant={tipoBadge[a.tipo] as never}>{tipoLabel[a.tipo]}</Badge>
                  </TableCell>
                  <TableCell>{a.puntaje_maximo} pts</TableCell>
                  <TableCell>{a.peso_porcentaje}%</TableCell>
                  <TableCell>
                    {a.fecha_limite ? new Date(a.fecha_limite).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.publicado ? "default" : "outline"}>
                      {a.publicado ? "Publicada" : "Borrador"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setQOpen(a)}>
                      <ListChecks className="h-4 w-4" />
                    </Button>
                    <EditButton onClick={() => { setEditing(a); setOpen(true); }} />
                    <DeleteButton onConfirm={() => remove(a.id!)} label="esta evaluación" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <FormDialog
          title={editing.id ? "Editar evaluación" : "Nueva evaluación"}
          open={open}
          onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
          initial={editing}
          onSubmit={submit}
        >
          {(s, set) => (
            <>
              <div>
                <Label>Título *</Label>
                <Input required value={s.titulo} onChange={(e) => set({ titulo: e.target.value })} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Tipo *</Label>
                  <Select value={s.tipo} onValueChange={(v) => set({ tipo: v as Assessment["tipo"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tarea">Tarea / Asignación</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="examen">Examen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lección que requiere esta evaluación (opcional)</Label>
                  <Select
                    value={s.modulo_id ?? "none"}
                    onValueChange={(v) => set({ modulo_id: v === "none" ? null : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sin lección (sin prerrequisito) —</SelectItem>
                      {(modulosQ.data ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.titulo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Si eliges una lección, el estudiante deberá realizar esta evaluación
                    al completarla, antes de continuar a la siguiente.
                  </p>
                </div>

              </div>
              <div>
                <Label>Descripción</Label>
                <Textarea value={s.descripcion} onChange={(e) => set({ descripcion: e.target.value })} rows={2} />
              </div>
              <div>
                <Label>Instrucciones</Label>
                <Textarea value={s.instrucciones} onChange={(e) => set({ instrucciones: e.target.value })} rows={4} />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label>Puntaje máximo</Label>
                  <Input type="number" min={1} value={s.puntaje_maximo}
                    onChange={(e) => set({ puntaje_maximo: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Peso (%)</Label>
                  <Input type="number" min={0} max={100} value={s.peso_porcentaje}
                    onChange={(e) => set({ peso_porcentaje: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Duración (min)</Label>
                  <Input type="number" min={0} value={s.duracion_minutos ?? ""}
                    onChange={(e) => set({ duracion_minutos: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
              <div>
                <Label>Fecha límite</Label>
                <Input type="datetime-local"
                  value={s.fecha_limite ? s.fecha_limite.slice(0, 16) : ""}
                  onChange={(e) => set({ fecha_limite: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={s.publicado} onCheckedChange={(v) => set({ publicado: v })} />
                <Label>Publicada (visible para estudiantes inscritos)</Label>
              </div>
            </>
          )}
        </FormDialog>
      )}

      {qOpen && (
        <QuestionsDialog assessment={qOpen} onClose={() => setQOpen(null)} />
      )}
    </div>
  );
}

function QuestionsDialog({ assessment, onClose }: { assessment: Assessment; onClose: () => void }) {
  const qc = useQueryClient();
  const qkey = ["assessment-questions", assessment.id];
  const [draft, setDraft] = useState<Question>({
    enunciado: "", tipo: "opcion_multiple", opciones: ["", "", "", ""],
    respuesta_correcta: "", puntaje: 1, orden: 0,
  });

  const questionsQ = useQuery({
    queryKey: qkey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_questions").select("*")
        .eq("assessment_id", assessment.id!).order("orden");
      if (error) throw error;
      return data as Question[];
    },
    enabled: !!assessment.id,
  });

  const addQuestion = async () => {
    if (!draft.enunciado.trim()) { toast.error("Escribe el enunciado"); return; }
    const orden = (questionsQ.data?.length ?? 0) + 1;
    const payload = {
      ...draft, assessment_id: assessment.id!, orden,
      opciones: draft.tipo === "opcion_multiple" ? draft.opciones : null,
    };
    const { error } = await supabase.from("assessment_questions").insert(payload as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Pregunta agregada");
    setDraft({ enunciado: "", tipo: "opcion_multiple", opciones: ["", "", "", ""], respuesta_correcta: "", puntaje: 1, orden: 0 });
    qc.invalidateQueries({ queryKey: qkey });
  };

  const removeQuestion = async (id: string) => {
    const { error } = await supabase.from("assessment_questions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: qkey });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Preguntas — {assessment.titulo}</DialogTitle>
        </DialogHeader>

        <div className="flex justify-end">
          <AiQuizGenerator
            assessmentId={assessment.id!}
            startingOrder={(questionsQ.data?.length ?? 0) + 1}
            onImported={() => qc.invalidateQueries({ queryKey: qkey })}
          />
        </div>

        <div className="space-y-3">
          {(questionsQ.data ?? []).map((q, i) => (
            <div key={q.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Pregunta {i + 1} · {q.puntaje} pts · {q.tipo}</div>
                  <div className="font-medium">{q.enunciado}</div>
                  {q.tipo === "opcion_multiple" && q.opciones && (
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {q.opciones.map((o, idx) => (
                        <li key={idx} className={o === q.respuesta_correcta ? "font-semibold text-primary" : ""}>{o}</li>
                      ))}
                    </ul>
                  )}
                  {q.tipo === "verdadero_falso" && (
                    <div className="mt-1 text-sm">Respuesta: <span className="font-semibold">{q.respuesta_correcta}</span></div>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeQuestion(q.id!)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {(questionsQ.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aún no hay preguntas. Agrega la primera abajo.</p>
          )}
        </div>

        <div className="mt-4 space-y-3 rounded-md border bg-muted/30 p-4">
          <div className="text-sm font-semibold">Agregar pregunta</div>
          <div>
            <Label>Enunciado</Label>
            <Textarea value={draft.enunciado} onChange={(e) => setDraft({ ...draft, enunciado: e.target.value })} rows={2} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Tipo</Label>
              <Select value={draft.tipo} onValueChange={(v) => setDraft({ ...draft, tipo: v as Question["tipo"], respuesta_correcta: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="opcion_multiple">Opción múltiple</SelectItem>
                  <SelectItem value="verdadero_falso">Verdadero / Falso</SelectItem>
                  <SelectItem value="respuesta_corta">Respuesta corta</SelectItem>
                  <SelectItem value="desarrollo">Desarrollo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Puntaje</Label>
              <Input type="number" min={1} value={draft.puntaje}
                onChange={(e) => setDraft({ ...draft, puntaje: Number(e.target.value) })} />
            </div>
          </div>

          {draft.tipo === "opcion_multiple" && (
            <div className="space-y-2">
              <Label>Opciones (marca la correcta)</Label>
              {draft.opciones?.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={draft.respuesta_correcta === opt && opt !== ""}
                    onChange={() => setDraft({ ...draft, respuesta_correcta: opt })}
                  />
                  <Input
                    placeholder={`Opción ${i + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...(draft.opciones ?? [])];
                      const prev = next[i];
                      next[i] = e.target.value;
                      setDraft({
                        ...draft,
                        opciones: next,
                        respuesta_correcta: draft.respuesta_correcta === prev ? e.target.value : draft.respuesta_correcta,
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {draft.tipo === "verdadero_falso" && (
            <div>
              <Label>Respuesta correcta</Label>
              <Select value={draft.respuesta_correcta} onValueChange={(v) => setDraft({ ...draft, respuesta_correcta: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="verdadero">Verdadero</SelectItem>
                  <SelectItem value="falso">Falso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {draft.tipo === "respuesta_corta" && (
            <div>
              <Label>Respuesta esperada (referencia)</Label>
              <Input value={draft.respuesta_correcta} onChange={(e) => setDraft({ ...draft, respuesta_correcta: e.target.value })} />
            </div>
          )}

          <Button type="button" onClick={addQuestion}>
            <Plus className="mr-2 h-4 w-4" /> Agregar pregunta
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
