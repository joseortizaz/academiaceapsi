import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { LibraryPdfUploader, type UploadedPdf } from "@/components/admin/LibraryPdfUploader";
import {
  LIBRARY_COVERS_BUCKET,
  LIBRARY_DESCRIPCION_MAX,
  LIBRARY_FILES_BUCKET,
  LIBRARY_ESTADOS,
  LIBRARY_IDIOMAS,
  LIBRARY_LICENCIAS_SUGERIDAS,
  slugify,
  type LibraryEstado,
} from "@/lib/library";

export type LibraryDocForm = {
  id?: string;
  slug: string;
  titulo: string;
  autores: string;
  descripcion: string;
  categoria_id: string | null;
  etiquetas: string[];
  anio: string;
  idioma: string;
  paginas: string;
  tamano_bytes: number | null;
  portada_url: string;
  file_path: string | null;
  licencia: string;
  estado: LibraryEstado;
  destacado: boolean;
  /** Fecha de primera publicación; si existe, el enlace queda fijo. */
  published_at: string | null;
  /** Solo en el formulario: el admin editó el enlace a mano. */
  slugEditado: boolean;
};

export const emptyLibraryDoc: LibraryDocForm = {
  slug: "",
  titulo: "",
  autores: "",
  descripcion: "",
  categoria_id: null,
  etiquetas: [],
  anio: "",
  idioma: "es",
  paginas: "",
  tamano_bytes: null,
  portada_url: "",
  file_path: null,
  licencia: "",
  estado: "borrador",
  destacado: false,
  published_at: null,
  slugEditado: false,
};

type Props = {
  s: LibraryDocForm;
  set: (patch: Partial<LibraryDocForm>) => void;
  categorias: { id: string; nombre: string }[];
  onPdfUploaded: (path: string) => void;
  onCoverUploaded: (url: string) => void;
};

