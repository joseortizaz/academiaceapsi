import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  AdminPageHeader, CreateButton, EmptyState, FormDialog,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/inscripciones")({
  component: InscripcionesPage,
});

const estados = ["pendiente", "activo", "completado", "cancelado", "suspendido"];

type Inscripcion = {
  user_id: string;
  programa_id: string;
  estado: string;
};
const empty: Inscripcion = { user_id: "", programa_id: "", estado: "activo" };

function InscripcionesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "inscripciones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments").select("*").order("fecha_inscripcion", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: programas = [] } = useQuery({
    queryKey: ["admin", "programas", "lookup"],
    queryFn: async () => (await supabase.from("programs").select("id,titulo")).data ?? [],
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["admin", "usuarios", "lookup"],
    queryFn: async () =>
      (await supabase.from("profiles").select("id,nombre,apellido").order("nombre")).data ?? [],
  });

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: perfiles = [] } = useQuery({
    queryKey: ["admin", "perfiles", userIds.length],
    enabled: userIds.length > 0,
    queryFn: async () =>
      (await supabase.from("profiles").select("id,nombre,apellido").in("id", userIds)).data ?? [],
  });

  const pMap = new Map(programas.map((p: any) => [p.id, p.titulo]));
  const uMap = new Map(perfiles.map((p: any) => [p.id, `${p.nombre} ${p.apellido}`]));

  const updateEstado = async (id: string, estado: string) => {
    const { error } = await supabase.from("enrollments").update({ estado }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Estado actualizado");
    qc.invalidateQueries({ queryKey: ["admin", "inscripciones"] });
  };

  const matricular = async (v: Inscripcion) => {
    if (!v.user_id || !v.programa_id) return toast.error("Selecciona estudiante y programa");
    const { error } = await supabase.from("enrollments").insert({
      user_id: v.user_id,
      programa_id: v.programa_id,
      estado: v.estado,
    });
    if (error) return toast.error(error.message);
    toast.success("Estudiante matriculado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin", "inscripciones"] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Inscripciones"
        description="Estudiantes matriculados por programa."
        action={<CreateButton label="Matricular estudiante" onClick={() => setOpen(true)} />}
      />
      {rows.length === 0 ? (
        <EmptyState>Aún no hay inscripciones.</EmptyState>
      ) : (
        <div className="max-h-[640px] overflow-auto rounded-lg border bg-card">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>Estudiante</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead>Inscrito</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {uMap.get(r.user_id) ?? r.user_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>{pMap.get(r.programa_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.fecha_inscripcion).toLocaleDateString("es-DO")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.progreso_porcentaje}%</Badge>
                  </TableCell>
                  <TableCell>
                    <Select value={r.estado} onValueChange={(v) => updateEstado(r.id, v)}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {estados.map((e) => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormDialog<Inscripcion>
        title="Matricular estudiante"
        open={open}
        onOpenChange={setOpen}
        initial={empty}
        onSubmit={matricular}
        submitLabel="Matricular"
      >
        {(s, set) => (
          <>
            <div className="grid gap-2">
              <Label>Estudiante</Label>
              <Select value={s.user_id} onValueChange={(v) => set({ user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger>
                <SelectContent>
                  {usuarios.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre} {u.apellido}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Programa</Label>
              <Select value={s.programa_id} onValueChange={(v) => set({ programa_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona un programa" /></SelectTrigger>
                <SelectContent>
                  {programas.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Estado inicial</Label>
              <Select value={s.estado} onValueChange={(v) => set({ estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {estados.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </FormDialog>
    </div>
  );
}
