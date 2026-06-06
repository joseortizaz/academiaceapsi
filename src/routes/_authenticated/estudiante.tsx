import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StudentShell } from "@/components/student/StudentShell";

export const Route = createFileRoute("/_authenticated/estudiante")({
  component: EstudianteLayout,
});

function EstudianteLayout() {
  return (
    <StudentShell>
      <Outlet />
    </StudentShell>
  );
}
