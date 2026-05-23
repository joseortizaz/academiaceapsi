import { createFileRoute } from "@tanstack/react-router";
import { AssessmentsManager } from "@/components/admin/AssessmentsManager";

export const Route = createFileRoute("/_authenticated/docente/evaluaciones")({
  component: () => <AssessmentsManager scope="docente" />,
});
