import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout, PageHeader } from "@/components/site/PublicLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar, Image as ImageIcon, Video as VideoIcon, X, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/eventos")({
  head: () => ({
    meta: [
      { title: "Eventos — Academia Ceapsi RD" },
      { name: "description", content: "Galería de eventos, graduaciones, conferencias y actividades de Academia Ceapsi RD." },
      { property: "og:title", content: "Eventos — Academia Ceapsi RD" },
      { property: "og:description", content: "Galería de eventos, graduaciones y conferencias de Academia Ceapsi RD." },
    ],
  }),
  component: EventosPage,
});

type EventRow = {
  id: string;
  titulo: string;
  slug: string;
  fecha: string | null;
  descripcion: string | null;
  cover_url: string | null;
};

type MediaRow = {
  id: string;
  event_id: string;
  tipo: "image" | "video";
  url: string;
  titulo: string | null;
};

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/embed/")) {
      return url;
    }
    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}

function formatDate(d: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("es-DO", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return d;
  }
}

function EventosPage() {
  const [openEvent, setOpenEvent] = useState<EventRow | null>(null);

  const { data: events, isLoading } = useQuery({
    queryKey: ["public", "events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, titulo, slug, fecha, descripcion, cover_url")
        .eq("publicado", true)
        .order("orden", { ascending: true })
        .order("fecha", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Comunidad Ceapsi"
        title="Eventos"
        subtitle="Graduaciones, conferencias, talleres y momentos memorables de nuestra academia."
      />
      <section className="container mx-auto px-4 py-16 md:py-20">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-xl" />
            ))}
          </div>
        ) : !events || events.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-12 text-center text-muted-foreground">
            Aún no hay eventos publicados. Vuelve pronto.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <button
                key={e.id}
                onClick={() => setOpenEvent(e)}
                className="group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-primary to-accent/70">
                  {e.cover_url ? (
                    <img
                      src={e.cover_url}
                      alt={e.titulo}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-primary-foreground/80">
                      <ImageIcon className="h-12 w-12" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  {e.fecha && (
                    <Badge variant="outline" className="mb-2">
                      <Calendar className="mr-1 h-3 w-3" />
                      {formatDate(e.fecha)}
                    </Badge>
                  )}
                  <h3 className="text-lg font-bold text-foreground">{e.titulo}</h3>
                  {e.descripcion && (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{e.descripcion}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {openEvent && <EventDetail event={openEvent} onClose={() => setOpenEvent(null)} />}
    </PublicLayout>
  );
}

function EventDetail({ event, onClose }: { event: EventRow; onClose: () => void }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: media, isLoading } = useQuery({
    queryKey: ["public", "event_media", event.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_media")
        .select("id, event_id, tipo, url, titulo")
        .eq("event_id", event.id)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MediaRow[];
    },
  });

  const images = useMemo(() => (media ?? []).filter((m) => m.tipo === "image"), [media]);
  const videos = useMemo(() => (media ?? []).filter((m) => m.tipo === "video"), [media]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-auto my-8 max-w-5xl rounded-2xl bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b p-6">
          <div className="min-w-0">
            {event.fecha && (
              <Badge variant="outline" className="mb-2">
                <Calendar className="mr-1 h-3 w-3" />
                {formatDate(event.fecha)}
              </Badge>
            )}
            <h2 className="truncate text-2xl font-bold">{event.titulo}</h2>
            {event.descripcion && (
              <p className="mt-2 text-sm text-muted-foreground">{event.descripcion}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-2 hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-8 p-6">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {images.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <ImageIcon className="h-4 w-4" /> Galería de imágenes
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {images.map((img, idx) => (
                      <button
                        key={img.id}
                        onClick={() => setLightboxIndex(idx)}
                        className="group aspect-square overflow-hidden rounded-lg bg-muted"
                      >
                        <img
                          src={img.url}
                          alt={img.titulo ?? event.titulo}
                          loading="lazy"
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {videos.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <VideoIcon className="h-4 w-4" /> Videos
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {videos.map((v) => {
                      const embed = getEmbedUrl(v.url);
                      return (
                        <div key={v.id} className="space-y-2">
                          <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                            {embed ? (
                              <iframe
                                src={embed}
                                title={v.titulo ?? event.titulo}
                                loading="lazy"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="h-full w-full"
                              />
                            ) : (
                              <a
                                href={v.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-full w-full items-center justify-center text-sm text-primary-foreground/80 underline"
                              >
                                Abrir video
                              </a>
                            )}
                          </div>
                          {v.titulo && (
                            <p className="text-sm text-muted-foreground">{v.titulo}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {images.length === 0 && videos.length === 0 && (
                <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center text-muted-foreground">
                  Este evento aún no tiene multimedia.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {lightboxIndex !== null && images[lightboxIndex] && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNav={(d) => {
            const next = (lightboxIndex + d + images.length) % images.length;
            setLightboxIndex(next);
          }}
        />
      )}
    </div>
  );
}

function Lightbox({
  images, index, onClose, onNav,
}: {
  images: MediaRow[];
  index: number;
  onClose: () => void;
  onNav: (delta: number) => void;
}) {
  const img = images[index];
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-6 w-6" />
      </button>
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onNav(-1); }}
            aria-label="Anterior"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNav(1); }}
            aria-label="Siguiente"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <img
        src={img.url}
        alt={img.titulo ?? ""}
        className="max-h-[90vh] max-w-[95vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
