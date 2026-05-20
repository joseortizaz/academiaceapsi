import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AdminPageHeader,
  CreateButton,
  EditButton,
  DeleteButton,
  FormDialog,
  EmptyState,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/categorias")({
  component: CategoriasPage,
});

type Categoria = {
  id?: string;
  nombre: string;
  slug: string;
  descripcion: string;
  icono: string;
  orden: number;
};

const empty: Categoria = { nombre: "", slug: "", descripcion: "", icono: "", orden: 0 };

function CategoriasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria>(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("orden", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = async (values: Categoria) => {
    const payload = { ...values, orden: Number(values.orden) || 0 };
    const { error } = values.id
      ? await supabase.from("categories").update(payload).eq("id", values.id)
      : await supabase.from("categories").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Categoría guardada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin", "categorias"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Categoría eliminada");
    qc.invalidateQueries({ queryKey: ["admin", "categorias"] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Categorías"
        description="Organiza los programas por área temática."
        action={
          <CreateButton
            onClick={() => {
              setEditing(empty);
              setOpen(true);
            }}
            label="Nueva categoría"
          />
        }
      />

      {rows.length === 0 ? (
        <EmptyState>No hay categorías creadas todavía.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{r.slug}</TableCell>
                  <TableCell>{r.orden}</TableCell>
                  <TableCell className="text-right">
                    <EditButton
                      onClick={() => {
                        setEditing({ ...(r as Categoria) });
                        setOpen(true);
                      }}
                    />
                    <DeleteButton onConfirm={() => remove(r.id!)} label="la categoría" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormDialog<Categoria>
        title={editing.id ? "Editar categoría" : "Nueva categoría"}
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
              <Label>Slug (URL)</Label>
              <Input
                value={s.slug}
                onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea value={s.descripcion ?? ""} onChange={(e) => set({ descripcion: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Ícono (emoji u opcional)</Label>
                <Input value={s.icono ?? ""} onChange={(e) => set({ icono: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Orden</Label>
                <Input
                  type="number"
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
