import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Loader2, Trash2, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Props = {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  accept?: string;
  maxMb?: number;
  label?: string;
  hint?: string;
  bucket?: string;
};

const DEFAULT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";

export function FileUploader({
  value,
  onChange,
  folder = "materiales",
  accept = DEFAULT_ACCEPT,
  maxMb = 25,
  label = "Subir archivo",
  hint = "PDF, Word, Excel o PowerPoint · máx. 25 MB",
}: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const fileName = value ? decodeURIComponent(value.split("/").pop()?.split("?")[0] ?? "") : "";

  const handleFile = async (file: File) => {
    if (!user) return toast.error("Inicia sesión para subir archivos");
    if (file.size > maxMb * 1024 * 1024) {
      return toast.error(`El archivo supera los ${maxMb} MB`);
    }
    setBusy(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${folder}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from("course-materials")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data, error: signErr } = await supabase.storage
        .from("course-materials")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !data?.signedUrl) throw signErr ?? new Error("No se pudo firmar URL");
      onChange(data.signedUrl);
      toast.success("Archivo subido");
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo subir el archivo");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 truncate text-sm">{fileName}</span>
          <Button type="button" size="sm" variant="ghost" asChild>
            <a href={value} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
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
      ) : null}

      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {value ? "Reemplazar archivo" : label}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
