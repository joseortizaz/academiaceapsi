import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { getLibraryDownloadUrl } from "@/lib/library.functions";
import { useReadingProgress } from "@/components/library/LibraryAccess";
import { PdfReader, type ReaderLocation } from "@/components/library/reader/PdfReader";
import {
  parseColor,
  parseRects,
  type Annotation,
  type ColorKey,
  type NewAnnotation,
} from "@/lib/library-reader";

type DocLector = { id: string; slug: string; titulo: string };

async function cargarDocumento(slug: string): Promise<DocLector | null> {
  const { data } = await supabase
    .from("library_catalog")
    .select("id, slug, titulo")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id && data.slug && data.titulo
    ? { id: data.id, slug: data.slug, titulo: data.titulo }
    : null;
}

export const Route = createFileRoute("/biblioteca/$slug_/leer")({
  staticData: { sitemap: false },
  loader: async ({ params }) => {
    try {
      return { doc: await cargarDocumento(params.slug) };
    } catch {
      return { doc: null as DocLector | null };
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.doc
          ? `Leyendo: ${loaderData.doc.titulo} | Biblioteca Virtual`
          : "Lector | Biblioteca Virtual",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LectorPage,
});

const ANOTACION_COLUMNAS = "id, pagina, color, rects, texto, nota, created_at";

type FilaAnotacion = {
  id: string;
  pagina: number;
  color: string;
  rects: Json;
  texto: string | null;
  nota: string | null;
  created_at: string;
};

function aAnotacion(f: FilaAnotacion): Annotation {
  return {
    id: f.id,
    pagina: f.pagina,
    color: parseColor(f.color),
    rects: parseRects(f.rects),
    texto: f.texto,
    nota: f.nota,
    created_at: f.created_at,
  };
}

function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-muted p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}

function LectorPage() {
  const { slug } = Route.useParams();
  const { doc } = Route.useLoaderData();
  const { isAuthenticated, isLoading: authCargando, user } = useAuth();
  const pedirUrl = useServerFn(getLibraryDownloadUrl);
  const qc = useQueryClient();

  const [archivo, setArchivo] = useState<Uint8Array | null>(null);
  const [descarga, setDescarga] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const progreso = useReadingProgress(doc?.id, user?.id);
  const anotacionesKey = ["biblioteca", "anotaciones", doc?.id, user?.id];
  const { data: anotaciones = [] } = useQuery({
    queryKey: anotacionesKey,
    enabled: !!doc?.id && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_annotations")
        .select(ANOTACION_COLUMNAS)
        .eq("document_id", doc!.id)
        .order("pagina")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((f) => aAnotacion(f as FilaAnotacion));
    },
  });

  // Descarga el PDF completo una sola vez: el enlace firmado dura 5 minutos y así
  // la lectura no depende de él después.
  useEffect(() => {
    if (!doc || !isAuthenticated) return;
    let cancelado = false;
    (async () => {
      try {
        setDescarga(0);
        const { url } = await pedirUrl({ data: { documentId: doc.id, modo: "leer" } });
        const res = await fetch(url);
        if (!res.ok || !res.body) throw new Error("No se pudo descargar el documento.");
        const total = Number(res.headers.get("content-length")) || 0;
        const reader = res.body.getReader();
        const partes: Uint8Array[] = [];
        let recibido = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (cancelado) return;
          partes.push(value);
          recibido += value.length;
          if (total) setDescarga(Math.round((recibido / total) * 100));
        }
        const datos = new Uint8Array(recibido);
        let pos = 0;
        for (const p of partes) {
          datos.set(p, pos);
          pos += p.length;
        }
        if (!cancelado) setArchivo(datos);
      } catch (e) {
        if (cancelado) return;
        const msg = e instanceof Error ? e.message : "";
        setError(
          msg.startsWith("Unauthorized")
            ? "Tu sesión expiró. Inicia sesión de nuevo."
            : msg || "No se pudo abrir el documento.",
        );
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [doc, isAuthenticated, pedirUrl]);

  // ----- Guardar dónde quedó la lectura (con pausa para no escribir en cada scroll) -----
  const pendiente = useRef<ReaderLocation | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const guardarProgreso = useCallback(async () => {
    const loc = pendiente.current;
    if (!loc || !doc || !user) return;
    pendiente.current = null;
    const { error } = await supabase.from("library_reading_progress").upsert(
      {
        user_id: user.id,
        document_id: doc.id,
        pagina: loc.pagina,
        total_paginas: loc.total || null,
        escala: loc.escala,
      },
      { onConflict: "user_id,document_id" },
    );
    if (error) console.error("No se pudo guardar el progreso:", error.message);
  }, [doc, user]);

  const alMoverse = useCallback(
    (loc: ReaderLocation) => {
      pendiente.current = loc;
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => void guardarProgreso(), 1500);
    },
    [guardarProgreso],
  );

  useEffect(() => {
    const alSalir = () => void guardarProgreso();
    window.addEventListener("pagehide", alSalir);
    return () => {
      window.removeEventListener("pagehide", alSalir);
      clearTimeout(temporizador.current);
      void guardarProgreso().then(() =>
        qc.invalidateQueries({ queryKey: ["biblioteca", "progreso"] }),
      );
    };
  }, [guardarProgreso, qc]);

  // ----- Resaltados y notas (solo del autor; lo garantiza RLS en la base de datos) -----
  const setAnotaciones = (fn: (prev: Annotation[]) => Annotation[]) =>
    qc.setQueryData<Annotation[]>(anotacionesKey, (prev) => fn(prev ?? []));

  const crear = async (a: NewAnnotation): Promise<Annotation | null> => {
    if (!doc) return null;
    const { data, error } = await supabase
      .from("library_annotations")
      .insert({
        document_id: doc.id,
        pagina: a.pagina,
        color: a.color,
        rects: a.rects as unknown as Json,
        texto: a.texto,
        nota: a.nota,
      })
      .select(ANOTACION_COLUMNAS)
      .single();
    if (error || !data) {
      toast.error("No se pudo guardar el resaltado.");
      return null;
    }
    const nueva = aAnotacion(data as FilaAnotacion);
    setAnotaciones((prev) => [...prev, nueva]);
    return nueva;
  };

  const actualizar = async (id: string, patch: { color?: ColorKey; nota?: string | null }) => {
    const previas = qc.getQueryData<Annotation[]>(anotacionesKey) ?? [];
    setAnotaciones((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    const { error } = await supabase.from("library_annotations").update(patch).eq("id", id);
    if (error) {
      qc.setQueryData(anotacionesKey, previas);
      toast.error("No se pudo guardar el cambio.");
      return false;
    }
    return true;
  };

  const eliminar = async (id: string) => {
    const previas = qc.getQueryData<Annotation[]>(anotacionesKey) ?? [];
    setAnotaciones((prev) => prev.filter((a) => a.id !== id));
    const { error } = await supabase.from("library_annotations").delete().eq("id", id);
    if (error) {
      qc.setQueryData(anotacionesKey, previas);
      toast.error("No se pudo eliminar.");
      return false;
    }
    return true;
  };

  // ----- Pantallas -----
  if (!doc) {
    return (
      <Pantalla>
        <h1 className="text-xl font-bold">Documento no disponible</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puede que haya sido retirado del catálogo.
        </p>
        <Button asChild className="mt-5">
          <Link to="/biblioteca">Ir a la Biblioteca</Link>
        </Button>
      </Pantalla>
    );
  }

  if (authCargando) {
    return (
      <Pantalla>
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </Pantalla>
    );
  }

  if (!isAuthenticated) {
    const volverA = `/biblioteca/${slug}/leer`;
    return (
      <Pantalla>
        <Lock className="mx-auto mb-3 h-6 w-6 text-primary" />
        <h1 className="text-lg font-bold">Inicia sesión para leer</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La lectura en línea es gratuita para usuarios registrados.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/registro" search={{ redirect: volverA }}>
              Crear cuenta gratis
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/acceder" search={{ redirect: volverA }}>
              Iniciar sesión
            </Link>
          </Button>
        </div>
      </Pantalla>
    );
  }

  if (error) {
    return (
      <Pantalla>
        <h1 className="text-lg font-bold">No se pudo abrir el documento</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Reintentar</Button>
          <Button asChild variant="outline">
            <Link to="/biblioteca/$slug" params={{ slug }}>
              Volver a la ficha
            </Link>
          </Button>
        </div>
      </Pantalla>
    );
  }

  // Espera el PDF y la página guardada antes de abrir el lector en esa página.
  if (!archivo || progreso.isPending) {
    return (
      <Pantalla>
        <p className="font-medium">{doc.titulo}</p>
        <p className="mt-1 text-sm text-muted-foreground">Preparando el documento…</p>
        <Progress value={descarga ?? 0} className="mt-4" />
      </Pantalla>
    );
  }

  return (
    <div className="h-[100dvh]">
      <PdfReader
        data={archivo}
        initialPage={progreso.data?.pagina ?? 1}
        initialScale={progreso.data?.escala ?? null}
        annotations={anotaciones}
        onLocationChange={alMoverse}
        onCreate={crear}
        onUpdate={actualizar}
        onDelete={eliminar}
        header={
          <div className="flex min-w-0 items-center gap-1">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link to="/biblioteca/$slug" params={{ slug }} aria-label="Volver a la ficha">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <p className="truncate text-sm font-semibold sm:text-base">{doc.titulo}</p>
          </div>
        }
      />
    </div>
  );
}
