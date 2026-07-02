import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminPageHeader, CreateButton, EditButton, DeleteButton, FormDialog, EmptyState,
} from "@/components/admin/AdminUI";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/grupos")({
  component: GruposPage,
});

type Cohort = {
  id?: string;
  programa_id: string;
  nombre: string;
  modalidad: string;
  nivel_actual: string | null;
  docente_id: string | null;
  horario: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  dias_clase: any;
  ubicacion: string | null;
  cupo_maximo: number | null;
  estado: string;
  notas: string | null;
};

const empty: Cohort = {
  programa_id: "",
  nombre: "",
  modalidad: "sincrono",
  nivel_actual: "",
  docente_id: null,
  horario: "",
  fecha_inicio: null,
  fecha_fin: null,
  dias_clase: [],
  ubicacion: "",
  cupo_maximo: null,
  estado: "planificado",
  notas: "",
};

const estadoColor: Record<string, string> = {
  planificado: "bg-muted text-foreground",
  activo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  finalizado: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  cancelado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function GruposPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [current, setCurrent] = useState<Cohort>(empty);
  const [studentsForCohort, setStudentsForCohort] = useState<string | null>(null);
  const [filterPrograma, setFilterPrograma] = useState<string>("all");
  const [filterEstado, setFilterEstado] = useState<string>("all");

  const { data: cohorts = [] } = useQuery({
    queryKey: ["admin-cohorts", filterPrograma, filterEstado],
    queryFn: async () => {
      let q = supabase.from("program_cohorts" as any).select("*").order("created_at", { ascending: false });
      if (filterPrograma !== "all") q = q.eq("programa_id", filterPrograma);
      if (filterEstado !== "all") q = q.eq("estado", filterEstado);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: programas = [] } = useQuery({
    queryKey: ["admin-cohorts-programs"],
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("id,titulo,modalidad,tipo").order("titulo");
      return data ?? [];
    },
  });

  const { data: docentes = [] } = useQuery({
    queryKey: ["admin-cohorts-teachers"],
    queryFn: async () => {
      const { data } = await supabase.from("teachers").select("id,nombre,apellido").order("nombre");
      return data ?? [];
    },
  });

  const programMap = new Map<string, any>((programas as any[]).map((p) => [p.id, p]));
  const teacherMap = new Map<string, any>((docentes as any[]).map((d) => [d.id, d]));

  const openCreate = () => { setCurrent(empty); setDialogOpen(true); };
  const openEdit = (c: any) => { setCurrent({ ...empty, ...c }); setDialogOpen(true); };

  const save = async (values: Cohort) => {
    try {
      if (!values.programa_id) { toast.error("Selecciona un programa"); return; }
      if (!values.nombre.trim()) { toast.error("Ingresa un nombre"); return; }
      const payload: any = {
        ...values,
        nivel_actual: values.nivel_actual || null,
        horario: values.horario || null,
        ubicacion: values.ubicacion || null,
        notas: values.notas || null,
        cupo_maximo: values.cupo_maximo ? Number(values.cupo_maximo) : null,
      };
      const q = values.id
        ? supabase.from("program_cohorts" as any).update(payload).eq("id", values.id)
        : supabase.from("program_cohorts" as any).insert(payload);
      const { error } = await q;
      if (error) throw error;
      toast.success(values.id ? "Grupo actualizado" : "Grupo creado");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-cohorts"] });
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo guardar");
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("program_cohorts" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Grupo eliminado");
    qc.invalidateQueries({ queryKey: ["admin-cohorts"] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Grupos / Cohortes"
        description="Organiza a los estudiantes por grupo con su docente, modalidad, horario y nivel actual."
        action={<CreateButton onClick={openCreate} label="Nuevo grupo" />}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-[220px]">
          <Label className="mb-1 block text-xs">Filtrar por programa</Label>
          <Select value={filterPrograma} onValueChange={setFilterPrograma}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los programas</SelectItem>
              {(programas as any[]).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Label className="mb-1 block text-xs">Estado</Label>
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="planificado">Planificado</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="finalizado">Finalizado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {cohorts.length === 0 ? (
        <EmptyState>Aún no hay grupos creados.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead>Modalidad</TableHead>
                <TableHead>Docente</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead>Nivel actual</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohorts.map((c) => {
                const p = programMap.get(c.programa_id);
                const t = c.docente_id ? teacherMap.get(c.docente_id) : null;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell>{p?.titulo ?? "—"}</TableCell>
                    <TableCell className="capitalize">{c.modalidad}</TableCell>
                    <TableCell>{t ? `${t.nombre} ${t.apellido ?? ""}` : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.horario ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.nivel_actual ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={estadoColor[c.estado] ?? ""}>{c.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setStudentsForCohort(c.id)}>
                        <Users className="mr-1 h-4 w-4" /> Alumnos
                      </Button>
                      <EditButton onClick={() => openEdit(c)} />
                      <DeleteButton onConfirm={() => remove(c.id)} label="el grupo" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <FormDialog<Cohort>
        title={current.id ? "Editar grupo" : "Nuevo grupo"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={current}
        onSubmit={save}
      >
        {(s, set) => (
          <>
            <div className="grid gap-2">
              <Label>Programa</Label>
              <Select value={s.programa_id} onValueChange={(v) => {
                const p = programMap.get(v);
                set({ programa_id: v, modalidad: s.modalidad || p?.modalidad || "sincrono" });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecciona un programa" /></SelectTrigger>
                <SelectContent>
                  {(programas as any[]).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.titulo} ({p.tipo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Nombre del grupo</Label>
              <Input value={s.nombre} onChange={(e) => set({ nombre: e.target.value })} placeholder="Ej: Cohorte 2026-A" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Modalidad</Label>
                <Select value={s.modalidad} onValueChange={(v) => set({ modalidad: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sincrono">Sincrónico (en vivo)</SelectItem>
                    <SelectItem value="asincrono">Asincrónico</SelectItem>
                    <SelectItem value="mixto">Mixto</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Estado</Label>
                <Select value={s.estado} onValueChange={(v) => set({ estado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planificado">Planificado</SelectItem>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="finalizado">Finalizado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Docente</Label>
                <Select value={s.docente_id ?? "none"} onValueChange={(v) => set({ docente_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {(docentes as any[]).map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nombre} {d.apellido ?? ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Cupo máximo</Label>
                <Input type="number" value={s.cupo_maximo ?? ""} onChange={(e) => set({ cupo_maximo: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Nivel actual</Label>
              <Input value={s.nivel_actual ?? ""} onChange={(e) => set({ nivel_actual: e.target.value })} placeholder="Ej: Módulo 2 - Semana 3" />
            </div>
            <div className="grid gap-2">
              <Label>Horario</Label>
              <Input value={s.horario ?? ""} onChange={(e) => set({ horario: e.target.value })} placeholder="Ej: Sábados 9:00 – 12:00" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Fecha inicio</Label>
                <Input type="date" value={s.fecha_inicio ?? ""} onChange={(e) => set({ fecha_inicio: e.target.value || null })} />
              </div>
              <div className="grid gap-2">
                <Label>Fecha fin</Label>
                <Input type="date" value={s.fecha_fin ?? ""} onChange={(e) => set({ fecha_fin: e.target.value || null })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Fechas de clase (una por línea, formato YYYY-MM-DD)</Label>
              <Textarea
                rows={4}
                value={Array.isArray(s.dias_clase) ? s.dias_clase.join("\n") : ""}
                onChange={(e) => set({
                  dias_clase: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean),
                })}
                placeholder="2026-08-15&#10;2026-08-22&#10;2026-08-29"
              />
            </div>
            <div className="grid gap-2">
              <Label>Ubicación / enlace</Label>
              <Input value={s.ubicacion ?? ""} onChange={(e) => set({ ubicacion: e.target.value })} placeholder="Aula B-203 / enlace Zoom recurrente" />
            </div>
            <div className="grid gap-2">
              <Label>Notas internas</Label>
              <Textarea rows={2} value={s.notas ?? ""} onChange={(e) => set({ notas: e.target.value })} />
            </div>
          </>
        )}
      </FormDialog>

      <StudentsDialog
        cohortId={studentsForCohort}
        onClose={() => setStudentsForCohort(null)}
        cohort={cohorts.find((c) => c.id === studentsForCohort)}
      />
    </div>
  );
}

function StudentsDialog({
  cohortId, onClose, cohort,
}: { cohortId: string | null; onClose: () => void; cohort: any }) {
  const qc = useQueryClient();
  const open = !!cohortId;

  const { data: members = [] } = useQuery({
    queryKey: ["cohort-members", cohortId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cohort_enrollments" as any)
        .select("*")
        .eq("cohort_id", cohortId!)
        .order("fecha_asignacion", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: eligible = [] } = useQuery({
    queryKey: ["cohort-eligible", cohort?.programa_id, cohortId],
    enabled: open && !!cohort?.programa_id,
    queryFn: async () => {
      const { data: enrolls } = await supabase
        .from("enrollments")
        .select("id,user_id,estado,nombre_completo,email_contacto")
        .eq("programa_id", cohort.programa_id)
        .in("estado", ["activo", "pendiente"]);
      const list = enrolls ?? [];
      const userIds = Array.from(new Set(list.map((e: any) => e.user_id).filter(Boolean)));
      let profileMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,nombre,apellido,telefono")
          .in("id", userIds);
        profileMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      }
      return list.map((e: any) => {
        const p = profileMap.get(e.user_id);
        const nombreProfile = p ? `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim() : "";
        return {
          ...e,
          display_name:
            e.nombre_completo?.trim() ||
            nombreProfile ||
            e.email_contacto ||
            null,
        };
      });
    },
  });

  const assignedIds = new Set(members.filter((m: any) => m.estado === "activo").map((m: any) => m.enrollment_id));

  const assign = async (enrollment: any) => {
    const { error } = await supabase.from("cohort_enrollments" as any).insert({
      cohort_id: cohortId,
      enrollment_id: enrollment.id,
      user_id: enrollment.user_id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Alumno asignado");
    qc.invalidateQueries({ queryKey: ["cohort-members", cohortId] });
  };

  const remove = async (memberId: string) => {
    const { error } = await supabase.from("cohort_enrollments" as any).delete().eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Alumno retirado");
    qc.invalidateQueries({ queryKey: ["cohort-members", cohortId] });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Alumnos del grupo{cohort?.nombre ? ` — ${cohort.nombre}` : ""}</DialogTitle>
        </DialogHeader>

        <section>
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Inscritos ({members.length})
          </h4>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay alumnos en este grupo.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inscripción</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Asignado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m: any) => {
                    const enr = (eligible as any[]).find((e) => e.id === m.enrollment_id);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">
                          {enr?.nombre_completo ?? enr?.email_contacto ?? m.user_id.slice(0, 8)}
                        </TableCell>
                        <TableCell><Badge variant="secondary">{m.estado}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(m.fecha_asignacion).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DeleteButton onConfirm={() => remove(m.id)} label="al alumno" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="mt-6">
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Añadir alumnos inscritos al programa
          </h4>
          {(eligible as any[]).filter((e) => !assignedIds.has(e.id)).length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos los inscritos ya están asignados o no hay inscripciones disponibles.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-lg border">
              <Table>
                <TableBody>
                  {(eligible as any[])
                    .filter((e) => !assignedIds.has(e.id))
                    .map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm">
                          {e.nombre_completo ?? e.email_contacto ?? e.user_id.slice(0, 8)}
                          <span className="ml-2 text-xs text-muted-foreground">({e.estado})</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => assign(e)}>Asignar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
