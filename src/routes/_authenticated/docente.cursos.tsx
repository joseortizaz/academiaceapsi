import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, Video, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/docente/cursos")({
  component: DocenteCursos,
});

function DocenteCursos() {
  const { user } = useAuth();
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  const { data: teacher } = useQuery({
    queryKey: ["docente-record", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("teachers").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: programas = [] } = useQuery({
    queryKey: ["docente-cursos", teacher?.id],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("*").eq("docente_id", teacher!.id);
      return data ?? [];
    },
  });

  const programaIds = programas.map((p) => p.id);

  const { data: enrollments = [] } = useQuery({
    queryKey: ["docente-cursos-enrollments", programaIds],
    enabled: programaIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id,programa_id,user_id,estado,progreso_porcentaje")
        .in("programa_id", programaIds);
      return data ?? [];
    },
  });

  const userIds = Array.from(new Set(enrollments.map((e) => e.user_id)));
  type Alumno = { id: string; nombre: string | null; apellido: string | null; avatar_url: string | null };
  const { data: alumnos = [] } = useQuery<Alumno[]>({
    queryKey: ["docente-cursos-alumnos", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("profiles_public").select("id,nombre,apellido,avatar_url").in("id", userIds);
      return (data ?? []) as Alumno[];
    },
  });

  const alumnoMap = new Map<string, Alumno>(alumnos.map((a) => [a.id, a]));

  const handleCreateSession = (e: React.FormEvent<HTMLFormElement>, programaId: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const titulo = (form.elements.namedItem("titulo") as HTMLInputElement).value;
    toast.success(`Sesión "${titulo}" programada correctamente (simulado).`);
    form.reset();
    setOpenSession(null);
  };

  const handleMessage = (nombre: string) => {
    toast.success(`Mensaje enviado a ${nombre} (simulado).`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis Cursos</h1>
        <p className="text-muted-foreground">Gestiona los programas que tienes a tu cargo.</p>
      </div>

      {programas.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No tienes cursos asignados.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {programas.map((p) => {
            const inscritos = enrollments.filter((e) => e.programa_id === p.id);
            const promedio = inscritos.length
              ? Math.round(inscritos.reduce((s, e) => s + (e.progreso_porcentaje ?? 0), 0) / inscritos.length)
              : 0;
            return (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{p.titulo}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground capitalize">{p.modalidad} · {p.estado}</p>
                    </div>
                    <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" /> {inscritos.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Progreso promedio</span><span>{promedio}%</span>
                    </div>
                    <Progress value={promedio} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setSelectedCourse(p.id)}>
                      Ver detalle
                    </Button>
                    <Dialog open={openSession === p.id} onOpenChange={(o) => setOpenSession(o ? p.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="flex-1"><Video className="mr-1 h-3 w-3" /> Nueva sesión</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Programar clase en vivo</DialogTitle></DialogHeader>
                        <form onSubmit={(e) => handleCreateSession(e, p.id)} className="space-y-3">
                          <div>
                            <Label htmlFor="titulo">Título</Label>
                            <Input id="titulo" name="titulo" required placeholder="Ej. Repaso Módulo 4" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div><Label htmlFor="fecha">Fecha</Label><Input id="fecha" type="date" required /></div>
                            <div><Label htmlFor="hora">Hora</Label><Input id="hora" type="time" required /></div>
                          </div>
                          <div>
                            <Label htmlFor="enlace">Enlace Zoom/Meet</Label>
                            <Input id="enlace" placeholder="https://zoom.us/j/..." required />
                          </div>
                          <DialogFooter><Button type="submit">Crear sesión</Button></DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Course detail dialog */}
      <Dialog open={!!selectedCourse} onOpenChange={(o) => !o && setSelectedCourse(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{programas.find((p) => p.id === selectedCourse)?.titulo}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="alumnos">
            <TabsList>
              <TabsTrigger value="alumnos">Alumnos inscritos</TabsTrigger>
              <TabsTrigger value="info">Información</TabsTrigger>
            </TabsList>
            <TabsContent value="alumnos">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alumno</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Progreso</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollments.filter((e) => e.programa_id === selectedCourse).map((e) => {
                      const a = alumnoMap.get(e.user_id);
                      const nombre = a ? `${a.nombre} ${a.apellido ?? ""}` : "Alumno";
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{nombre}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{e.estado}</Badge></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={e.progreso_porcentaje ?? 0} className="w-24" />
                              <span className="text-xs">{e.progreso_porcentaje ?? 0}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => handleMessage(nombre)}>
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {enrollments.filter((e) => e.programa_id === selectedCourse).length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin inscritos.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="info">
              <p className="text-sm text-muted-foreground">
                {programas.find((p) => p.id === selectedCourse)?.descripcion}
              </p>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
