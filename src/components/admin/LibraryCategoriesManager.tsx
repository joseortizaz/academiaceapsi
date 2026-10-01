import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CreateButton,
  DeleteButton,
  EditButton,
  EmptyState,
  FormDialog,
} from "@/components/admin/AdminUI";
import { SLUG_REGEX, slugify } from "@/lib/library";

type Categoria = {
  id?: string;
  nombre: string;
  slug: string;
  orden: number;
};

const empty: Categoria = { nombre: "", slug: "", orden: 0 };

export const LIBRARY_CATEGORIES_KEY = ["admin", "biblioteca", "categorias"] as const;

export function useLibraryCategories() {
  return useQuery({
    queryKey: LIBRARY_CATEGORIES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_categories")
        .select("id, nombre, slug, orden")
        .order("orden")
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function LibraryCategoriesManager({ conteo }: { conteo: Map<string, number> }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria>(empty);
  const { data: rows = [], isLoading } = useLibraryCategories();

  const save = async (v: Categoria) => {
    const nombre = v.nombre.trim();
    const slug = v.slug.trim() || slugify(nombre);
    if (!nombre) return toast.error("El nombre es obligatorio");
    if (!SLUG_REGEX.test(slug))
      return toast.error("El enlace solo admite letras, números y guiones");
    const payload = { nombre, slug, orden: Number(v.orden) || 0 };
    const { error } = v.id
      ? await supabase.from("library_categories").update(payload).eq("id", v.id)
      : await supabase.from("library_categories").insert(payload);
    if (error) {
      return toast.error(
        error.code === "23505" ? "Ya existe una categoría con ese nombre o enlace" : error.message,
      );
    }
    toast.success("Categoría guardada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: LIBRARY_CATEGORIES_KEY });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("library_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Categoría eliminada");
    qc.invalidateQueries({ queryKey: LIBRARY_CATEGORIES_KEY });
    qc.invalidateQueries({ queryKey: ["admin", "biblioteca", "documentos"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Las categorías aparecen como filtros en el catálogo público, en el orden indicado.
        </p>
        <CreateButton
          label="Nueva categoría"
          onClick={() => {
            setEditing({ ...empty, orden: rows.length });
            setOpen(true);
          }}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando categorías…</p>
      ) : rows.length === 0 ? (
        <EmptyState>Aún no hay categorías. Crea la primera para organizar el catálogo.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Orden</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Enlace</TableHead>
                <TableHead>Documentos</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const n = conteo.get(c.id) ?? 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell>{c.orden}</TableCell>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.slug}
                    </TableCell>
                    <TableCell>{n}</TableCell>
                    <TableCell className="text-right">
                      <EditButton
                        onClick={() => {
                          setEditing({ id: c.id, nombre: c.nombre, slug: c.slug, orden: c.orden });
                          setOpen(true);
                        }}
                      />
                      <DeleteButton
                        onConfirm={() => remove(c.id)}
                        label={
                          n > 0
                            ? `la categoría "${c.nombre}". Sus ${n} documento(s) quedarán sin categoría`
                            : `la categoría "${c.nombre}"`
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
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
              <Input
                value={s.nombre}
                onChange={(e) =>
                  set({
                    nombre: e.target.value,
                    ...(s.id ? {} : { slug: slugify(e.target.value) }),
                  })
                }
                placeholder="Ej. Psicología clínica"
                required
              />
            </div>
            <div className="grid grid-cols-[1fr_7rem] gap-4">
              <div className="grid gap-2">
                <Label>Enlace</Label>
                <Input
                  value={s.slug}
                  onChange={(e) =>
                    set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
                  }
                  placeholder="psicologia-clinica"
                />
              </div>
              <div className="grid gap-2">
                <Label>Orden</Label>
                <Input
                  type="number"
                  min={0}
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
