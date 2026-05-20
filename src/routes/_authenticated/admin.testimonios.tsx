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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AdminPageHeader, CreateButton, EditButton, DeleteButton, FormDialog, EmptyState,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/testimonios")({
  component: TestimoniosPage,
});

type Testimonio = {
  id?: string;
  nombre: string;
  ocupacion: string;
  contenido: string;
  imagen_url: string;
  calificacion: number | null;
  aprobado: boolean;
  orden: number;
};

const empty: Testimonio = {
  nombre: "", ocupacion: "", contenido: "", imagen_url: "",
  calificacion: 5, aprobado: false, orden: 0,
};

function TestimoniosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonio>(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "testimonios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testimonials")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = async (v: Testimonio) => {
    const payload = {
      ...v,
      orden: Number(v.orden) || 0,
      calificacion: v.calificacion ? Number(v.calificacion) : null,
    };
    const { error } = v.id
      ? await supabase.from("testimonials").update(payload).eq("id", v.id)
      : await supabase.from("testimonials").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Testimonio guardado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin", "testimonios"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Testimonio eliminado");
    qc.invalidateQueries({ queryKey: ["admin", "testimonios"] });
  };

  const toggleAprobado = async (id: string, aprobado: boolean) => {
    const { error } = await supabase.from("testimonials").update({ aprobado }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin", "testimonios"] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Testimonios"
        description="Aprueba reseñas antes de publicarlas en el portal."
        action={
          <CreateButton
            label="Nuevo testimonio"
            onClick={() => { setEditing(empty); setOpen(true); }}
          />
        }
      />

      {rows.length === 0 ? (
        <EmptyState>Aún no hay testimonios.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Ocupación</TableHead>
                <TableHead>Calificación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nombre}</TableCell>
                  <TableCell>{r.ocupacion}</TableCell>
                  <TableCell>{r.calificacion ?? "—"} / 5</TableCell>
                  <TableCell>
                    {r.aprobado ? (
                      <Badge className="bg-emerald-100 text-emerald-800">Publicado</Badge>
                    ) : (
                      <Badge variant="outline">Pendiente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="mr-1"
                      onClick={() => toggleAprobado(r.id, !r.aprobado)}
                    >
                      {r.aprobado ? "Ocultar" : "Aprobar"}
                    </Button>
                    <EditButton onClick={() => { setEditing({ ...(r as Testimonio) }); setOpen(true); }} />
                    <DeleteButton onConfirm={() => remove(r.id!)} label="el testimonio" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormDialog<Testimonio>
        title={editing.id ? "Editar testimonio" : "Nuevo testimonio"}
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSubmit={save}
      >
        {(s, set) => (
          <>
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={s.nombre} onChange={(e) => set({ nombre: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label>Ocupación</Label>
              <Input value={s.ocupacion ?? ""} onChange={(e) => set({ ocupacion: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Testimonio</Label>
              <Textarea rows={4} value={s.contenido} onChange={(e) => set({ contenido: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>URL de foto</Label>
                <Input value={s.imagen_url ?? ""} onChange={(e) => set({ imagen_url: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Calificación (1-5)</Label>
                <Input
                  type="number" min={1} max={5}
                  value={s.calificacion ?? ""}
                  onChange={(e) => set({ calificacion: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <Switch checked={s.aprobado} onCheckedChange={(c) => set({ aprobado: c })} />
                <span className="text-sm">Publicado en el portal</span>
              </label>
              <div className="grid gap-2">
                <Label className="text-xs">Orden</Label>
                <Input
                  type="number" className="w-24"
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
