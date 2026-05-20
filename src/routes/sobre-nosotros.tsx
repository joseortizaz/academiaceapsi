import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout, PageHeader } from "@/components/site/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Eye, Heart } from "lucide-react";

export const Route = createFileRoute("/sobre-nosotros")({
  component: SobreNosotros,
});

function SobreNosotros() {
  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Quiénes somos"
        title="Sobre Academia Ceapsi RD"
        subtitle="Más de una década formando profesionales del comportamiento humano en la República Dominicana."
      />
      <section className="container mx-auto grid gap-10 px-4 py-16 md:grid-cols-3 md:py-24">
        {[
          { icon: Target, t: "Misión", d: "Impulsar la formación de profesionales dominicanos en psicología, educación y ciencias del comportamiento, a través de programas accesibles, modernos y de excelencia académica." },
          { icon: Eye, t: "Visión", d: "Ser la academia de referencia en la República Dominicana y el Caribe en educación continua en psicología, integrando tecnología, ciencia y vocación de servicio." },
          { icon: Heart, t: "Valores", d: "Ética, excelencia, compromiso social, innovación pedagógica, respeto a la diversidad y vocación de servicio hacia nuestra comunidad dominicana." },
        ].map((b) => (
          <Card key={b.t} className="border-border">
            <CardContent className="p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <b.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-foreground">{b.t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{b.d}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="bg-muted/40 py-16">
        <div className="container mx-auto grid gap-10 px-4 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Nuestra historia</h2>
            <p className="mt-4 text-muted-foreground">
              Academia Ceapsi RD nace en Santo Domingo con el propósito de cerrar la brecha
              de formación continua en el ámbito de la psicología en la República Dominicana.
              Desde nuestros inicios hemos formado a más de 2,500 profesionales en todo el país,
              desde Puerto Plata hasta La Romana, ofreciendo programas en modalidades híbridas.
            </p>
            <p className="mt-4 text-muted-foreground">
              Hoy, contamos con docentes acreditados, alianzas con instituciones del sector
              salud y educación, y una plataforma 100% en español pensada para el profesional dominicano.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { n: "+2,500", l: "Egresados activos" },
              { n: "+25", l: "Programas dictados" },
              { n: "32", l: "Provincias alcanzadas" },
              { n: "98%", l: "Satisfacción" },
            ].map((s) => (
              <Card key={s.l} className="border-border">
                <CardContent className="p-6 text-center">
                  <p className="text-3xl font-bold text-primary">{s.n}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.l}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
