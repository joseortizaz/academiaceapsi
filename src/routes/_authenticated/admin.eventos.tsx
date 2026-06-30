import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AdminPageHeader, CreateButton, EditButton, DeleteButton, FormDialog, EmptyState,
} from "@/components/admin/AdminUI";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Image as ImageIcon, Video as VideoIcon, Trash2, Plus, Upload, Loader2 } from "lucide-react";
import { useRef } from "react";

export const Route = createFileRoute("/_authenticated/admin/eventos")({
  component: EventosAdmin,
});

type Evento = {
  id?: string;
  titulo: string;
  slug: string;
  fecha: string | null;
  descripcion: string;
  cover_url: string;
  publicado: boolean;
  orden: number;
};

const empty: Evento = {
  titulo: "", slug: "", fecha: "", descripcion: "", cover_url: "",
  publicado: true, orden: 0,
};

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function EventosAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Evento>(empty);
  const [mediaFor, setMediaFor] = useState<Evento | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("orden", { ascending: true })
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = async (v: Evento) => {
    const payload = {
      ...v,
      slug: v.slug || slugify(v.titulo),
      fecha: v.fecha || null,
      orden: Number(v.orden) || 0,
    };
    const { error } = v.id
      ? await supabase.from("events").update(payload).eq("id", v.id)
      : await supabase.from("events").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Evento guardado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin", "events"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Evento eliminado");
    qc.invalidateQueries({ queryKey: ["admin", "events"] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Eventos"
        description="Crea eventos y gestiona su galería de imágenes y videos."
        action={
          <CreateButton
            label="Nuevo evento"
            onClick={() => { setEditing(empty); setOpen(true); }}
          />
        }
      />

      {rows.length === 0 ? (
        <EmptyState>Aún no hay eventos. Crea el primero.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.titulo}</TableCell>
                  <TableCell>{r.fecha ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.slug}</TableCell>
                  <TableCell>
                    {r.publicado ? (
                      <Badge className="bg-emerald-100 text-emerald-800">Publicado</Badge>
                    ) : (
                      <Badge variant="outline">Oculto</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="mr-1" onClick={() => setMediaFor(r)}>
                      Multimedia
                    </Button>
                    <EditButton onClick={() => { setEditing({ ...(r as Evento), fecha: r.fecha ?? "" }); setOpen(true); }} />
                    <DeleteButton onConfirm={() => remove(r.id!)} label="el evento" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormDialog<Evento>
        title={editing.id ? "Editar evento" : "Nuevo evento"}
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSubmit={save}
      >
        {(s, set) => (
          <>
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input
                value={s.titulo}
                onChange={(e) => set({
                  titulo: e.target.value,
                  slug: s.id ? s.slug : slugify(e.target.value),
                })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Slug</Label>
                <Input value={s.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} required />
              </div>
              <div className="grid gap-2">
                <Label>Fecha</Label>
                <Input type="date" value={s.fecha ?? ""} onChange={(e) => set({ fecha: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descripción corta</Label>
              <Textarea rows={3} value={s.descripcion ?? ""} onChange={(e) => set({ descripcion: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Imagen de portada</Label>
              <ImageUploader folder="events" value={s.cover_url} onChange={(url) => set({ cover_url: url })} />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <Switch checked={s.publicado} onCheckedChange={(c) => set({ publicado: c })} />
                <span className="text-sm">Publicado</span>
              </label>
              <div className="grid gap-2">
                <Label className="text-xs">Orden</Label>
                <Input type="number" className="w-24" value={s.orden} onChange={(e) => set({ orden: Number(e.target.value) })} />
              </div>
            </div>
          </>
        )}
      </FormDialog>

      {mediaFor && (
        <MediaManager event={mediaFor} onClose={() => setMediaFor(null)} />
      )}
    </div>
  );
}

function MediaManager({ event, onClose }: { event: Evento; onClose: () => void }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"image" | "video">("image");
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadImages = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    let ok = 0, fail = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (!file.type.startsWith("image/")) { fail++; continue; }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`"${file.name}" supera 5 MB`);
          fail++; continue;
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `events/${event.slug}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("course-images")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("course-images").getPublicUrl(path);
        const { error: insErr } = await supabase.from("event_media").insert({
          event_id: event.id!,
          tipo: "image",
          url: pub.publicUrl,
          titulo: null,
        });
        if (insErr) throw insErr;
        ok++;
      } catch (e: any) {
        toast.error(e.message ?? `Error subiendo ${file.name}`);
        fail++;
      } finally {
        setProgress({ done: i + 1, total: files.length });
      }
    }
    setUploading(false);
    setProgress(null);
    if (ok) toast.success(`${ok} imagen(es) subida(s)${fail ? `, ${fail} con error` : ""}`);
    qc.invalidateQueries({ queryKey: ["admin", "event_media", event.id] });
  };

  const { data: media = [] } = useQuery({
    queryKey: ["admin", "event_media", event.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_media")
        .select("*")
        .eq("event_id", event.id!)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addItem = async (overrideUrl?: string) => {
    const finalUrl = overrideUrl ?? url;
    if (!finalUrl) return;
    const { error } = await supabase.from("event_media").insert({
      event_id: event.id!,
      tipo,
      url: finalUrl,
      titulo: titulo || null,
    });
    if (error) return toast.error(error.message);
    setUrl(""); setTitulo("");
    qc.invalidateQueries({ queryKey: ["admin", "event_media", event.id] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("event_media").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin", "event_media", event.id] });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">Multimedia · {event.titulo}</h2>
            <p className="text-sm text-muted-foreground">Sube imágenes o agrega enlaces de YouTube/Vimeo.</p>
          </div>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>

        <div className="mb-6 rounded-lg border bg-muted/30 p-4">
          <div className="mb-3 flex gap-2">
            <Button size="sm" variant={tipo === "image" ? "default" : "outline"} onClick={() => setTipo("image")}>
              <ImageIcon className="mr-1 h-4 w-4" /> Imagen
            </Button>
            <Button size="sm" variant={tipo === "video" ? "default" : "outline"} onClick={() => setTipo("video")}>
              <VideoIcon className="mr-1 h-4 w-4" /> Video
            </Button>
          </div>

          {tipo === "image" ? (
            <div className="space-y-2">
              <Label>Subir imagen</Label>
              <ImageUploader
                folder={`events/${event.slug}`}
                value=""
                onChange={(u) => u && addItem(u)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>URL de YouTube o Vimeo</Label>
              <Input
                placeholder="https://www.youtube.com/watch?v=... o https://vimeo.com/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Label className="mt-2">Título (opcional)</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              <Button size="sm" onClick={() => addItem()}>
                <Plus className="mr-1 h-4 w-4" /> Agregar video
              </Button>
            </div>
          )}
        </div>

        {media.length === 0 ? (
          <EmptyState>Sin multimedia aún.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {media.map((m: any) => (
              <div key={m.id} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                {m.tipo === "image" ? (
                  <img src={m.url} alt={m.titulo ?? ""} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
                    <VideoIcon className="h-8 w-8 text-muted-foreground" />
                    <span className="line-clamp-3 text-xs">{m.titulo || m.url}</span>
                  </div>
                )}
                <button
                  onClick={() => remove(m.id)}
                  className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 group-hover:opacity-100"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
