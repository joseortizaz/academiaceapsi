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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { ImageUploader } from "@/components/admin/ImageUploader";

import {
  AdminPageHeader, CreateButton, EditButton, DeleteButton, FormDialog, EmptyState,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/blog")({
  component: BlogPage,
});

type Post = {
  id?: string;
  titulo: string;
  slug: string;
  resumen: string;
  contenido: string;
  imagen_url: string;
  categoria_id: string | null;
  autor_id: string;
  estado: string;
  destacado: boolean;
  fecha_publicacion: string | null;
  tags: string[];
};

const empty = (autor_id: string): Post => ({
  titulo: "", slug: "", resumen: "", contenido: "", imagen_url: "",
  categoria_id: null, autor_id, estado: "borrador", destacado: false,
  fecha_publicacion: null, tags: [],
});

function BlogPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Post>(empty(""));

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "blog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["admin", "categorias", "lookup"],
    queryFn: async () => (await supabase.from("categories").select("id,nombre")).data ?? [],
  });

  const save = async (v: Post) => {
    if (!v.autor_id && !user?.id) return toast.error("Sesión no encontrada");
    const payload = {
      ...v,
      autor_id: v.autor_id || user!.id,
      categoria_id: v.categoria_id || null,
      fecha_publicacion:
        v.estado === "publicado" && !v.fecha_publicacion
          ? new Date().toISOString()
          : v.fecha_publicacion || null,
      tags: Array.isArray(v.tags) ? v.tags : [],
    };
    const { error } = v.id
      ? await supabase.from("blog_posts").update(payload).eq("id", v.id)
      : await supabase.from("blog_posts").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Artículo guardado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin", "blog"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Artículo eliminado");
    qc.invalidateQueries({ queryKey: ["admin", "blog"] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Blog"
        description="Artículos y publicaciones de la academia."
        action={
          <CreateButton
            label="Nuevo artículo"
            onClick={() => { setEditing(empty(user?.id ?? "")); setOpen(true); }}
          />
        }
      />

      {rows.length === 0 ? (
        <EmptyState>No hay artículos publicados.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Vistas</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.titulo}</TableCell>
                  <TableCell>
                    <Badge variant={r.estado === "publicado" ? "default" : "outline"}>
                      {r.estado}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.vistas ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <EditButton onClick={() => { setEditing({ ...(r as Post), tags: r.tags ?? [] }); setOpen(true); }} />
                    <DeleteButton onConfirm={() => remove(r.id!)} label="el artículo" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormDialog<Post>
        title={editing.id ? "Editar artículo" : "Nuevo artículo"}
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSubmit={save}
      >
        {(s, set) => (
          <>
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={s.titulo} onChange={(e) => set({ titulo: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label>Slug</Label>
              <Input
                value={s.slug}
                onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Resumen</Label>
              <Textarea rows={2} value={s.resumen ?? ""} onChange={(e) => set({ resumen: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Contenido (Markdown / HTML)</Label>
              <Textarea rows={8} value={s.contenido} onChange={(e) => set({ contenido: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Imagen de portada</Label>
                <ImageUploader
                  value={s.imagen_url ?? ""}
                  onChange={(url) => set({ imagen_url: url })}
                  folder="blog"
                />
              </div>

              <div className="grid gap-2">
                <Label>Categoría</Label>
                <Select
                  value={s.categoria_id ?? "none"}
                  onValueChange={(v) => set({ categoria_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {categorias.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Etiquetas (separadas por coma)</Label>
              <Input
                value={(s.tags ?? []).join(", ")}
                onChange={(e) => set({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Estado</Label>
                <Select value={s.estado} onValueChange={(v) => set({ estado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="borrador">Borrador</SelectItem>
                    <SelectItem value="publicado">Publicado</SelectItem>
                    <SelectItem value="archivado">Archivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="mt-7 flex items-center gap-2">
                <Switch checked={s.destacado} onCheckedChange={(c) => set({ destacado: c })} />
                <span className="text-sm">Destacado</span>
              </label>
            </div>
          </>
        )}
      </FormDialog>
    </div>
  );
}
