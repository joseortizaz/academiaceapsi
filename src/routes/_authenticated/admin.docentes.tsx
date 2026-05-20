import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AdminPageHeader, CreateButton, EditButton, DeleteButton, FormDialog, EmptyState,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/docentes")({
  component: DocentesPage,
});

type Docente = {
  id?: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  titulo: string;
  especialidad: string;
  biografia: string;
  avatar_url: string;
  linkedin_url: string;
  visible: boolean;
  orden: number;
};

const empty: Docente = {
  nombre: "", apellido: "", email: "", telefono: "", titulo: "", especialidad: "",
  biografia: "", avatar_url: "", linkedin_url: "", visible: true, orden: 0,
};

function DocentesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Docente>(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "docentes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teachers").select("*").order("orden");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = async (v: Docente) => {
    const payload = { ...v, orden: Number(v.orden) || 0 };
    const { error } = v.id
      ? await supabase.from("teachers").update(payload).eq("id", v.id)
      : await supabase.from("teachers").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Docente guardado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin", "docentes"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("teachers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Docente eliminado");
    qc.invalidateQueries({ queryKey: ["admin", "docentes"] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Docentes"
        description="Cuerpo docente visible en el portal público."
        action={
          <CreateButton
            label="Nuevo docente"
            onClick={() => { setEditing(empty); setOpen(true); }}
          />
        }
      />

      {rows.length === 0 ? (
        <EmptyState>Aún no has registrado docentes.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Especialidad</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Visible</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nombre} {r.apellido}</TableCell>
                  <TableCell>{r.especialidad}</TableCell>
                  <TableCell className="text-muted-foreground">{r.email}</TableCell>
                  <TableCell>{r.visible ? "Sí" : "No"}</TableCell>
                  <TableCell className="text-right">
                    <EditButton onClick={() => { setEditing({ ...(r as Docente) }); setOpen(true); }} />
                    <DeleteButton onConfirm={() => remove(r.id!)} label="el docente" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormDialog<Docente>
        title={editing.id ? "Editar docente" : "Nuevo docente"}
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSubmit={save}
      >
        {(s, set) => (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nombre</Label>
                <Input value={s.nombre} onChange={(e) => set({ nombre: e.target.value })} required />
              </div>
              <div className="grid gap-2">
                <Label>Apellido</Label>
                <Input value={s.apellido} onChange={(e) => set({ apellido: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={s.email} onChange={(e) => set({ email: e.target.value })} required />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input value={s.telefono ?? ""} onChange={(e) => set({ telefono: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Título profesional</Label>
              <Input
                value={s.titulo ?? ""}
                placeholder="Ej: Dr. en Psicología Clínica"
                onChange={(e) => set({ titulo: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Especialidad</Label>
              <Input value={s.especialidad ?? ""} onChange={(e) => set({ especialidad: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Biografía</Label>
              <Textarea rows={4} value={s.biografia ?? ""} onChange={(e) => set({ biografia: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>URL Avatar</Label>
                <Input value={s.avatar_url ?? ""} onChange={(e) => set({ avatar_url: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>LinkedIn</Label>
                <Input value={s.linkedin_url ?? ""} onChange={(e) => set({ linkedin_url: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <Switch checked={s.visible} onCheckedChange={(c) => set({ visible: c })} />
                <span className="text-sm">Visible en el portal público</span>
              </label>
              <div className="grid gap-2">
                <Label className="text-xs">Orden</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={s.orden}
                  onChange={(e) => set({ orden: Number(e.target.value) })}
                />
              </div>
            </div>
          </>
        )}
      </FormDialog>
    </div>
  );
}
