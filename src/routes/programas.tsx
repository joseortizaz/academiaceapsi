import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/programas")({
  staticData: { sitemap: false },
  component: ProgramasLayout,
});

function ProgramasLayout() {
  return <Outlet />;
}