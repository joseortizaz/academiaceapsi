import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Linkedin, Mail, Phone, GraduationCap, BookOpen } from "lucide-react";

export type Teacher = {
  id: string;
  nombre: string;
  apellido: string;
  email?: string | null;
  telefono?: string | null;
  titulo: string | null;
  especialidad: string | null;
  biografia: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
};

export const fullName = (t: Teacher) =>
  [t.titulo, t.nombre, t.apellido].filter(Boolean).join(" ").trim();

export const initials = (t: Teacher) =>
  `${t.nombre?.[0] ?? ""}${t.apellido?.[0] ?? ""}`.toUpperCase();

type Leccion = { titulo: string; modulo?: string | null };

export function TeacherProfileDialog({
  teacher,
  onClose,
  lecciones,
  mostrarVerTodos,
}: {
  teacher: Teacher | null;
  onClose: () => void;
  lecciones?: Leccion[];
  mostrarVerTodos?: boolean;
}) {
  const grupos: { modulo: string | null; items: string[] }[] = [];
  if (lecciones && lecciones.length > 0) {
    for (const l of lecciones) {
      const key = l.modulo ?? null;
      let g = grupos.find((x) => x.modulo === key);
      if (!g) {
        g = { modulo: key, items: [] };
        grupos.push(g);
      }
      g.items.push(l.titulo);
    }
  }

  return (
    <Dialog open={!!teacher} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {teacher && (
          <>
            <DialogHeader>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <Avatar className="h-24 w-24 border-2 border-accent">
                  {teacher.avatar_url && <AvatarImage src={teacher.avatar_url} alt={fullName(teacher)} />}
                  <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
                    {initials(teacher)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-center sm:text-left">
                  <DialogTitle className="text-2xl">{fullName(teacher)}</DialogTitle>
                  {teacher.especialidad && (
                    <DialogDescription className="mt-1">
                      <Badge variant="secondary">{teacher.especialidad}</Badge>
                    </DialogDescription>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <GraduationCap className="h-4 w-4 text-primary" /> Perfil profesional
                </h4>
                {teacher.biografia ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {teacher.biografia}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    El perfil de este docente estará disponible próximamente.
                  </p>
                )}
              </div>

              {grupos.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <BookOpen className="h-4 w-4 text-primary" /> Imparte en este programa
                  </h4>
                  <div className="space-y-3">
                    {grupos.map((g, i) => (
                      <div key={i}>
                        {g.modulo && (
                          <p className="text-sm font-medium text-foreground">{g.modulo}</p>
                        )}
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                          {g.items.map((t, j) => <li key={j}>{t}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(teacher.email || teacher.telefono || teacher.linkedin_url) && (
                <div className="border-t pt-4">
                  <h4 className="mb-3 text-sm font-semibold text-foreground">Contacto</h4>
                  <div className="flex flex-wrap gap-2">
                    {teacher.email && (
                      <Button asChild variant="outline" size="sm">
                        <a href={`mailto:${teacher.email}`}>
                          <Mail className="mr-2 h-4 w-4" /> {teacher.email}
                        </a>
                      </Button>
                    )}
                    {teacher.telefono && (
                      <Button asChild variant="outline" size="sm">
                        <a href={`tel:${teacher.telefono}`}>
                          <Phone className="mr-2 h-4 w-4" /> {teacher.telefono}
                        </a>
                      </Button>
                    )}
                    {teacher.linkedin_url && (
                      <Button asChild variant="outline" size="sm">
                        <a href={teacher.linkedin_url} target="_blank" rel="noopener noreferrer">
                          <Linkedin className="mr-2 h-4 w-4" /> LinkedIn
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {mostrarVerTodos && (
                <div className="border-t pt-4">
                  <Link
                    to="/docentes"
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                  >
                    Ver todos los docentes
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
