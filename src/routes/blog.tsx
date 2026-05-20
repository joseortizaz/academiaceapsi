import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout, PageHeader } from "@/components/site/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/blog")({
  component: Blog,
});

const articulos = [
  { slug: "salud-mental-rd", titulo: "El estado de la salud mental en República Dominicana", cat: "Psicología", fecha: "12 May 2026", resumen: "Datos recientes sobre el acceso a servicios psicológicos en el país y los retos pendientes." },
  { slug: "tcc-practica-clinica", titulo: "Aplicaciones de la TCC en la práctica clínica dominicana", cat: "Clínica", fecha: "28 Abr 2026", resumen: "Cómo adaptar la Terapia Cognitivo-Conductual a contextos culturales locales." },
  { slug: "neuroeducacion", titulo: "Neuroeducación: aprender mejor, enseñar mejor", cat: "Educación", fecha: "10 Abr 2026", resumen: "Estrategias basadas en evidencia para docentes de aulas dominicanas." },
  { slug: "bienestar-docente", titulo: "Bienestar docente: prevenir el agotamiento", cat: "Educación", fecha: "30 Mar 2026", resumen: "Herramientas para cuidar la salud emocional del cuerpo docente del país." },
];

function Blog() {
  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Blog"
        title="Aprende algo nuevo cada semana"
        subtitle="Artículos de interés psicológico y educativo escritos por nuestros docentes."
      />
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid gap-6 md:grid-cols-2">
          {articulos.map((a) => (
            <Card key={a.slug} className="border-border transition hover:shadow-lg">
              <div className="aspect-[16/8] rounded-t-xl bg-gradient-to-br from-primary to-accent" />
              <CardContent className="p-6">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="secondary">{a.cat}</Badge>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {a.fecha}</span>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-foreground">{a.titulo}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{a.resumen}</p>
                <Link to="/blog" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-accent">
                  Leer artículo <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
