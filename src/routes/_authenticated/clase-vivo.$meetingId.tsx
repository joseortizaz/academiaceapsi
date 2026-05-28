import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ZoomEmbed } from "@/components/ZoomEmbed";

export const Route = createFileRoute("/_authenticated/clase-vivo/$meetingId")({
  component: ClaseEnVivo,
});

function ClaseEnVivo() {
  const { meetingId } = Route.useParams();
  return (
    <div className="container mx-auto space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clase en vivo</h1>
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
