import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/docente")({
  component: DocenteDashboard,
});

function DocenteDashboard() {
  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="text-2xl font-bold">Panel del Docente</h1>
      <p className="mt-2 text-muted-foreground">Gestiona tus módulos y estudiantes.</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Módulos asignados", value: "0" },
          { label: "Estudiantes", value: "0" },
          { label: "Evaluaciones pendientes", value: "0" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
