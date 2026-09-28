import { createFileRoute } from "@tanstack/react-router";
import { LessonsManager } from "@/components/admin/LessonsManager";

export const Route = createFileRoute("/_authenticated/admin/modulos")({
  staticData: { sitemap: false },
  component: () => <LessonsManager scope="admin" />,
});
