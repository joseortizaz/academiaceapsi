import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";

interface ImageUploaderProps {
  bucket?: string;
  folder?: string;
  value?: string;
  onChange: (url: string) => void;
}

export function ImageUploader({
  bucket = "course-images",
  folder = "programs",
  value,
  onChange,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Máximo 5 MB");
      return;
    }
    setLoading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Imagen cargada");
    } catch (e: any) {
      toast.error(e.message ?? "Error al subir imagen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative w-full overflow-hidden rounded-lg border bg-muted">
          <img src={value} alt="Vista previa" className="h-48 w-full object-cover" />
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute right-2 top-2 h-7 w-7"
            onClick={() => onChange("")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/60"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Upload className="h-6 w-6" />
              <span className="text-sm">Haz clic para subir imagen</span>
              <span className="text-xs">JPG, PNG, WEBP (máx. 5 MB)</span>
            </>
          )}
        </button>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {value ? "Cambiar" : "Subir archivo"}
        </Button>
        <Input
          placeholder="o pega una URL pública"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
