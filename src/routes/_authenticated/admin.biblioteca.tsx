import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, EyeOff, FileText, Search, Star } from "lucide-react";
import {
  AdminPageHeader,
  CreateButton,
  DeleteButton,
  EditButton,
  EmptyState,
  FormDialog,
} from "@/components/admin/AdminUI";
import {
  LibraryDocumentFields,
  emptyLibraryDoc,
  type LibraryDocForm,
} from "@/components/admin/LibraryDocumentFields";
import {
  LibraryCategoriesManager,
  useLibraryCategories,
} from "@/components/admin/LibraryCategoriesManager";
import {
  LIBRARY_COVERS_BUCKET,
  LIBRARY_ESTADOS,
  LIBRARY_FILES_BUCKET,
  SLUG_REGEX,
  formatFileSize,
  storagePathFromPublicUrl,
  type LibraryEstado,
} from "@/lib/library";

export const Route = createFileRoute("/_authenticated/admin/biblioteca")({
  staticData: { sitemap: false },
  component: BibliotecaAdminPage,
});

const DOCS_KEY = ["admin", "biblioteca", "documentos"] as const;

type DocRow = {
  id: string;
  slug: string;
  titulo: string;
  autores: string | null;
  descripcion: string | null;
  categoria_id: string | null;
  etiquetas: string[];
  anio: number | null;
  idioma: string;
  paginas: number | null;
  tamano_bytes: number | null;
  portada_url: string | null;
  file_path: string | null;
  licencia: string | null;
  estado: string;
  destacado: boolean;
  descargas: number;
  published_at: string | null;
  updated_at: string;
};

function toForm(r: DocRow): LibraryDocForm {
  return {
    id: r.id,
    slug: r.slug,
    titulo: r.titulo,
    autores: r.autores ?? "",
    descripcion: r.descripcion ?? "",
    categoria_id: r.categoria_id,
    etiquetas: r.etiquetas ?? [],
    anio: r.anio ? String(r.anio) : "",
    idioma: r.idioma || "es",
    paginas: r.paginas ? String(r.paginas) : "",
    tamano_bytes: r.tamano_bytes,
    portada_url: r.portada_url ?? "",
    file_path: r.file_path,
    licencia: r.licencia ?? "",
    estado: (r.estado as LibraryEstado) ?? "borrador",
    destacado: r.destacado,
    published_at: r.published_at,
    slugEditado: true,
  };
}

/** Traduce los errores de restricciones de la base de datos a mensajes claros. */
function mensajeError(error: { code?: string; message: string }): string {
  const m = error.message ?? "";
  if (error.code === "23505" || m.includes("library_documents_slug_key")) {
    return "Ya existe un documento con ese enlace público. Cambia el enlace.";
  }
  if (m.includes("library_documents_publicable")) {
    return "Para publicar, el documento necesita el PDF y la licencia.";
  }
  if (m.includes("slug_format"))
    return "El enlace solo admite letras minúsculas, números y guiones.";
  if (m.includes("anio_check")) return "El año debe estar entre 1500 y 2100.";
  if (m.includes("no se puede cambiar"))
    return "El enlace no se puede cambiar después de publicar.";
  return m || "No se pudo guardar";
}

async function borrarArchivos(
  pdfs: (string | null | undefined)[],
  portadas: (string | null | undefined)[],
) {
  const pdfPaths = pdfs.filter((p): p is string => !!p);
  const coverPaths = portadas
    .map((u) => storagePathFromPublicUrl(u, LIBRARY_COVERS_BUCKET))
    .filter((p): p is string => !!p);
  const tareas: Promise<unknown>[] = [];
  if (pdfPaths.length) tareas.push(supabase.storage.from(LIBRARY_FILES_BUCKET).remove(pdfPaths));
  if (coverPaths.length)
    tareas.push(supabase.storage.from(LIBRARY_COVERS_BUCKET).remove(coverPaths));
  await Promise.allSettled(tareas);
}

function EstadoBadge({ estado }: { estado: string }) {
  const label = LIBRARY_ESTADOS[estado as LibraryEstado] ?? estado;
  if (estado === "publicado") return <Badge>{label}</Badge>;
  if (estado === "oculto") return <Badge variant="secondary">{label}</Badge>;
  return <Badge variant="outline">{label}</Badge>;
}

function BibliotecaAdminPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryDocForm>(emptyLibraryDoc);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  // Archivos subidos mientras el formulario está abierto. Si se cancela, se borran
  // para no dejar PDF o portadas huérfanos en Storage.
  const pendientes = useRef<{ pdfs: string[]; portadas: string[] }>({ pdfs: [], portadas: [] });
  const guardado = useRef(false);

  const { data: categorias = [] } = useLibraryCategories();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: DOCS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_documents")
        .select(
          "id, slug, titulo, autores, descripcion, categoria_id, etiquetas, anio, idioma, paginas, tamano_bytes, portada_url, file_path, licencia, estado, destacado, descargas, published_at, updated_at",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const nombreCategoria = useMemo(
    () => new Map(categorias.map((c) => [c.id, c.nombre])),
    [categorias],
  );
  const conteoPorCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of docs)
      if (d.categoria_id) m.set(d.categoria_id, (m.get(d.categoria_id) ?? 0) + 1);
    return m;
  }, [docs]);

  const resumen = useMemo(
    () => ({
      publicados: docs.filter((d) => d.estado === "publicado").length,
      borradores: docs.filter((d) => d.estado === "borrador").length,
      descargas: docs.reduce((a, d) => a + (d.descargas ?? 0), 0),
    }),
    [docs],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return docs.filter((d) => {
      if (filtroEstado !== "todos" && d.estado !== filtroEstado) return false;
      if (!q) return true;
      return [d.titulo, d.autores ?? "", d.slug, ...(d.etiquetas ?? [])].some((t) =>
        t.toLowerCase().includes(q),
      );
    });
  }, [docs, busqueda, filtroEstado]);

  /** Una portada que usa otro documento nunca se borra (p. ej. si se pegó su URL). */
  const enUso = (url: string, excepto?: string) =>
    docs.some((d) => d.portada_url === url && d.id !== excepto);

  const abrir = (form: LibraryDocForm) => {
    pendientes.current = { pdfs: [], portadas: [] };
    guardado.current = false;
    setEditing(form);
    setOpen(true);
  };

  const cambiarOpen = (v: boolean) => {
    if (!v && !guardado.current) {
      // Cerrado sin guardar: borrar lo subido en esta sesión del formulario.
      const { pdfs, portadas } = pendientes.current;
      const propias = portadas.filter((u) => !enUso(u));
      if (pdfs.length || propias.length) void borrarArchivos(pdfs, propias);
      pendientes.current = { pdfs: [], portadas: [] };
    }
    setOpen(v);
  };

  const save = async (v: LibraryDocForm) => {
    const titulo = v.titulo.trim();
    const slug = v.slug.trim();
    if (!titulo) return toast.error("El título es obligatorio");
    if (!SLUG_REGEX.test(slug)) {
      return toast.error(
        "El enlace solo admite letras minúsculas, números y guiones (sin guion al inicio o final)",
      );
    }
    const anio = v.anio ? Number(v.anio) : null;
    if (anio !== null && (!Number.isInteger(anio) || anio < 1500 || anio > 2100)) {
      return toast.error("El año debe estar entre 1500 y 2100");
    }
    const paginas = v.paginas ? Number(v.paginas) : null;
    if (paginas !== null && (!Number.isInteger(paginas) || paginas < 1)) {
      return toast.error("El número de páginas no es válido");
    }
    if (v.estado === "publicado") {
      if (!v.file_path) return toast.error("Sube el PDF antes de publicar");
      if (!v.licencia.trim()) return toast.error("Indica la licencia antes de publicar");
    }

    const payload = {
      slug,
      titulo,
      autores: v.autores.trim() || null,
      descripcion: v.descripcion.trim() || null,
      categoria_id: v.categoria_id || null,
      etiquetas: v.etiquetas,
      anio,
      idioma: v.idioma || "es",
      paginas,
      tamano_bytes: v.tamano_bytes,
      portada_url: v.portada_url.trim() || null,
      file_path: v.file_path,
      licencia: v.licencia.trim() || null,
      estado: v.estado,
      destacado: v.destacado,
    };

    const anterior = v.id ? docs.find((d) => d.id === v.id) : undefined;
    const { error } = v.id
      ? await supabase.from("library_documents").update(payload).eq("id", v.id)
      : await supabase.from("library_documents").insert(payload);
    if (error) return toast.error(mensajeError(error));

    // Limpieza: lo subido y no usado, y lo que fue reemplazado.
    const { pdfs, portadas } = pendientes.current;
    const pdfsSobrantes = pdfs.filter((p) => p !== payload.file_path);
    const portadasSobrantes = portadas.filter((u) => u !== payload.portada_url && !enUso(u, v.id));
    if (anterior?.file_path && anterior.file_path !== payload.file_path)
      pdfsSobrantes.push(anterior.file_path);
    if (
      anterior?.portada_url &&
      anterior.portada_url !== payload.portada_url &&
      !enUso(anterior.portada_url, v.id)
    ) {
      portadasSobrantes.push(anterior.portada_url);
    }
    void borrarArchivos(pdfsSobrantes, portadasSobrantes);

    guardado.current = true;
    pendientes.current = { pdfs: [], portadas: [] };
    toast.success(v.id ? "Documento actualizado" : "Documento creado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: DOCS_KEY });
  };

  const cambiarEstado = async (d: DocRow, estado: LibraryEstado) => {
    const { error } = await supabase.from("library_documents").update({ estado }).eq("id", d.id);
    if (error) return toast.error(mensajeError(error));
    toast.success(estado === "publicado" ? "Documento publicado" : "Documento ocultado");
    qc.invalidateQueries({ queryKey: DOCS_KEY });
  };

  const remove = async (d: DocRow) => {
    const { error } = await supabase.from("library_documents").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    await borrarArchivos(
      [d.file_path],
      d.portada_url && !enUso(d.portada_url, d.id) ? [d.portada_url] : [],
    );
    toast.success("Documento eliminado");
    qc.invalidateQueries({ queryKey: DOCS_KEY });
  };

  return (
    <div>
      <AdminPageHeader
        title="Biblioteca Virtual"
        description="Documentos PDF del catálogo público. La descarga requiere iniciar sesión."
        action={
          <CreateButton label="Nuevo documento" onClick={() => abrir({ ...emptyLibraryDoc })} />
        }
      />

      <Tabs defaultValue="documentos">
        <TabsList>
          <TabsTrigger value="documentos">Documentos ({docs.length})</TabsTrigger>
          <TabsTrigger value="categorias">Categorías ({categorias.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="documentos" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <ResumenTile label="Publicados" valor={resumen.publicados} />
            <ResumenTile label="Borradores" valor={resumen.borradores} />
            <ResumenTile label="Descargas totales" valor={resumen.descargas} />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[14rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por título, autor o etiqueta"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {Object.entries(LIBRARY_ESTADOS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando documentos…</p>
          ) : docs.length === 0 ? (
            <EmptyState>
              La biblioteca está vacía. Crea primero las categorías y luego sube el primer
              documento.
            </EmptyState>
          ) : filtrados.length === 0 ? (
            <EmptyState>Ningún documento coincide con la búsqueda.</EmptyState>
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14" />
                    <TableHead>Documento</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Descargas</TableHead>
                    <TableHead>Actualizado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        {d.portada_url ? (
                          <img
                            src={d.portada_url}
                            alt=""
                            loading="lazy"
                            className="h-14 w-10 rounded border object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-10 items-center justify-center rounded border bg-muted">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 font-medium">
                          {d.destacado && (
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          )}
                          {d.titulo}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[d.autores, d.anio, formatFileSize(d.tamano_bytes)]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                        {(!d.file_path || !d.licencia) && (
                          <div className="mt-1 text-xs text-amber-600">
                            Falta{" "}
                            {[!d.file_path && "el PDF", !d.licencia && "la licencia"]
                              .filter(Boolean)
                              .join(" y ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {d.categoria_id ? (nombreCategoria.get(d.categoria_id) ?? "—") : "—"}
                      </TableCell>
                      <TableCell>
                        <EstadoBadge estado={d.estado} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{d.descargas}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(d.updated_at).toLocaleDateString("es-DO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {d.estado === "publicado" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Ocultar del catálogo"
                            onClick={() => cambiarEstado(d, "oculto")}
                          >
                            <EyeOff className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Publicar en el catálogo"
                            onClick={() => cambiarEstado(d, "publicado")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <EditButton onClick={() => abrir(toForm(d))} />
                        <DeleteButton
                          onConfirm={() => remove(d)}
                          label={`"${d.titulo}" junto con su PDF y su portada`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="categorias">
          <LibraryCategoriesManager conteo={conteoPorCategoria} />
        </TabsContent>
      </Tabs>

      <FormDialog<LibraryDocForm>
        title={editing.id ? "Editar documento" : "Nuevo documento"}
        open={open}
        onOpenChange={cambiarOpen}
        initial={editing}
        onSubmit={save}
      >
        {(s, set) => (
          <LibraryDocumentFields
            s={s}
            set={set}
            categorias={categorias}
            onPdfUploaded={(path) => pendientes.current.pdfs.push(path)}
            onCoverUploaded={(url) => pendientes.current.portadas.push(url)}
          />
        )}
      </FormDialog>
    </div>
  );
}

function ResumenTile({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{valor}</p>
    </div>
  );
}
