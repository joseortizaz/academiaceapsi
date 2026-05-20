import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="text-2xl font-bold">Panel del Administrador</h1>
      <p className="mt-2 text-muted-foreground">Bienvenido al panel de control.</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Usuarios registrados", value: "0" },
          { label: "Diplomados activos", value: "0" },
          { label: "Inscripciones", value: "0" },
          { label: "Ingresos (DOP)", value: "$0" },
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
