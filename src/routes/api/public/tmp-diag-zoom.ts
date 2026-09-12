// TEMPORAL — diagnóstico Zoom (eliminar después de usar)
import { createFileRoute } from "@tanstack/react-router";
import { getZakToken } from "@/lib/zoom.server";

export const Route = createFileRoute("/api/public/tmp-diag-zoom")({
  server: {
    handlers: {
      GET: async () => {
        const zak = await getZakToken("seminario.orpe@gmail.com");
        return Response.json({ zak });
      },
    },
  },
});
