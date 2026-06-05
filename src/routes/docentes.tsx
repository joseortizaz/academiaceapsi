import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PublicLayout, PageHeader } from "@/components/site/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Linkedin, Mail, Phone, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/docentes")({
  component: Docentes,
});

type Teacher = {
  id: string;
  nombre: string;
  apellido: string;
  email: string | null;
  telefono: string | null;
  titulo: string | null;
  especialidad: string | null;
  biografia: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
};




const fullName = (t: Teacher) =>
  [t.titulo, t.nombre, t.apellido].filter(Boolean).join(" ").trim();

const initials = (t: Teacher) =>
  `${t.nombre?.[0] ?? ""}${t.apellido?.[0] ?? ""}`.toUpperCase();

function Docentes() {
  const [selected, setSelected] = useState<Teacher | null>(null);

  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ["public", "teachers"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("teachers_public")
        .select("id, nombre, apellido, titulo, especialidad, biografia, avatar_url, linkedin_url")
        .order("orden", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((t: any) => ({ ...t, email: null, telefono: null })) as Teacher[];
    },
  });


  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Cuerpo docente"
        title="Conoce a nuestros docentes"
        subtitle="Profesionales dominicanos con trayectoria, vocación y experiencia comprobada."
      />
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((d) => (
            <Card
              key={d.id}
              className="cursor-pointer border-border transition hover:shadow-lg"
              onClick={() => setSelected(d)}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-accent">
                    {d.avatar_url && <AvatarImage src={d.avatar_url} alt={fullName(d)} />}
                    <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                      {initials(d)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelected(d); }}
                      className="text-left font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      {fullName(d)}
                    </button>
                    {d.especialidad && (
                      <Badge variant="secondary" className="mt-1">{d.especialidad}</Badge>
                    )}
                  </div>
                </div>
                {d.biografia && (
                  <p className="mt-4 line-clamp-3 text-sm text-muted-foreground">{d.biografia}</p>
                )}
                <Button
                  variant="link"
                  className="mt-2 h-auto p-0 text-primary"
                  onClick={(e) => { e.stopPropagation(); setSelected(d); }}
                >
                  Ver perfil completo →
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <Avatar className="h-24 w-24 border-2 border-accent">
                    {selected.avatar_url && <AvatarImage src={selected.avatar_url} alt={fullName(selected)} />}
                    <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
                      {initials(selected)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-center sm:text-left">
                    <DialogTitle className="text-2xl">{fullName(selected)}</DialogTitle>
                    {selected.especialidad && (
                      <DialogDescription className="mt-1">
                        <Badge variant="secondary">{selected.especialidad}</Badge>
                      </DialogDescription>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                {selected.biografia && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <GraduationCap className="h-4 w-4 text-primary" /> Perfil profesional
                    </h4>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {selected.biografia}
                    </p>
                  </div>
                )}

                {(selected.email || selected.telefono || selected.linkedin_url) && (
                  <div className="border-t pt-4">
                    <h4 className="mb-3 text-sm font-semibold text-foreground">Contacto</h4>
                    <div className="flex flex-wrap gap-2">
                      {selected.email && (
                        <Button asChild variant="outline" size="sm">
                          <a href={`mailto:${selected.email}`}>
                            <Mail className="mr-2 h-4 w-4" /> {selected.email}
                          </a>
                        </Button>
                      )}
                      {selected.telefono && (
                        <Button asChild variant="outline" size="sm">
                          <a href={`tel:${selected.telefono}`}>
                            <Phone className="mr-2 h-4 w-4" /> {selected.telefono}
                          </a>
                        </Button>
                      )}
                      {selected.linkedin_url && (
                        <Button asChild variant="outline" size="sm">
                          <a href={selected.linkedin_url} target="_blank" rel="noopener noreferrer">
                            <Linkedin className="mr-2 h-4 w-4" /> LinkedIn
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
}
