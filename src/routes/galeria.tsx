import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout, PageHeader } from "@/components/site/PublicLayout";

export const Route = createFileRoute("/galeria")({
  component: Galeria,
});

const fotos = [
  { titulo: "Graduación 2024", lugar: "Santo Domingo" },
  { titulo: "Taller de TCC", lugar: "Santiago" },
  { titulo: "Conferencia internacional", lugar: "Punta Cana" },
  { titulo: "Diplomado infantil", lugar: "La Vega" },
  { titulo: "Encuentro de docentes", lugar: "Santo Domingo" },
  { titulo: "Taller comunitario", lugar: "San Pedro de Macorís" },
  { titulo: "Apertura académica", lugar: "Santo Domingo" },
  { titulo: "Sesión clínica", lugar: "La Romana" },
];

const gradients = [
  "from-primary to-primary/60",
  "from-accent to-accent/60",
  "from-primary via-accent to-primary",
  "from-secondary to-primary/40",
  "from-primary to-accent/60",
  "from-accent/70 to-primary",
  "from-primary/80 to-secondary",
  "from-accent to-primary",
];

function Galeria() {
  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Galería"
        title="Momentos que nos definen"
        subtitle="Eventos, graduaciones y talleres presenciales en toda la República Dominicana."
      />
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {fotos.map((f, i) => (
            <div
              key={f.titulo}
              className={`group relative aspect-square overflow-hidden rounded-xl bg-gradient-to-br ${gradients[i]}`}
            >
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 transition group-hover:opacity-100">
                <p className="text-sm font-semibold text-white">{f.titulo}</p>
                <p className="text-xs text-white/80">{f.lugar}, RD</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
