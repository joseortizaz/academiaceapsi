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
import {
  AdminPageHeader, CreateButton, EditButton, DeleteButton, FormDialog, EmptyState,
} from "@/components/admin/AdminUI";
import { FileUploader } from "@/components/FileUploader";
import { AudioUploader } from "@/components/AudioUploader";

export const Route = createFileRoute("/_authenticated/admin/modulos")({
  component: ModulosPage,
});

type Modulo = {
  id?: string;
  programa_id: string;
  docente_id: string | null;
  titulo: string;
  descripcion: string;
  orden: number;
  duracion_minutos: number | null;
  video_url: string;
  audio_url: string;
  material_url: string;
  es_en_vivo: boolean;
  fecha_sesion: string | null;
};

const empty = (programa_id: string): Modulo => ({
  programa_id, docente_id: null, titulo: "", descripcion: "", orden: 0,
  duracion_minutos: null, video_url: "", audio_url: "", material_url: "",
  es_en_vivo: false, fecha_sesion: null,
});

function ModulosPage() {
  const qc = useQueryClient();
  const [programaId, setProgramaId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Modulo>(empty(""));

  const { data: programas = [] } = useQuery({
    queryKey: ["admin", "programas", "lookup"],
    queryFn: async () => (await supabase.from("programs").select("id,titulo").order("titulo")).data ?? [],
  });

  const { data: docentes = [] } = useQuery({
    queryKey: ["admin", "docentes", "lookup"],
    queryFn: async () => (await supabase.from("teachers").select("id,nombre,apellido")).data ?? [],
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "modulos", programaId],
    enabled: !!programaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_modules")
        .select("*")
        .eq("programa_id", programaId)
        .order("orden");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = async (v: Modulo) => {
    const payload = {
      ...v,
      orden: Number(v.orden) || 0,
      duracion_minutos: v.duracion_minutos ? Number(v.duracion_minutos) : null,
      fecha_sesion: v.fecha_sesion || null,
      docente_id: v.docente_id || null,
    };
    const { error } = v.id
      ? await supabase.from("program_modules").update(payload).eq("id", v.id)
      : await supabase.from("program_modules").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Módulo guardado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin", "modulos", programaId] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("program_modules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Módulo eliminado");
    qc.invalidateQueries({ queryKey: ["admin", "modulos", programaId] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Módulos"
        description="Estructura de contenido y sesiones por programa."
        action={
          programaId ? (
            <CreateButton
              label="Nuevo módulo"
              onClick={() => { setEditing(empty(programaId)); setOpen(true); }}
            />
          ) : null
        }
      />

      <div className="mb-6 max-w-md">
        <Label>Selecciona un programa</Label>
        <Select value={programaId} onValueChange={setProgramaId}>
          <SelectTrigger><SelectValue placeholder="-- elige un programa --" /></SelectTrigger>
          <SelectContent>
            {programas.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!programaId ? (
        <EmptyState>Selecciona un programa para gestionar sus módulos.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>Este programa aún no tiene módulos.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.orden}</TableCell>
                  <TableCell className="font-medium">{r.titulo}</TableCell>
                  <TableCell>{r.es_en_vivo ? "En vivo (Zoom)" : "Grabado"}</TableCell>
                  <TableCell>{r.duracion_minutos ? `${r.duracion_minutos} min` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <EditButton onClick={() => { setEditing({ ...(r as Modulo) }); setOpen(true); }} />
                    <DeleteButton onConfirm={() => remove(r.id!)} label="el módulo" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormDialog<Modulo>
        title={editing.id ? "Editar módulo" : "Nuevo módulo"}
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
              <Label>Descripción</Label>
              <Textarea rows={3} value={s.descripcion ?? ""} onChange={(e) => set({ descripcion: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Orden</Label>
                <Input type="number" value={s.orden} onChange={(e) => set({ orden: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>Duración (min)</Label>
                <Input
                  type="number"
                  value={s.duracion_minutos ?? ""}
                  onChange={(e) => set({ duracion_minutos: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Docente del módulo (opcional, sobreescribe el del programa)</Label>
              <Select
                value={s.docente_id ?? "none"}
                onValueChange={(v) => set({ docente_id: v === "none" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Usar docente del programa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Usar docente del programa</SelectItem>
                  {docentes.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.nombre} {d.apellido}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Video grabado (URL de YouTube/Vimeo o video subido)</Label>
              <Input
                placeholder="https://..."
                value={s.video_url ?? ""}
                onChange={(e) => set({ video_url: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Audio de la lección</Label>
              <AudioUploader
                value={s.audio_url}
                onChange={(url) => set({ audio_url: url ?? "" })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Material complementario (PDF, Word, Excel, PPT)</Label>
              <FileUploader
                value={s.material_url}
                onChange={(url) => set({ material_url: url ?? "" })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={s.es_en_vivo} onCheckedChange={(c) => set({ es_en_vivo: c })} />
              <span className="text-sm">Sesión en vivo por Zoom</span>
            </div>
            {s.es_en_vivo && (
              <div className="grid gap-2">
                <Label>Fecha y hora de la sesión</Label>
                <Input
                  type="datetime-local"
                  value={s.fecha_sesion ? s.fecha_sesion.substring(0, 16) : ""}
                  onChange={(e) => set({ fecha_sesion: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
            )}
          </>
        )}
      </FormDialog>
    </div>
  );
}