export function LibraryDocumentFields({
  s,
  set,
  categorias,
  onPdfUploaded,
  onCoverUploaded,
}: Props) {
  const slugFijo = !!s.published_at;
  const [generando, setGenerando] = useState(false);
  // PDF subido en esta sesión del formulario: evita volver a descargarlo para la portada.
  const pdfLocal = useRef<{ path: string; file: File } | null>(null);

  const generarPortada = async (origen?: Blob, automatica = false) => {
    setGenerando(true);
    try {
      let pdf = origen;
      if (!pdf && s.file_path) {
        if (pdfLocal.current?.path === s.file_path) {
          pdf = pdfLocal.current.file;
        } else {
          const { data, error } = await supabase.storage
            .from(LIBRARY_FILES_BUCKET)
            .download(s.file_path);
          if (error || !data) throw error ?? new Error("No se pudo leer el PDF");
          pdf = data;
        }
      }
      if (!pdf) return;

      const { renderPdfCover } = await import("@/lib/pdf-cover");
      const imagen = await renderPdfCover(pdf);
      const path = `portadas/auto-${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(LIBRARY_COVERS_BUCKET)
        .upload(path, imagen, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(LIBRARY_COVERS_BUCKET).getPublicUrl(path);
      onCoverUploaded(data.publicUrl);
      set({ portada_url: data.publicUrl });
      toast.success(automatica ? "Portada creada a partir de la primera página" : "Portada creada");
    } catch (e) {
      toast.error(
        automatica
          ? "No se pudo crear la portada automática; puedes subir una imagen."
          : e instanceof Error
            ? e.message
            : "No se pudo crear la portada",
      );
    } finally {
      setGenerando(false);
    }
  };

  return (
    <>
      <div className="grid gap-2">
        <Label>Archivo PDF</Label>
        <LibraryPdfUploader
          path={s.file_path}
          size={s.tamano_bytes}
          onUploaded={(pdf: UploadedPdf) => {
            onPdfUploaded(pdf.path);
            pdfLocal.current = { path: pdf.path, file: pdf.file };
            set({
              file_path: pdf.path,
              tamano_bytes: pdf.size,
              ...(pdf.paginas ? { paginas: String(pdf.paginas) } : {}),
            });
            // Sin portada: se crea a partir de la primera página.
            if (!s.portada_url) void generarPortada(pdf.file, true);
          }}
        />
      </div>

      <div className="grid gap-2">
        <Label>Título</Label>
        <Input
          value={s.titulo}
          maxLength={300}
          onChange={(e) =>
            set({
              titulo: e.target.value,
              ...(!s.slugEditado && !slugFijo ? { slug: slugify(e.target.value) } : {}),
            })
          }
          required
        />
      </div>

      <div className="grid gap-2">
        <Label>Enlace público</Label>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-muted-foreground">/biblioteca/</span>
          <Input
            value={s.slug}
            disabled={slugFijo}
            onChange={(e) =>
              set({
                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                slugEditado: true,
              })
            }
            required
          />
        </div>
        {slugFijo && (
          <p className="text-xs text-muted-foreground">
            El enlace no se puede cambiar porque el documento ya fue publicado y pudo haberse
            compartido.
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Autores</Label>
        <Input
          value={s.autores}
          onChange={(e) => set({ autores: e.target.value })}
          placeholder="Ej. María Pérez, Juan Gómez"
        />
      </div>

      <div className="grid gap-2">
        <Label>Descripción pública</Label>
        <Textarea
          rows={5}
          value={s.descripcion}
          maxLength={LIBRARY_DESCRIPCION_MAX}
          onChange={(e) => set({ descripcion: e.target.value })}
          placeholder="Resumen que verán los visitantes en el catálogo y en la ficha del documento."
        />
        <p className="text-right text-xs text-muted-foreground">
          {s.descripcion.length} / {LIBRARY_DESCRIPCION_MAX}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Portada</Label>
          <ImageUploader
            bucket={LIBRARY_COVERS_BUCKET}
            folder="portadas"
            value={s.portada_url}
            onChange={(url) => {
              if (url) onCoverUploaded(url);
              set({ portada_url: url });
            }}
          />
          {s.file_path && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start"
              disabled={generando}
              onClick={() => generarPortada()}
            >
              {generando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="mr-2 h-4 w-4" />
              )}
              {generando
                ? "Creando portada…"
                : s.portada_url
                  ? "Reemplazar por la página 1 del PDF"
                  : "Crear portada desde el PDF"}
            </Button>
          )}
        </div>

        <div className="grid content-start gap-4">
          <div className="grid gap-2">
            <Label>Categoría</Label>
            <Select
              value={s.categoria_id ?? "none"}
              onValueChange={(v) => set({ categoria_id: v === "none" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin categoría</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Año</Label>
              <Input
                type="number"
                min={1500}
                max={2100}
                value={s.anio}
                onChange={(e) => set({ anio: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Páginas</Label>
              <Input
                type="number"
                min={1}
                value={s.paginas}
                onChange={(e) => set({ paginas: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Idioma</Label>
              <Select value={s.idioma} onValueChange={(v) => set({ idioma: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LIBRARY_IDIOMAS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Etiquetas (separadas por coma)</Label>
            <Input
              defaultValue={s.etiquetas.join(", ")}
              onBlur={(e) =>
                set({
                  etiquetas: Array.from(
                    new Set(
                      e.target.value
                        .split(",")
                        .map((t) => t.trim().toLowerCase())
                        .filter(Boolean),
                    ),
                  ).slice(0, 20),
                })
              }
              placeholder="ansiedad, adolescencia, evaluación"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Licencia o derechos de uso</Label>
        <Input
          list="library-licencias"
          value={s.licencia}
          onChange={(e) => set({ licencia: e.target.value })}
          placeholder="Obligatoria para publicar"
        />
        <datalist id="library-licencias">
          {LIBRARY_LICENCIAS_SUGERIDAS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        <p className="text-xs text-muted-foreground">
          Indica quién tiene los derechos del documento y si se puede distribuir. Solo publica
          material propio o con permiso.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Estado</Label>
          <Select value={s.estado} onValueChange={(v) => set({ estado: v as LibraryEstado })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LIBRARY_ESTADOS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 sm:mt-7">
          <Switch checked={s.destacado} onCheckedChange={(c) => set({ destacado: c })} />
          <span className="text-sm">Destacado en el catálogo</span>
        </label>
      </div>
    </>
  );
}
