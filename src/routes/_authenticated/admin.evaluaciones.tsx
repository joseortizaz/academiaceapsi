import { createFileRoute } from "@tanstack/react-router";
import { AssessmentsManager } from "@/components/admin/AssessmentsManager";

export const Route = createFileRoute("/_authenticated/admin/evaluaciones")({
  staticData: { sitemap: false },
  component: () => <AssessmentsManager scope="admin" />,
});
