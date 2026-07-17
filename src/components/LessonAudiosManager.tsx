import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Trash2, Upload, Mic, Square, Music, ArrowUp, ArrowDown } from "lucide-react";

type Audio = {
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

const MAX_MB = 50;
const ACCEPT = "audio/*,.mp3,.wav,.m4a,.ogg,.aac,.webm";

export function LessonAudiosManager({ moduloId, programaId, editable = true }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const { data: audios = [], isLoading } = useQuery<Audio[]>({
    queryKey: ["lesson_audios", moduloId],
    enabled: !!moduloId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("lesson_materials")
        .select("*")
        .eq("modulo_id", moduloId)
        .eq("tipo", "audio")
        .order("orden");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["lesson_audios", moduloId] });

  const upload = async (file: File | Blob, filename: string, contentType: string, sizeBytes: number) => {
    if (!user) return toast.error("Inicia sesión para subir audios");
    if (sizeBytes > MAX_MB * 1024 * 1024) return toast.error(`El audio supera ${MAX_MB} MB`);
    setBusy(true);
    try {
      const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/audios/${moduloId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("course-materials")
        .upload(path, file, { upsert: true, contentType });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from("course-materials")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("No se pudo firmar URL");

      const nextOrder = (audios[audios.length - 1]?.orden ?? -1) + 1;
      const { error: insErr } = await (supabase.from as any)("lesson_materials").insert({
        modulo_id: moduloId,
        programa_id: programaId,
        nombre: filename,
        url: signed.signedUrl,
        tipo: "audio",
        tamano_bytes: sizeBytes,
        orden: nextOrder,
      });
      if (insErr) throw insErr;
      toast.success("Audio añadido");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo subir el audio");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await upload(blob, `grabacion-${Date.now()}.webm`, "audio/webm", blob.size);
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este audio?")) return;
    const { error } = await (supabase.from as any)("lesson_materials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Audio eliminado");
    refresh();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = audios[idx + dir];
    const current = audios[idx];
    if (!target || !current) return;
    await Promise.all([
      (supabase.from as any)("lesson_materials").update({ orden: target.orden }).eq("id", current.id),
      (supabase.from as any)("lesson_materials").update({ orden: current.orden }).eq("id", target.id),
    ]);
    refresh();
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-2">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando audios…</p>
      ) : audios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay audios en esta lección.</p>
      ) : (
        <ul className="space-y-2">
          {audios.map((a, idx) => (
            <li key={a.id} className="rounded-md border bg-muted/30 p-2 space-y-2">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 truncate text-sm" title={a.nombre}>{a.nombre}</span>
                {editable && (
                  <>
                    <Button type="button" size="sm" variant="ghost"
                      disabled={idx === 0} onClick={() => move(idx, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost"
                      disabled={idx === audios.length - 1} onClick={() => move(idx, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost"
                      className="text-destructive" onClick={() => remove(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              <audio src={a.url} controls preload="metadata" className="w-full" />
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          {!recording ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={startRecording}>
              <Mic className="mr-2 h-4 w-4" /> Grabar audio
            </Button>
          ) : (
            <Button type="button" size="sm" variant="destructive" onClick={stopRecording}>
              <Square className="mr-2 h-4 w-4" /> Detener ({fmt(seconds)})
            </Button>
          )}
          <Input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f, f.name, f.type || "audio/mpeg", f.size);
            }}
          />
          <Button type="button" size="sm" variant="outline" disabled={busy || recording}
            onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Subir audio
          </Button>
          <p className="text-xs text-muted-foreground">MP3, WAV, M4A, OGG · máx. {MAX_MB} MB por archivo</p>
        </div>
      )}
    </div>
  );
}
