import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/programas")({
  component: ProgramasLayout,
});

function ProgramasLayout() {
  return <Outlet />;
}