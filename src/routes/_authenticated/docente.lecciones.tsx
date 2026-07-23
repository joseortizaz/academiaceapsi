import { createFileRoute } from "@tanstack/react-router";
import { LessonsManager } from "@/components/admin/LessonsManager";

export const Route = createFileRoute("/_authenticated/docente/lecciones")({
  component: () => <LessonsManager scope="docente" />,
});
