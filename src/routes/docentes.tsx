import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout, PageHeader } from "@/components/site/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/docentes")({
  component: Docentes,
});

const docentes = [
  { nombre: "Dra. Carolina Rosario", area: "Psicología Clínica", bio: "Doctora en Psicología por la UASD. 15 años de experiencia clínica en Santo Domingo." },
  { nombre: "Dr. José Manuel Báez", area: "Neuropsicología", bio: "Especialista en evaluación neuropsicológica infantil. Docente universitario en Santiago." },
  { nombre: "Mtra. Patricia Núñez", area: "Psicología Educativa", bio: "Magíster en Educación. Asesora del Ministerio de Educación de RD." },
  { nombre: "Dr. Rafael Espinal", area: "Terapia Cognitivo-Conductual", bio: "Formador internacional, 20 años en práctica clínica y docencia." },
  { nombre: "Mtra. Luz Vásquez", area: "Psicología Infantil", bio: "Especialista en desarrollo infantil temprano y trastornos del neurodesarrollo." },
  { nombre: "Dr. Antonio Mejía", area: "Psicología Organizacional", bio: "Consultor en gestión del talento humano para empresas dominicanas." },
];

function Docentes() {
  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Cuerpo docente"
        title="Conoce a nuestros docentes"
        subtitle="Profesionales dominicanos con trayectoria, vocación y experiencia comprobada."
      />
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {docentes.map((d) => (
            <Card key={d.nombre} className="border-border transition hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-accent">
                    <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                      {d.nombre.split(" ").slice(-2).map((p) => p[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-foreground">{d.nombre}</h3>
                    <Badge variant="secondary" className="mt-1">{d.area}</Badge>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{d.bio}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
