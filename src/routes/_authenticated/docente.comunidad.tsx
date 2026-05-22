import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, Send, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/docente/comunidad")({
  component: DocenteComunidad,
});

type Pregunta = {
  id: string;
  alumno: string;
  curso: string;
  modulo: string;
  pregunta: string;
  fecha: string;
  resuelto: boolean;
  respuesta?: string;
};

const initialPreguntas: Pregunta[] = [
  { id: "p1", alumno: "María Pérez", curso: "Introducción a Desarrollo Web", modulo: "Módulo 3 · Flexbox", pregunta: "¿Cuál es la diferencia entre justify-content y align-items en Flexbox?", fecha: "Hace 2 horas", resuelto: false },
  { id: "p2", alumno: "Carlos Rodríguez", curso: "Marketing Digital Avanzado", modulo: "Módulo 5 · Google Ads", pregunta: "¿Cómo calculo el ROAS correctamente cuando hay conversiones asistidas?", fecha: "Hace 5 horas", resuelto: false },
  { id: "p3", alumno: "Lucía Fernández", curso: "Introducción a Desarrollo Web", modulo: "Módulo 4 · JS Básico", pregunta: "Me da error 'undefined' al usar map sobre un array vacío. ¿Por qué?", fecha: "Ayer", resuelto: false },
  { id: "p4", alumno: "Pedro Gómez", curso: "Psicología Organizacional", modulo: "Módulo 2 · Liderazgo", pregunta: "¿Recomienda algún libro complementario sobre liderazgo situacional?", fecha: "Hace 2 días", resuelto: true, respuesta: "Te recomiendo 'Leadership and the One Minute Manager' de Ken Blanchard." },
  { id: "p5", alumno: "Ana Jiménez", curso: "Marketing Digital Avanzado", modulo: "Módulo 1 · Funnels", pregunta: "¿El TOFU se trabaja mejor con contenido educativo o emocional?", fecha: "Hace 3 días", resuelto: true, respuesta: "Depende del público — en B2B funciona mejor educativo, en B2C el emocional." },
];

function DocenteComunidad() {
  const [preguntas, setPreguntas] = useState<Pregunta[]>(initialPreguntas);
  const [filter, setFilter] = useState<"todas" | "pendiente" | "resuelto">("pendiente");
  const [selected, setSelected] = useState<string | null>(initialPreguntas[0]?.id ?? null);
  const [respuesta, setRespuesta] = useState("");

  const filtered = preguntas.filter((p) => {
    if (filter === "pendiente") return !p.resuelto;
    if (filter === "resuelto") return p.resuelto;
    return true;
  });

  const activa = preguntas.find((p) => p.id === selected);

  const handleResponder = (markResolved: boolean) => {
    if (!activa || !respuesta.trim()) {
      toast.error("Escribe una respuesta primero.");
      return;
    }
    setPreguntas((prev) => prev.map((p) =>
      p.id === activa.id ? { ...p, respuesta, resuelto: markResolved || p.resuelto } : p
    ));
    toast.success(markResolved ? "Respondido y marcado como resuelto." : "Respuesta enviada.");
    setRespuesta("");
  };

  const handleToggleResolved = () => {
    if (!activa) return;
    setPreguntas((prev) => prev.map((p) =>
      p.id === activa.id ? { ...p, resuelto: !p.resuelto } : p
    ));
    toast.success(activa.resuelto ? "Marcado como pendiente." : "Marcado como resuelto.");
  };

  const initials = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Comunidad y Soporte</h1>
        <p className="text-muted-foreground">Responde dudas dejadas por tus alumnos en las clases.</p>
      </div>

      <div className="flex gap-1">
        {(["todas", "pendiente", "resuelto"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Inbox */}
        <Card>
          <CardContent className="max-h-[600px] divide-y overflow-y-auto p-0">
            {filtered.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Sin preguntas.</p>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelected(p.id); setRespuesta(""); }}
                className={cn(
                  "flex w-full gap-3 p-3 text-left transition-colors hover:bg-muted/50",
                  selected === p.id && "bg-muted"
                )}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs">{initials(p.alumno)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{p.alumno}</p>
                    {p.resuelto
                      ? <Badge variant="outline" className="gap-1 text-xs"><CheckCircle2 className="h-3 w-3 text-emerald-600" /></Badge>
                      : <Badge variant="destructive" className="text-xs">Nuevo</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{p.modulo}</p>
                  <p className="mt-1 line-clamp-2 text-xs">{p.pregunta}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{p.fecha}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Detail */}
        <Card>
          <CardContent className="p-6">
            {!activa ? (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="mb-3 h-10 w-10" />
                <p>Selecciona una pregunta para responder.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{activa.alumno}</p>
                    <p className="text-xs text-muted-foreground">{activa.curso} · {activa.modulo} · {activa.fecha}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleToggleResolved}>
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    {activa.resuelto ? "Reabrir" : "Marcar resuelto"}
                  </Button>
                </div>

                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm">{activa.pregunta}</p>
                </div>

                {activa.respuesta && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <p className="mb-1 text-xs font-semibold text-primary">Tu respuesta</p>
                    <p className="text-sm">{activa.respuesta}</p>
                  </div>
                )}

                <div>
                  <Textarea
                    value={respuesta}
                    onChange={(e) => setRespuesta(e.target.value)}
                    placeholder="Escribe tu respuesta…"
                    rows={4}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => handleResponder(false)}>
                      <Send className="mr-1 h-4 w-4" /> Responder
                    </Button>
                    <Button onClick={() => handleResponder(true)}>
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Responder y resolver
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
