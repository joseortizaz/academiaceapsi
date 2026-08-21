import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRecordingPlaybackUrl } from "@/lib/recordings.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink } from "lucide-react";

/**
 * Reproductor embebido de la grabación de una clase en vivo.
 * El video se sirve por proxy desde /api/public/recording/<id> con un enlace firmado.
 */
export function RecordingPlayer({
  meetingRowId,
  fallbackUrl,
  className,
}: {
  meetingRowId: string;
  fallbackUrl?: string | null;
  className?: string;
}) {
  const fetchUrl = useServerFn(getRecordingPlaybackUrl);

  const { data, isLoading, error } = useQuery({
    queryKey: ["recording-playback", meetingRowId],
    queryFn: () => fetchUrl({ data: { meetingRowId } }),
    staleTime: 1000 * 60 * 60 * 3,
    retry: false,
  });

  if (isLoading) {
    return <Skeleton className={className ?? "aspect-video w-full rounded-lg"} />;
  }

  if (error || !data?.url) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-6 text-center">
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          No se pudo cargar la grabación en la plataforma.
        </p>
        {fallbackUrl && (
          <Button asChild size="sm" variant="outline">
            <a href={fallbackUrl} target="_blank" rel="noreferrer">
              Ver en Zoom <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <video
      key={data.url}
      src={data.url}
      controls
      controlsList="nodownload"
      playsInline
      preload="metadata"
      className={className ?? "aspect-video w-full rounded-lg bg-black"}
    />
  );
}
