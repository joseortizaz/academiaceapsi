import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ListTree,
  Loader2,
  MessageSquarePlus,
  MoveHorizontal,
  Search,
  StickyNote,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AnnotationsPanel } from "@/components/library/reader/AnnotationsPanel";
import {
  COLORES,
  COLOR_KEYS,
  TEXTO_MAX,
  annotationTop,
  rectsFromClientRects,
  type Annotation,
  type ColorKey,
  type HighlightRect,
  type NewAnnotation,
} from "@/lib/library-reader";

type ViewerModule = typeof import("pdfjs-dist/legacy/web/pdf_viewer.mjs");
type PdfViewer = InstanceType<ViewerModule["PDFViewer"]>;
type EventBus = InstanceType<ViewerModule["EventBus"]>;
type LinkService = InstanceType<ViewerModule["PDFLinkService"]>;

export type ReaderLocation = { pagina: number; total: number; escala: string };

type Props = {
  data: Uint8Array;
  /** Contenido a la izquierda de la barra (volver, título). */
  header?: ReactNode;
  initialPage?: number;
  initialScale?: string | null;
  annotations: Annotation[];
  onLocationChange?: (loc: ReaderLocation) => void;
  onCreate: (a: NewAnnotation) => Promise<Annotation | null>;
  onUpdate: (id: string, patch: { color?: ColorKey; nota?: string | null }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
};

type Seleccion = {
  left: number;
  top: number;
  bottom: number;
  pagina: number;
  rects: HighlightRect[];
  texto: string;
};

type OutlineItem = { titulo: string; dest: string | unknown[] | null; nivel: number };

const ESCALAS_PREDEFINIDAS = ["page-width", "page-fit", "auto", "page-actual"];
const ESCALA_MIN = 0.25;
const ESCALA_MAX = 4;

function escalaValida(v: string | null | undefined) {
  if (!v) return false;
  if (ESCALAS_PREDEFINIDAS.includes(v)) return true;
  const n = Number(v);
  return Number.isFinite(n) && n >= ESCALA_MIN && n <= ESCALA_MAX;
}

function elementoDe(node: Node | null): Element | null {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

type RawOutline = { title: string; dest: string | unknown[] | null; items?: RawOutline[] };

function aplanarIndice(
  items: RawOutline[] | null,
  nivel = 0,
  out: OutlineItem[] = [],
): OutlineItem[] {
  for (const it of items ?? []) {
    if (out.length >= 500) break;
    out.push({ titulo: it.title, dest: it.dest, nivel });
    if (nivel < 3 && it.items?.length) aplanarIndice(it.items, nivel + 1, out);
  }
  return out;
}

export function PdfReader({
  data,
  header,
  initialPage,
  initialScale,
  annotations,
  onLocationChange,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerDivRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PdfViewer | null>(null);
  const busRef = useRef<EventBus | null>(null);
  const linkRef = useRef<LinkService | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [paginaInput, setPaginaInput] = useState("1");
  const [panel, setPanel] = useState<"notas" | "indice" | null>(null);
  const [indice, setIndice] = useState<OutlineItem[]>([]);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [activaId, setActivaId] = useState<string | null>(null);
  const [editarId, setEditarId] = useState<string | null>(null);
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [coincidencias, setCoincidencias] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [sinResultados, setSinResultados] = useState(false);

  // Valores actuales para los manejadores de eventos de pdf.js.
  const annotationsRef = useRef(annotations);
  const activaRef = useRef(activaId);
  const locationRef = useRef(onLocationChange);
  annotationsRef.current = annotations;
  activaRef.current = activaId;
  locationRef.current = onLocationChange;
  const inicialRef = useRef({ initialPage, initialScale });

  /** Dibuja los resaltados de una página como porcentajes: no hay que recalcular al hacer zoom. */
  const dibujarPagina = useCallback((n: number) => {
    const v = viewerRef.current;
    const div = v?.getPageView(n - 1)?.div as HTMLDivElement | undefined;
    if (!div) return;
    let capa = div.querySelector<HTMLDivElement>(":scope > .ceapsi-resaltados");
    const propias = annotationsRef.current.filter((a) => a.pagina === n && a.rects.length);
    if (!capa) {
      if (!propias.length) return;
      capa = document.createElement("div");
      capa.className = "ceapsi-resaltados";
      Object.assign(capa.style, {
        position: "absolute",
        inset: "0",
        pointerEvents: "none",
        mixBlendMode: "multiply",
        zIndex: "1",
      });
      div.appendChild(capa);
    }
    capa.replaceChildren();
    for (const a of propias) {
      for (const r of a.rects) {
        const el = document.createElement("div");
        Object.assign(el.style, {
          position: "absolute",
          left: `${r.x * 100}%`,
          top: `${r.y * 100}%`,
          width: `${r.w * 100}%`,
          height: `${r.h * 100}%`,
          background: COLORES[a.color].fill,
          borderRadius: "2px",
          boxShadow: a.id === activaRef.current ? `0 0 0 2px ${COLORES[a.color].solid}` : "none",
        });
        el.dataset.anotacion = a.id;
        capa.appendChild(el);
      }
    }
  }, []);

  const dibujarTodo = useCallback(() => {
    const v = viewerRef.current;
    if (!v) return;
    for (let i = 1; i <= v.pagesCount; i++) dibujarPagina(i);
  }, [dibujarPagina]);

  useEffect(() => {
    dibujarTodo();
  }, [annotations, activaId, dibujarTodo]);

  // Carga de pdf.js y del documento.
  useEffect(() => {
    let cancelado = false;
    let tarea: { destroy(): Promise<void> } | null = null;
    setListo(false);
    setError(null);

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const { default: workerUrl } =
          await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        // El visor de pdf.js toma la librería de esta variable global.
        (globalThis as unknown as { pdfjsLib: unknown }).pdfjsLib = pdfjs;
        const mod: ViewerModule = await import("pdfjs-dist/legacy/web/pdf_viewer.mjs");
        // Estilos del visor como texto: el minificador de producción no acepta sus rutas relativas.
        if (!document.getElementById("pdfjs-viewer-css")) {
          const { default: css } = await import("pdfjs-dist/legacy/web/pdf_viewer.css?raw");
          const estilo = document.createElement("style");
          estilo.id = "pdfjs-viewer-css";
          // Sus íconos usan rutas relativas que no existen en el sitio: se quitan.
          estilo.textContent = css.replace(/url\((["']?)images\/[^)]*\)/g, "none");
          document.head.appendChild(estilo);
        }
        const container = containerRef.current;
        const viewerDiv = viewerDivRef.current;
        if (cancelado || !container || !viewerDiv) return;

        const eventBus = new mod.EventBus();
        // ignoreDestinationZoom: los enlaces e índice del PDF no cambian el zoom elegido.
        const linkService = new mod.PDFLinkService({ eventBus, ignoreDestinationZoom: true });
        const findController = new mod.PDFFindController({ eventBus, linkService });
        const viewer = new mod.PDFViewer({
          container,
          viewer: viewerDiv,
          eventBus,
          linkService,
          findController,
        });
        linkService.setViewer(viewer);
        viewerRef.current = viewer;
        busRef.current = eventBus;
        linkRef.current = linkService;

        const informar = () => {
          locationRef.current?.({
            pagina: viewer.currentPageNumber,
            total: viewer.pagesCount,
            escala: ESCALAS_PREDEFINIDAS.includes(String(viewer.currentScaleValue))
              ? String(viewer.currentScaleValue)
              : String(Math.round(viewer.currentScale * 1000) / 1000),
          });
        };

        eventBus.on("pagesinit", () => {
          const { initialPage: p, initialScale: e } = inicialRef.current;
          viewer.currentScaleValue = escalaValida(e) ? (e as string) : "page-width";
          if (p && p > 1 && p <= viewer.pagesCount) viewer.currentPageNumber = p;
          setTotal(viewer.pagesCount);
          setListo(true);
        });
        eventBus.on("pagechanging", (e: { pageNumber: number }) => {
          setPagina(e.pageNumber);
          setPaginaInput(String(e.pageNumber));
          informar();
        });
        eventBus.on("scalechanging", (e: { scale: number }) => {
          setZoom(e.scale);
          informar();
        });
        eventBus.on("pagerendered", (e: { pageNumber: number }) => dibujarPagina(e.pageNumber));
        eventBus.on("textlayerrendered", (e: { pageNumber: number }) =>
          dibujarPagina(e.pageNumber),
        );
        eventBus.on(
          "updatefindmatchescount",
          (e: { matchesCount: { current: number; total: number } }) =>
            setCoincidencias(e.matchesCount),
        );
        eventBus.on(
          "updatefindcontrolstate",
          (e: { state: number; matchesCount?: { current: number; total: number } }) => {
            setSinResultados(e.state === 1);
            if (e.matchesCount) setCoincidencias(e.matchesCount);
          },
        );

        // pdf.js puede quedarse con el búfer: se le pasa una copia.
        const loading = pdfjs.getDocument({ data: data.slice() });
        tarea = loading;
        const doc = await loading.promise;
        if (cancelado) return;
        viewer.setDocument(doc);
        linkService.setDocument(doc, null);
        doc
          .getOutline()
          .then((o) => !cancelado && setIndice(aplanarIndice(o as RawOutline[] | null)))
          .catch(() => undefined);
      } catch (e) {
        if (!cancelado) {
          console.error("Lector PDF:", e);
          setError("No se pudo abrir el documento en el lector.");
        }
      }
    })();

    return () => {
      cancelado = true;
      viewerRef.current = null;
      busRef.current = null;
      linkRef.current = null;
      void tarea?.destroy();
    };
  }, [data, dibujarPagina]);

  // Reajusta "ancho de página" cuando cambia el tamaño (paneles, rotar el teléfono).
  useEffect(() => {
    const cont = containerRef.current;
    if (!cont) return;
    const ro = new ResizeObserver(() => {
      const v = viewerRef.current;
      const actual = v ? String(v.currentScaleValue) : "";
      // Volver a asignar el modo ("page-width"…) hace que pdf.js recalcule el zoom.
      if (v && v.pagesCount && ESCALAS_PREDEFINIDAS.includes(actual)) v.currentScaleValue = actual;
    });
    ro.observe(cont);
    return () => ro.disconnect();
  }, []);

  // ----- Selección de texto -> barra para resaltar -----
  const evaluarSeleccion = useCallback(() => {
    const sel = window.getSelection();
    const cont = containerRef.current;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !cont) return setSeleccion(null);
    const range = sel.getRangeAt(0);
    if (!cont.contains(range.commonAncestorContainer)) return setSeleccion(null);
    const pIni = elementoDe(range.startContainer)?.closest<HTMLElement>(".page");
    const pFin = elementoDe(range.endContainer)?.closest<HTMLElement>(".page");
    if (!pIni || !pFin) return setSeleccion(null);
    if (pIni !== pFin) {
      toast.info("Para resaltar, selecciona texto dentro de una misma página.");
      return setSeleccion(null);
    }
    const pagina = Number(pIni.dataset.pageNumber);
    const rects = rectsFromClientRects(
      Array.from(range.getClientRects()),
      pIni.getBoundingClientRect(),
    );
    const texto = sel.toString().replace(/\s+/g, " ").trim().slice(0, TEXTO_MAX);
    if (!rects.length || !texto || !pagina) return setSeleccion(null);
    const box = range.getBoundingClientRect();
    setSeleccion({
      left: box.left + box.width / 2,
      top: box.top,
      bottom: box.bottom,
      pagina,
      rects,
      texto,
    });
  }, []);

  useEffect(() => {
    const cont = containerRef.current;
    if (!cont) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const alSoltar = () => setTimeout(evaluarSeleccion, 0);
    const alCambiar = () => {
      clearTimeout(t);
      t = setTimeout(evaluarSeleccion, 400);
    };
    const alDesplazar = () => setSeleccion(null);
    cont.addEventListener("mouseup", alSoltar);
    cont.addEventListener("scroll", alDesplazar, { passive: true });
    document.addEventListener("selectionchange", alCambiar);
    return () => {
      clearTimeout(t);
      cont.removeEventListener("mouseup", alSoltar);
      cont.removeEventListener("scroll", alDesplazar);
      document.removeEventListener("selectionchange", alCambiar);
    };
  }, [evaluarSeleccion]);

  const crearResaltado = async (color: ColorKey, conNota: boolean) => {
    const s = seleccion;
    if (!s) return;
    window.getSelection()?.removeAllRanges();
    setSeleccion(null);
    const nueva = await onCreate({
      pagina: s.pagina,
      color,
      rects: s.rects,
      texto: s.texto,
      nota: null,
    });
    if (nueva && conNota) {
      setPanel("notas");
      setActivaId(nueva.id);
      setEditarId(nueva.id);
    }
  };

  // Clic sobre un resaltado: lo abre en el panel de notas.
  useEffect(() => {
    const cont = containerRef.current;
    if (!cont) return;
    const alClic = (ev: MouseEvent) => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const pageEl = (ev.target as Element | null)?.closest<HTMLElement>(".page");
      if (!pageEl) return;
      const n = Number(pageEl.dataset.pageNumber);
      const box = pageEl.getBoundingClientRect();
      const fx = (ev.clientX - box.left) / box.width;
      const fy = (ev.clientY - box.top) / box.height;
      const tocada = annotationsRef.current.find(
        (a) =>
          a.pagina === n &&
          a.rects.some(
            (r) =>
              fx >= r.x - 0.003 &&
              fx <= r.x + r.w + 0.003 &&
              fy >= r.y - 0.003 &&
              fy <= r.y + r.h + 0.003,
          ),
      );
      if (tocada) {
        setActivaId(tocada.id);
        setEditarId(null);
        setPanel("notas");
      }
    };
    cont.addEventListener("click", alClic);
    return () => cont.removeEventListener("click", alClic);
  }, []);

  // ----- Navegación -----
  const irAPagina = (n: number) => {
    const v = viewerRef.current;
    if (!v || !v.pagesCount) return;
    v.currentPageNumber = Math.min(Math.max(1, Math.round(n)), v.pagesCount);
  };

  const cambiarZoom = (factor: number) => {
    const v = viewerRef.current;
    if (!v) return;
    v.currentScale = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, v.currentScale * factor));
  };

  const ajustarAncho = () => {
    if (viewerRef.current) viewerRef.current.currentScaleValue = "page-width";
  };

  const irAAnotacion = (a: Annotation) => {
    const v = viewerRef.current;
    const cont = containerRef.current;
    if (!v || !cont) return;
    setActivaId(a.id);
    v.scrollPageIntoView({ pageNumber: a.pagina });
    requestAnimationFrame(() => {
      const div = v.getPageView(a.pagina - 1)?.div as HTMLDivElement | undefined;
      if (!div) return;
      const delta =
        div.getBoundingClientRect().top -
        cont.getBoundingClientRect().top +
        annotationTop(a) * div.clientHeight -
        80;
      cont.scrollTop += delta;
    });
    if (window.matchMedia("(max-width: 639px)").matches) setPanel(null);
  };

  // ----- Búsqueda -----
  const buscar = (opts: { previa?: boolean; otra?: boolean } = {}) => {
    busRef.current?.dispatch("find", {
      source: null,
      type: opts.otra ? "again" : "",
      query: consulta,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious: !!opts.previa,
      matchDiacritics: false,
    });
  };

  const cerrarBusqueda = () => {
    setBusquedaAbierta(false);
    setConsulta("");
    setCoincidencias(null);
    setSinResultados(false);
    busRef.current?.dispatch("find", {
      source: null,
      type: "",
      query: "",
      caseSensitive: false,
      entireWord: false,
      highlightAll: false,
      findPrevious: false,
      matchDiacritics: false,
    });
  };

  // Atajos de teclado.
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const escribiendo =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setBusquedaAbierta(true);
        setTimeout(() => searchRef.current?.focus(), 0);
        return;
      }
      if (escribiendo) return;
      if (e.key === "Escape") setSeleccion(null);
      if (e.key === "ArrowRight") irAPagina((viewerRef.current?.currentPageNumber ?? 1) + 1);
      if (e.key === "ArrowLeft") irAPagina((viewerRef.current?.currentPageNumber ?? 1) - 1);
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, []);

  // Posición de la barra flotante de resaltado.
  const barra = seleccion
    ? {
        left: Math.min(Math.max(seleccion.left, 130), window.innerWidth - 130),
        top: seleccion.top > 120 ? seleccion.top - 52 : seleccion.bottom + 10,
      }
    : null;

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b bg-card px-2 py-1.5 sm:px-4">
        <div className="min-w-0 flex-1">{header}</div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => irAPagina(pagina - 1)}
            disabled={!listo || pagina <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              irAPagina(Number(paginaInput) || pagina);
            }}
            className="flex items-center gap-1 text-sm"
          >
            <Input
              value={paginaInput}
              onChange={(e) => setPaginaInput(e.target.value.replace(/\D/g, ""))}
              onBlur={() => setPaginaInput(String(pagina))}
              inputMode="numeric"
              className="h-8 w-12 px-1 text-center"
              aria-label="Página actual"
              disabled={!listo}
            />
            <span className="whitespace-nowrap text-muted-foreground">/ {total || "–"}</span>
          </form>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => irAPagina(pagina + 1)}
            disabled={!listo || pagina >= total}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => cambiarZoom(1 / 1.2)}
            disabled={!listo}
            aria-label="Alejar"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="hidden w-12 text-center text-sm tabular-nums text-muted-foreground sm:inline">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => cambiarZoom(1.2)}
            disabled={!listo}
            aria-label="Acercar"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={ajustarAncho}
            disabled={!listo}
            aria-label="Ajustar al ancho"
            title="Ajustar al ancho"
          >
            <MoveHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant={busquedaAbierta ? "secondary" : "ghost"}
            size="icon"
            onClick={() => {
              if (busquedaAbierta) cerrarBusqueda();
              else {
                setBusquedaAbierta(true);
                setTimeout(() => searchRef.current?.focus(), 0);
              }
            }}
            disabled={!listo}
            aria-label="Buscar en el documento"
            title="Buscar"
          >
            <Search className="h-4 w-4" />
          </Button>
          {indice.length > 0 && (
            <Button
              variant={panel === "indice" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setPanel(panel === "indice" ? null : "indice")}
              aria-label="Índice"
              title="Índice"
            >
              <ListTree className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant={panel === "notas" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setEditarId(null);
              setPanel(panel === "notas" ? null : "notas");
            }}
            aria-label="Mis notas"
            className="gap-1.5"
          >
            <StickyNote className="h-4 w-4" />
            <span className="hidden sm:inline">Mis notas</span>
            {annotations.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                {annotations.length}
              </span>
            )}
          </Button>
        </div>
      </header>

      {busquedaAbierta && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-card px-2 py-1.5 sm:px-4">
          <form
            className="flex min-w-[12rem] flex-1 items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              buscar({ otra: true });
            }}
          >
            <Input
              ref={searchRef}
              value={consulta}
              onChange={(e) => {
                setConsulta(e.target.value);
                setCoincidencias(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") cerrarBusqueda();
                if (e.key === "Enter" && e.shiftKey) {
                  e.preventDefault();
                  buscar({ otra: true, previa: true });
                }
              }}
              placeholder="Buscar en el documento"
              className="h-8 max-w-sm"
              aria-label="Texto a buscar"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => buscar({ otra: true, previa: true })}
              disabled={!consulta}
              aria-label="Anterior"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              disabled={!consulta}
              aria-label="Siguiente"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </form>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {sinResultados
              ? "Sin resultados"
              : coincidencias && coincidencias.total > 0
                ? `${coincidencias.current} de ${coincidencias.total}`
                : ""}
          </span>
          <Button variant="ghost" size="icon" onClick={cerrarBusqueda} aria-label="Cerrar búsqueda">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        {panel === "indice" && (
          <aside className="absolute inset-y-0 left-0 z-20 flex w-full flex-col border-r bg-card sm:static sm:w-72">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">Índice</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPanel(null)}
                aria-label="Cerrar índice"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 text-sm">
              {indice.map((it, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!it.dest}
                  onClick={() => {
                    if (it.dest) void linkRef.current?.goToDestination(it.dest as string);
                    if (window.matchMedia("(max-width: 639px)").matches) setPanel(null);
                  }}
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted disabled:opacity-60"
                  style={{ paddingLeft: `${0.5 + it.nivel * 0.9}rem` }}
                >
                  {it.titulo}
                </button>
              ))}
            </nav>
          </aside>
        )}

        <div className="relative min-w-0 flex-1 bg-muted">
          <div ref={containerRef} className="ceapsi-lector absolute inset-0 overflow-auto">
            <div ref={viewerDivRef} className="pdfViewer" />
          </div>
          {!listo && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted p-6 text-center text-muted-foreground">
              {error}
            </div>
          )}
        </div>

        {panel === "notas" && (
          <div className="absolute inset-0 z-20 sm:static">
            <AnnotationsPanel
              annotations={annotations}
              paginaActual={pagina}
              activaId={activaId}
              editarId={editarId}
              onGoTo={irAAnotacion}
              onUpdate={onUpdate}
              onDelete={async (id) => {
                const ok = await onDelete(id);
                if (ok && activaId === id) setActivaId(null);
                return ok;
              }}
              onCreatePageNote={async (nota) =>
                !!(await onCreate({ pagina, color: "amarillo", rects: [], texto: null, nota }))
              }
              onClose={() => {
                setPanel(null);
                setActivaId(null);
              }}
            />
          </div>
        )}
      </div>

      {seleccion && barra && (
        <div
          role="toolbar"
          aria-label="Resaltar selección"
          className="fixed z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-popover px-2 py-1.5 shadow-lg"
          style={{ left: barra.left, top: barra.top }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {COLOR_KEYS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => crearResaltado(c, false)}
              className="h-7 w-7 rounded-full border-2 border-background transition hover:scale-110"
              style={{ background: COLORES[c].solid }}
              aria-label={`Resaltar en ${COLORES[c].label.toLowerCase()}`}
              title={`Resaltar en ${COLORES[c].label.toLowerCase()}`}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          <Button
            size="sm"
            variant="ghost"
            className={cn("h-7 gap-1 rounded-full px-2")}
            onClick={() => crearResaltado("amarillo", true)}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Nota
          </Button>
        </div>
      )}
    </div>
  );
}
