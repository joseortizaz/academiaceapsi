import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mic, Square, Trash2, Upload, Music } from "lucide-react";
import { toast } from "sonner";

type Props = {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
};

export function AudioUploader({ value, onChange, folder = "audios" }: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const upload = async (file: File | Blob, ext: string, type: string) => {
    if (!user) return toast.error("Inicia sesión para subir audios");
    if (file.size > 50 * 1024 * 1024) return toast.error("El audio supera 50 MB");
    setBusy(true);
    try {
      const path = `${user.id}/${folder}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("course-materials")
        .upload(path, file, { upsert: true, contentType: type });
      if (error) throw error;
      const { data, error: signErr } = await supabase.storage
        .from("course-materials")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !data?.signedUrl) throw signErr ?? new Error("No se pudo firmar URL");
      onChange(data.signedUrl);
      toast.success("Audio guardado");
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
        await upload(blob, "webm", "audio/webm");
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e: any) {
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

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-2">
      {value && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
          <Music className="h-4 w-4 shrink-0 text-primary" />
          <audio src={value} controls className="h-8 flex-1" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => onChange(null)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

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
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              const ext = f.name.split(".").pop()?.toLowerCase() || "mp3";
              upload(f, ext, f.type || "audio/mpeg");
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" disabled={busy || recording} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Subir archivo
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Graba directamente desde el navegador o sube MP3/WAV/M4A · máx. 50 MB
      </p>
    </div>
  );
}
