import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PublicLayout, PageHeader } from "@/components/site/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TeacherProfileDialog, fullName, initials, type Teacher,
} from "@/components/site/TeacherProfileDialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/docentes")({
  component: Docentes,
});

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

      <TeacherProfileDialog teacher={selected} onClose={() => setSelected(null)} />
    </PublicLayout>
  );
}
