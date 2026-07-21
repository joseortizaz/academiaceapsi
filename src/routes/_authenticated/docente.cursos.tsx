import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Users, Plus, Video, MessageSquare, Pencil, Trash2, PlayCircle, Radio } from "lucide-react";
import { toast } from "sonner";
import { LessonMaterialsManager } from "@/components/LessonMaterialsManager";
import { listZoomMeetings } from "@/lib/zoom.functions";


export const Route = createFileRoute("/_authenticated/docente/cursos")({
  component: DocenteCursos,
});

type Leccion = {
  id?: string;
  programa_id: string;
  modulo_id: string | null;
  titulo: string;
  descripcion: string | null;
  orden: number;
  duracion_minutos: number | null;
  video_url: string | null;
  audio_url: string | null;
  material_url: string | null;
};

const emptyLeccion = (programa_id: string): Leccion => ({
  programa_id, modulo_id: null, titulo: "", descripcion: "", orden: 0,
  duracion_minutos: null, video_url: "", audio_url: "", material_url: "",
});

function DocenteCursos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [openLec, setOpenLec] = useState(false);
  const [editingLec, setEditingLec] = useState<Leccion>(emptyLeccion(""));

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

  // Lecciones del programa seleccionado
  const { data: lecciones = [] } = useQuery<Leccion[]>({
    queryKey: ["docente-lecciones", selectedCourse],
    enabled: !!selectedCourse,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_modules")
        .select("*")
        .eq("programa_id", selectedCourse!)
        .order("orden");
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  const refreshLecciones = () =>
    qc.invalidateQueries({ queryKey: ["docente-lecciones", selectedCourse] });

  const handleCreateSession = (e: React.FormEvent<HTMLFormElement>, _programaId: string) => {
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

  const openCreateLeccion = () => {
    if (!selectedCourse) return;
    const nextOrden = (lecciones[lecciones.length - 1]?.orden ?? -1) + 1;
    setEditingLec({ ...emptyLeccion(selectedCourse), orden: nextOrden });
    setOpenLec(true);
  };

  const openEditLeccion = (l: Leccion) => {
    setEditingLec({
      ...l,
      descripcion: l.descripcion ?? "",
      video_url: l.video_url ?? "",
      audio_url: l.audio_url ?? "",
      material_url: l.material_url ?? "",
    });
    setOpenLec(true);
  };

  const saveLeccion = async () => {
    if (!editingLec.titulo.trim()) return toast.error("El título es obligatorio");
    const payload = {
      programa_id: editingLec.programa_id,
      modulo_id: editingLec.modulo_id,
      titulo: editingLec.titulo.trim(),
      descripcion: editingLec.descripcion || null,
      orden: Number(editingLec.orden) || 0,
      duracion_minutos: editingLec.duracion_minutos ? Number(editingLec.duracion_minutos) : null,
      video_url: editingLec.video_url || null,
      audio_url: editingLec.audio_url || null,
      material_url: editingLec.material_url || null,
    };
    const { error } = editingLec.id
      ? await supabase.from("program_modules").update(payload).eq("id", editingLec.id)
      : await supabase.from("program_modules").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Lección guardada y publicada");
    setOpenLec(false);
    refreshLecciones();
  };

  const removeLeccion = async (id: string) => {
    if (!confirm("¿Eliminar esta lección y todos sus materiales?")) return;
    const { error } = await supabase.from("program_modules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Lección eliminada");
    refreshLecciones();
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
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{programas.find((p) => p.id === selectedCourse)?.titulo}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="lecciones">
            <TabsList>
              <TabsTrigger value="lecciones">Lecciones</TabsTrigger>
              <TabsTrigger value="alumnos">Alumnos inscritos</TabsTrigger>
              <TabsTrigger value="info">Información</TabsTrigger>
            </TabsList>

            <TabsContent value="lecciones" className="space-y-4">
              <div className="flex justify-between">
                <p className="text-sm text-muted-foreground">
                  Crea, edita y elimina lecciones. Las lecciones se publican de inmediato.
                </p>
                <Button size="sm" onClick={openCreateLeccion}>
                  <Plus className="mr-1 h-4 w-4" /> Nueva lección
                </Button>
              </div>

              {lecciones.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay lecciones en este curso.</p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {lecciones.map((l) => (
                    <AccordionItem key={l.id} value={l.id!}>
                      <div className="flex items-center gap-2">
                        <AccordionTrigger className="flex-1 hover:no-underline">
                          <div className="flex flex-col items-start text-left">
                            <span className="font-medium">{l.orden + 1}. {l.titulo}</span>
                            {l.duracion_minutos ? (
                              <span className="text-xs text-muted-foreground">{l.duracion_minutos} min</span>
                            ) : null}
                          </div>
                        </AccordionTrigger>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditLeccion(l); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={(e) => { e.stopPropagation(); removeLeccion(l.id!); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <AccordionContent className="space-y-3">
                        {l.descripcion && <p className="text-sm text-muted-foreground">{l.descripcion}</p>}
                        {l.video_url && (
                          <video src={l.video_url} controls preload="metadata" className="max-h-64 w-full rounded" />
                        )}
                        {l.audio_url && (
                          <audio src={l.audio_url} controls preload="metadata" className="w-full" />
                        )}
                        <div>
                          <h4 className="mb-2 text-sm font-semibold">Recursos didácticos</h4>
                          <LessonMaterialsManager
                            moduloId={l.id!}
                            programaId={l.programa_id}
                            editable
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </TabsContent>

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

      {/* Lesson editor dialog */}
      <Dialog open={openLec} onOpenChange={setOpenLec}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLec.id ? "Editar lección" : "Nueva lección"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="lec-titulo">Título *</Label>
              <Input id="lec-titulo" value={editingLec.titulo}
                onChange={(e) => setEditingLec({ ...editingLec, titulo: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="lec-desc">Descripción</Label>
              <Textarea id="lec-desc" value={editingLec.descripcion ?? ""}
                onChange={(e) => setEditingLec({ ...editingLec, descripcion: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="lec-orden">Orden</Label>
                <Input id="lec-orden" type="number" value={editingLec.orden}
                  onChange={(e) => setEditingLec({ ...editingLec, orden: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="lec-dur">Duración (min)</Label>
                <Input id="lec-dur" type="number" value={editingLec.duracion_minutos ?? ""}
                  onChange={(e) => setEditingLec({ ...editingLec, duracion_minutos: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div>
              <Label htmlFor="lec-video">URL de video (opcional)</Label>
              <Input id="lec-video" placeholder="https://..." value={editingLec.video_url ?? ""}
                onChange={(e) => setEditingLec({ ...editingLec, video_url: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="lec-audio">URL de audio (opcional)</Label>
              <Input id="lec-audio" placeholder="https://..." value={editingLec.audio_url ?? ""}
                onChange={(e) => setEditingLec({ ...editingLec, audio_url: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Para subir videos, PDFs y audios directamente, guarda la lección y agrégalos
              en la sección "Recursos didácticos".
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenLec(false)}>Cancelar</Button>
            <Button onClick={saveLeccion}>Guardar y publicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
