import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ExternalLink, FileText, Loader2, Upload } from "lucide-react";
import { LIBRARY_FILES_BUCKET, LIBRARY_PDF_MAX_MB, formatFileSize } from "@/lib/library";

export type UploadedPdf = {
  /** Archivo local recién subido (sirve para generar la portada sin descargarlo). */
  file: File;
  path: string;
  size: number;
  paginas: number | null;
};

type Props = {
  /** Ruta actual del PDF en el bucket privado (si ya existe). */
  path: string | null;
  size: number | null;
  onUploaded: (pdf: UploadedPdf) => void;
};

/**
 * Cuenta las páginas de un PDF de forma aproximada leyendo su estructura.
 * Sirve como sugerencia: si no se puede leer, devuelve null y el admin lo escribe a mano.
 */
async function contarPaginas(file: File): Promise<number | null> {
  try {
    const buf = await file.arrayBuffer();
    const text = new TextDecoder("latin1").decode(buf);
    let max = 0;
    for (const m of text.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g)) {
      max = Math.max(max, Number(m[1]));
    }
    if (max === 0) {
      for (const m of text.matchAll(/\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g)) {
        max = Math.max(max, Number(m[1]));
      }
    }
    if (max === 0) {
      max = (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
    }
    return max > 0 && max < 100000 ? max : null;
  } catch {
    return null;
  }
}

async function esPdf(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...head) === "%PDF-";
}

export function LibraryPdfUploader({ path, size, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);

  const handleFile = async (file: File) => {
    if (!(await esPdf(file))) {
      toast.error("El archivo debe ser un PDF");
      return;
    }
    if (file.size > LIBRARY_PDF_MAX_MB * 1024 * 1024) {
      toast.error(`El PDF supera los ${LIBRARY_PDF_MAX_MB} MB`);
      return;
    }
    setLoading(true);
    try {
      const newPath = `documentos/${crypto.randomUUID()}.pdf`;
      const { error } = await supabase.storage.from(LIBRARY_FILES_BUCKET).upload(newPath, file, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const paginas = await contarPaginas(file);
      onUploaded({ file, path: newPath, size: file.size, paginas });
      toast.success("PDF cargado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el PDF");
    } finally {
      setLoading(false);
    }
  };

  const verPdf = async () => {
    if (!path) return;
    setOpening(true);
    const win = window.open("", "_blank");
    const { data, error } = await supabase.storage
      .from(LIBRARY_FILES_BUCKET)
      .createSignedUrl(path, 300);
    setOpening(false);
    if (error || !data?.signedUrl) {
      win?.close();
      toast.error(error?.message ?? "No se pudo abrir el PDF");
      return;
    }
    if (win) win.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  };

  return (
    <div className="space-y-2">
      {path ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <FileText className="h-8 w-8 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">PDF cargado</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(size)}</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={verPdf} disabled={opening}>
            {opening ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            <span className="ml-1">Ver</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reemplazar"}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/60"
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Upload className="h-6 w-6" />
              <span className="text-sm">Haz clic para subir el PDF</span>
              <span className="text-xs">Solo PDF, máx. {LIBRARY_PDF_MAX_MB} MB</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
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
