import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  FileText, FileSpreadsheet, Presentation, File as FileIcon,
  Loader2, Trash2, Upload, ExternalLink, ArrowUp, ArrowDown,
} from "lucide-react";

type Material = {
  id: string;
  modulo_id: string;
  programa_id: string;
  nombre: string;
  url: string;
  tipo: string;
  tamano_bytes: number | null;
  orden: number;
};

type Props = {
  moduloId: string;
  programaId: string;
  editable?: boolean;
};

const ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip";

const MAX_MB = 25;

function detectTipo(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".doc") || n.endsWith(".docx")) return "word";
  if (n.endsWith(".xls") || n.endsWith(".xlsx") || n.endsWith(".csv")) return "excel";
  if (n.endsWith(".ppt") || n.endsWith(".pptx")) return "ppt";
  return "otro";
}

function iconFor(tipo: string) {
  switch (tipo) {
    case "pdf": return <FileText className="h-4 w-4 text-red-500" />;
    case "word": return <FileText className="h-4 w-4 text-blue-500" />;
    case "excel": return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
    case "ppt": return <Presentation className="h-4 w-4 text-orange-500" />;
    default: return <FileIcon className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LessonMaterialsManager({ moduloId, programaId, editable = true }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const { data: materials = [], isLoading } = useQuery<Material[]>({
    queryKey: ["lesson_materials", moduloId],
    enabled: !!moduloId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("lesson_materials")
        .select("*")
        .eq("modulo_id", moduloId)
        .order("orden");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["lesson_materials", moduloId] });

  const handleFile = async (file: File) => {
    if (!user) return toast.error("Inicia sesión para subir archivos");
    if (file.size > MAX_MB * 1024 * 1024) {
      return toast.error(`El archivo supera los ${MAX_MB} MB`);
    }
    setBusy(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/materiales/${moduloId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("course-materials")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from("course-materials")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("No se pudo firmar URL");

      const nextOrder = (materials[materials.length - 1]?.orden ?? -1) + 1;
      const { error: insErr } = await (supabase.from as any)("lesson_materials").insert({
        modulo_id: moduloId,
        programa_id: programaId,
        nombre: file.name,
        url: signed.signedUrl,
        tipo: detectTipo(file.name),
        tamano_bytes: file.size,
        orden: nextOrder,
      });
      if (insErr) throw insErr;
      toast.success("Material añadido");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo subir");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeMaterial = async (id: string) => {
    if (!confirm("¿Eliminar este material?")) return;
    const { error } = await (supabase.from as any)("lesson_materials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Material eliminado");
    refresh();
  };

  const saveName = async (id: string) => {
    const nombre = editingName.trim();
    if (!nombre) return setEditingId(null);
    const { error } = await (supabase.from as any)("lesson_materials")
      .update({ nombre }).eq("id", id);
    if (error) return toast.error(error.message);
    setEditingId(null);
    refresh();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = materials[idx + dir];
    const current = materials[idx];
    if (!target || !current) return;
    const a = (supabase.from as any)("lesson_materials")
      .update({ orden: target.orden }).eq("id", current.id);
    const b = (supabase.from as any)("lesson_materials")
      .update({ orden: current.orden }).eq("id", target.id);
    await Promise.all([a, b]);
    refresh();
  };

  return (
    <div className="space-y-2">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando materiales…</p>
      ) : materials.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay materiales en esta lección.</p>
      ) : (
        <ul className="space-y-2">
          {materials.map((m, idx) => (
            <li key={m.id} className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
              {iconFor(m.tipo)}
              {editingId === m.id ? (
                <Input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => saveName(m.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName(m.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="h-8 flex-1"
                />
              ) : (
                <button
                  type="button"
                  className="flex-1 truncate text-left text-sm hover:underline"
                  onClick={() => { if (editable) { setEditingId(m.id); setEditingName(m.nombre); } }}
                  title={editable ? "Click para renombrar" : m.nombre}
                >
                  {m.nombre}
                </button>
              )}
              {m.tamano_bytes ? (
                <span className="text-xs text-muted-foreground">{formatSize(m.tamano_bytes)}</span>
              ) : null}
              <Button type="button" size="sm" variant="ghost" asChild>
                <a href={m.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              {editable && (
                <>
                  <Button type="button" size="sm" variant="ghost"
                    disabled={idx === 0} onClick={() => move(idx, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" variant="ghost"
                    disabled={idx === materials.length - 1} onClick={() => move(idx, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" variant="ghost"
                    className="text-destructive" onClick={() => removeMaterial(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button type="button" size="sm" variant="outline" disabled={busy}
            onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Agregar material
          </Button>
          <p className="text-xs text-muted-foreground">PDF, Word, Excel, PowerPoint · máx. {MAX_MB} MB</p>
        </div>
      )}
    </div>
  );
}
