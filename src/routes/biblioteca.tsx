import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/biblioteca")({
  staticData: { sitemap: false },
  component: BibliotecaLayout,
});

function BibliotecaLayout() {
  return <Outlet />;
}
