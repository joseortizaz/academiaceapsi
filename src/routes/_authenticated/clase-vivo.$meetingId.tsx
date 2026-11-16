import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ZoomEmbed } from "@/components/ZoomEmbed";

export const Route = createFileRoute("/_authenticated/clase-vivo/$meetingId")({
  staticData: { sitemap: false },
  component: ClaseEnVivo,
});

function ClaseEnVivo() {
  const { meetingId } = Route.useParams();
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-2 px-3 py-2">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Clase en vivo</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/mis-cursos">
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver
          </Link>
        </Button>
      </div>
      <ZoomEmbed meetingRowId={meetingId} />
    </div>
  );
}
