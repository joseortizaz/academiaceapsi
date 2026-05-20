import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Award, Video, Users, Clock, CheckCircle2, Star, ArrowRight } from "lucide-react";
import heroImg from "@/assets/hero-ceapsi.jpg";

export const Route = createFileRoute("/")({
  component: Home,
});

const cursos = [
  { titulo: "Diplomado en Psicología Clínica", tipo: "En vivo por Zoom", duracion: "6 meses", precio: "RD$ 28,500", nivel: "Avanzado" },
  { titulo: "Curso de Terapia Cognitivo-Conductual", tipo: "Asincrónico", duracion: "8 semanas", precio: "RD$ 9,800", nivel: "Intermedio" },
  { titulo: "Diplomado en Neuropsicología Infantil", tipo: "En vivo por Zoom", duracion: "5 meses", precio: "RD$ 24,000", nivel: "Avanzado" },
];

const testimonios = [
  { nombre: "María Fernández", ciudad: "Santo Domingo", texto: "El diplomado superó mis expectativas. Los docentes son profesionales reconocidos en el país.", rating: 5 },
  { nombre: "Luis Peña", ciudad: "Santiago", texto: "Pude estudiar a mi ritmo desde el Cibao. La plataforma es excelente y muy clara.", rating: 5 },
  { nombre: "Rosa Jiménez", ciudad: "La Romana", texto: "Recibí mi certificado al instante. Hoy aplico todo lo aprendido en mi consulta.", rating: 5 },
];

function Home() {
  return (
    <PublicLayout>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground">
        <div className="container mx-auto grid items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <Badge className="bg-accent text-accent-foreground hover:bg-accent">
              Educación profesional en RD
            </Badge>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Forma tu vocación con la <span className="text-accent">Academia Ceapsi RD</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-primary-foreground/85">
              Diplomados y cursos en psicología y educación, dictados por docentes
              dominicanos certificados. Modalidades en vivo por Zoom o 100% en línea a tu ritmo.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/registro">Comienza ahora <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/sobre-nosotros">Conoce la academia</Link>
              </Button>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-primary-foreground/15 pt-6">
              <div><p className="text-2xl font-bold text-accent">+2,500</p><p className="text-xs text-primary-foreground/70">Egresados</p></div>
              <div><p className="text-2xl font-bold text-accent">25+</p><p className="text-xs text-primary-foreground/70">Diplomados</p></div>
              <div><p className="text-2xl font-bold text-accent">98%</p><p className="text-xs text-primary-foreground/70">Satisfacción</p></div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-accent/20 blur-2xl" />
            <img
              src={heroImg}
              alt="Estudiantes dominicanos de la Academia Ceapsi RD"
              width={1600}
              height={1024}
              className="relative rounded-2xl shadow-2xl ring-1 ring-primary-foreground/20"
            />
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section className="bg-background py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              ¿Por qué Ceapsi RD?
            </p>
            <h2 className="mt-3 text-3xl font-bold text-foreground md:text-4xl">
              Una academia hecha para profesionales dominicanos
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icon: Video, t: "Clases en vivo por Zoom", d: "Interactúa en tiempo real con docentes referentes del país." },
              { icon: Clock, t: "Cursos a tu ritmo", d: "Contenido asincrónico disponible 24/7 desde cualquier dispositivo." },
              { icon: Award, t: "Certificación oficial", d: "Recibe tu certificado digital descargable al completar el 100%." },
              { icon: Users, t: "Docentes certificados", d: "Aprende con psicólogos y educadores reconocidos en RD." },
              { icon: CheckCircle2, t: "Avance gradual", d: "Sistema de aprendizaje progresivo que asegura tu dominio del tema." },
              { icon: GraduationCap, t: "Diplomados acreditados", d: "Programas formales con módulos, evaluaciones y tutorías." },
            ].map((b) => (
              <Card key={b.t} className="border-border transition hover:shadow-lg">
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <b.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{b.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{b.d}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CURSOS DESTACADOS */}
      <section className="bg-muted/40 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">Catálogo</p>
              <h2 className="mt-2 text-3xl font-bold text-foreground md:text-4xl">Cursos destacados</h2>
            </div>
            <Button asChild variant="outline">
              <Link to="/registro">Ver catálogo completo</Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {cursos.map((c) => (
              <Card key={c.titulo} className="overflow-hidden border-border">
                <div className="aspect-video bg-gradient-to-br from-primary to-primary/70" />
                <CardContent className="p-6">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{c.tipo}</Badge>
                    <Badge variant="outline">{c.nivel}</Badge>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-foreground">{c.titulo}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Duración: {c.duracion}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xl font-bold text-primary">{c.precio}</p>
                    <Button asChild size="sm"><Link to="/registro">Inscribirme</Link></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section className="bg-background py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Testimonios</p>
            <h2 className="mt-3 text-3xl font-bold text-foreground md:text-4xl">
              Voces de nuestros egresados
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonios.map((t) => (
              <Card key={t.nombre} className="border-border">
                <CardContent className="p-6">
                  <div className="flex gap-1 text-accent">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-foreground/80">"{t.texto}"</p>
                  <div className="mt-5 border-t border-border pt-4">
                    <p className="text-sm font-semibold text-foreground">{t.nombre}</p>
                    <p className="text-xs text-muted-foreground">{t.ciudad}, RD</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-16 text-primary-foreground">
        <div className="container mx-auto flex flex-col items-center gap-6 px-4 text-center">
          <h2 className="max-w-2xl text-3xl font-bold md:text-4xl">
            Da el siguiente paso en tu carrera profesional
          </h2>
          <p className="max-w-xl text-primary-foreground/85">
            Únete a la comunidad educativa de Ceapsi RD y obtén las herramientas que necesitas.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/registro">Crear cuenta gratis</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/acceder">Ya tengo cuenta</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
