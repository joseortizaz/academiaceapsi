import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AdminPageHeader, CreateButton, EditButton, DeleteButton, FormDialog, EmptyState,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/hero")({
  component: HeroSlidesPage,
});

type Slide = {
  id?: string;
  imagen_url: string;
  enlace_url: string | null;
  alt: string | null;
  orden: number;
  activo: boolean;
};

const empty: Slide = { imagen_url: "", enlace_url: "", alt: "", orden: 0, activo: true };

function HeroSlidesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Slide>(empty);
  const [uploading, setUploading] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "hero_slides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hero_slides")
        .select("*")
        .order("orden", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("hero-slides").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) {
        toast.error(error.message);
        return null;
      }
      const { data } = supabase.storage.from("hero-slides").getPublicUrl(path);
      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  };

  const save = async (v: Slide) => {
    if (!v.imagen_url) return toast.error("La imagen es obligatoria");
    const payload = {
      imagen_url: v.imagen_url,
      enlace_url: v.enlace_url || null,
      alt: v.alt || null,
      orden: Number(v.orden) || 0,
      activo: v.activo,
    };
    const { error } = v.id
      ? await supabase.from("hero_slides").update(payload).eq("id", v.id)
      : await supabase.from("hero_slides").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Slide guardada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin", "hero_slides"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("hero_slides").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Slide eliminada");
    qc.invalidateQueries({ queryKey: ["admin", "hero_slides"] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Carrusel del Hero"
        description="Gestiona las imágenes del carrusel principal del sitio."
        action={
          <CreateButton
            label="Nueva imagen"
            onClick={() => { setEditing(empty); setOpen(true); }}
          />
        }
      />

      {rows.length === 0 ? (
        <EmptyState>Aún no hay imágenes en el carrusel.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imagen</TableHead>
                <TableHead>Enlace</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <img src={r.imagen_url} alt={r.alt ?? ""} className="h-12 w-20 rounded object-cover" />
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {r.enlace_url ?? "—"}
                  </TableCell>
                  <TableCell>{r.orden}</TableCell>
                  <TableCell>
                    {r.activo ? (
                      <Badge className="bg-emerald-100 text-emerald-800">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Oculto</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <EditButton onClick={() => { setEditing({ ...(r as Slide) }); setOpen(true); }} />
                    <DeleteButton onConfirm={() => remove(r.id!)} label="la imagen" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormDialog<Slide>
        title={editing.id ? "Editar slide" : "Nueva slide"}
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSubmit={save}
      >
        {(s, set) => (
          <>
            <div className="grid gap-2">
              <Label>Imagen</Label>
              {s.imagen_url && (
                <img src={s.imagen_url} alt="" className="h-32 w-full rounded border object-cover" />
              )}
              <Input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await uploadImage(file);
                  if (url) set({ imagen_url: url });
                }}
              />
              <Input
                placeholder="O pega una URL de imagen"
                value={s.imagen_url}
                onChange={(e) => set({ imagen_url: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Enlace (opcional)</Label>
              <Input
                placeholder="https://… o /programas/slug"
                value={s.enlace_url ?? ""}
                onChange={(e) => set({ enlace_url: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Texto alternativo (alt)</Label>
              <Input
                value={s.alt ?? ""}
                onChange={(e) => set({ alt: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <Switch checked={s.activo} onCheckedChange={(c) => set({ activo: c })} />
                <span className="text-sm">Activa</span>
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
