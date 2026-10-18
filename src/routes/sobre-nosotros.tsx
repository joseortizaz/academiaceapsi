import { pageHead } from "@/lib/site";
import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout, PageHeader } from "@/components/site/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Eye, Heart } from "lucide-react";
import { useProgramCounts } from "@/hooks/use-program-counts";

export const Route = createFileRoute("/sobre-nosotros")({
  staticData: { sitemap: true },
  head: () => pageHead("/sobre-nosotros", "Sobre nosotros | Academia Ceapsi RD", "Conoce la misión, visión, valores e historia de Academia Ceapsi RD, formación continua en psicología en República Dominicana."),
  component: SobreNosotros,
});

function SobreNosotros() {
  const { data: counts } = useProgramCounts();
  const loading = <span className="inline-block h-8 w-12 animate-pulse rounded bg-muted align-middle" aria-label="Cargando" />;
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
              <h2 className="mt-5 text-xl font-bold text-foreground">{b.t}</h2>
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
              Academia Ceapsi RD abrió sus puertas en Santo Domingo el 1 de enero de 2015, ofreciendo
              cursos y diplomados presenciales con el propósito de cerrar la brecha de formación continua
              en psicología y educación en la República Dominicana. En 2020 incorporamos la formación
              virtual en vivo, y en 2021 iniciamos nuestra oferta de cursos asincrónicos, para que puedas
              aprender a tu ritmo desde cualquier lugar. Desde nuestros inicios hemos formado a más de
              2,500 profesionales en todo el país.
            </p>
            <ol className="mt-6 space-y-4 border-l-2 border-accent/40 pl-5">
              {[
                { y: "2015", t: "Abrimos nuestras puertas con cursos y diplomados presenciales." },
                { y: "2020", t: "Incorporamos la formación virtual en vivo." },
                { y: "2021", t: "Iniciamos la oferta de cursos asincrónicos." },
              ].map((h) => (
                <li key={h.y} className="relative">
                  <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-accent" />
                  <p className="text-sm font-bold text-primary">{h.y}</p>
                  <p className="text-sm text-muted-foreground">{h.t}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-muted-foreground">
              Hoy, contamos con docentes acreditados, alianzas con instituciones del sector
              salud y educación, y una plataforma 100% en español pensada para el profesional dominicano.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { n: "+2,500", l: "Egresados activos", full: true },
              { n: counts ? String(counts.diplomados) : null, l: "Diplomados" },
              { n: counts ? String(counts.cursos) : null, l: "Cursos" },
              { n: "32", l: "Provincias alcanzadas" },
              { n: "98%", l: "Satisfacción" },
            ].map((s) => (
              <Card key={s.l} className={`border-border${s.full ? " col-span-2" : ""}`}>
                <CardContent className="p-6 text-center">
                  <p className="text-3xl font-bold text-primary">{s.n ?? loading}</p>
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
