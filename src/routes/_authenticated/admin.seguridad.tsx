import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { TarjetaDosPasos } from "@/components/security/TarjetaDosPasos";

export const Route = createFileRoute("/_authenticated/admin/seguridad")({
  staticData: { sitemap: false },
  component: SeguridadAdmin,
});

function SeguridadAdmin() {
  return (
    <div className="max-w-2xl space-y-6">
      <AdminPageHeader
        title="Seguridad"
        description="Tu verificación en dos pasos y los dispositivos que la usan."
      />
      <TarjetaDosPasos obligatoria />
      <p className="text-sm text-muted-foreground">
        Para quitar la verificación en dos pasos de un docente o alumno que perdió su teléfono, ve a
        Usuarios y usa el botón del escudo en su fila.
      </p>
    </div>
  );
}
