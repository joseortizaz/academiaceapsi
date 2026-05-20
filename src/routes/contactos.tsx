import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout, PageHeader } from "@/components/site/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MapPin, Phone, Mail, Clock, Facebook, Instagram, Youtube } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contactos")({
  component: Contactos,
});

function Contactos() {
  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Contacto"
        title="Hablemos"
        subtitle="Estamos en Santo Domingo, pero atendemos a toda la República Dominicana."
      />
      <section className="container mx-auto grid gap-10 px-4 py-16 md:grid-cols-3 md:py-24">
        <div className="space-y-4 md:col-span-1">
          {[
            { icon: MapPin, t: "Ubicación", d: "Presidente Hipólito Irigoyen No. 5, Zona Universitaria, Distrito Nacional, Rep. Dom." },
            { icon: Phone, t: "Oficina", d: "809-784-5106" },
            { icon: Phone, t: "WhatsApp", d: "809-869-5705" },
            { icon: Mail, t: "Correo", d: "admin@ceapsird.com" },
            { icon: Clock, t: "Horario", d: "Lun–Vie 8:00 a.m. – 6:00 p.m." },
          ].map((c) => (
            <Card key={c.t} className="border-border">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <c.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.t}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{c.d}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="flex gap-2 pt-2">
            <a href="#" className="rounded-full bg-primary p-2 text-primary-foreground hover:bg-accent hover:text-accent-foreground"><Facebook className="h-4 w-4" /></a>
            <a href="#" className="rounded-full bg-primary p-2 text-primary-foreground hover:bg-accent hover:text-accent-foreground"><Instagram className="h-4 w-4" /></a>
            <a href="#" className="rounded-full bg-primary p-2 text-primary-foreground hover:bg-accent hover:text-accent-foreground"><Youtube className="h-4 w-4" /></a>
          </div>
        </div>

        <Card className="border-border md:col-span-2">
          <CardContent className="p-6 md:p-8">
            <h2 className="text-xl font-bold text-foreground">Envíanos un mensaje</h2>
            <p className="mt-1 text-sm text-muted-foreground">Te respondemos en menos de 24 horas hábiles.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                toast.success("Mensaje enviado", { description: "Pronto te contactaremos." });
                (e.target as HTMLFormElement).reset();
              }}
              className="mt-6 grid gap-4 sm:grid-cols-2"
            >
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" required placeholder="Tu nombre" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="correo">Correo electrónico</Label>
                <Input id="correo" type="email" required placeholder="correo@ejemplo.com" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="asunto">Asunto</Label>
                <Input id="asunto" required placeholder="¿En qué podemos ayudarte?" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="mensaje">Mensaje</Label>
                <Textarea id="mensaje" required placeholder="Cuéntanos más..." rows={5} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" size="lg" className="w-full sm:w-auto">Enviar mensaje</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </PublicLayout>
  );
}
