import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AdminPageHeader, CreateButton, EditButton, DeleteButton, FormDialog, EmptyState,
} from "@/components/admin/AdminUI";
import { AiContentGenerator } from "@/components/ai/AiContentGenerator";
import { AudioUploader } from "@/components/AudioUploader";
import { Badge } from "@/components/ui/badge";
import { LessonMaterialsManager } from "@/components/LessonMaterialsManager";


export const Route = createFileRoute("/_authenticated/admin/modulos")({
  component: LeccionesPage,
});

type Leccion = {
  id?: string;
  programa_id: string;
  modulo_id: string | null;
  docente_id: string | null;
  titulo: string;
  descripcion: string;
  orden: number;
  duracion_minutos: number | null;
  video_url: string;
  audio_url: string;
  material_url: string;
  es_en_vivo: boolean;
  fecha_sesion: string | null;
  disponible_desde: string | null;
};

type CourseModule = {
  id?: string;
  programa_id: string;
  titulo: string;
  descripcion: string;
  orden: number;
};

const emptyLeccion = (programa_id: string, modulo_id: string | null = null): Leccion => ({
  programa_id, modulo_id, docente_id: null, titulo: "", descripcion: "", orden: 0,
  duracion_minutos: null, video_url: "", audio_url: "", material_url: "",
  es_en_vivo: false, fecha_sesion: null, disponible_desde: null,
});

const emptyModulo = (programa_id: string): CourseModule => ({
  programa_id, titulo: "", descripcion: "", orden: 0,
});

function LeccionesPage() {
  const qc = useQueryClient();
  const [programaId, setProgramaId] = useState<string>("");
  const [openLec, setOpenLec] = useState(false);
  const [editingLec, setEditingLec] = useState<Leccion>(emptyLeccion(""));
  const [openMod, setOpenMod] = useState(false);
  const [editingMod, setEditingMod] = useState<CourseModule>(emptyModulo(""));

  const { data: programas = [] } = useQuery({
    queryKey: ["admin", "programas", "lookup"],
    queryFn: async () =>
      (await supabase.from("programs").select("id,titulo,tipo").order("titulo")).data ?? [],
  });

  const programa = programas.find((p: any) => p.id === programaId) as
    | { id: string; titulo: string; tipo: string }
    | undefined;
  const esDiplomado = programa?.tipo === "diplomado";

  const { data: docentes = [] } = useQuery({
    queryKey: ["admin", "docentes", "lookup"],
    queryFn: async () =>
      (await supabase.from("teachers").select("id,nombre,apellido")).data ?? [],
  });

  const { data: modulos = [] } = useQuery<CourseModule[]>({
    queryKey: ["admin", "course_modules", programaId],
    enabled: !!programaId && esDiplomado,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("course_modules")
        .select("*")
        .eq("programa_id", programaId)
        .order("orden");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rows = [] } = useQuery<Leccion[]>({
    queryKey: ["admin", "lecciones", programaId],
    enabled: !!programaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_modules")
        .select("*")
        .eq("programa_id", programaId)
        .order("orden");
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  // ---- Módulos (course_modules) ----
  const saveModulo = async (v: CourseModule) => {
    const payload = { ...v, orden: Number(v.orden) || 0 };
    const { error } = v.id
      ? await (supabase.from as any)("course_modules").update(payload).eq("id", v.id)
      : await (supabase.from as any)("course_modules").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Módulo guardado");
    setOpenMod(false);
    qc.invalidateQueries({ queryKey: ["admin", "course_modules", programaId] });
  };

  const removeModulo = async (id: string) => {
    const tieneLecciones = rows.some((r) => r.modulo_id === id);
    if (tieneLecciones) {
      return toast.error("Mueve o elimina primero las lecciones de este módulo.");
    }
    const { error } = await (supabase.from as any)("course_modules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Módulo eliminado");
    qc.invalidateQueries({ queryKey: ["admin", "course_modules", programaId] });
  };

  // ---- Lecciones (program_modules) ----
  const saveLeccion = async (v: Leccion) => {
    if (esDiplomado && !v.modulo_id) {
      return toast.error("Selecciona el módulo al que pertenece la lección.");
    }
    const payload = {
      ...v,
      modulo_id: esDiplomado ? v.modulo_id : null,
      orden: Number(v.orden) || 0,
      duracion_minutos: v.duracion_minutos ? Number(v.duracion_minutos) : null,
      fecha_sesion: v.fecha_sesion || null,
      disponible_desde: v.disponible_desde || null,
      docente_id: v.docente_id || null,
    };
    const { error } = v.id
      ? await supabase.from("program_modules").update(payload).eq("id", v.id)
      : await supabase.from("program_modules").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Lección guardada");
    setOpenLec(false);
    qc.invalidateQueries({ queryKey: ["admin", "lecciones", programaId] });
  };

  const removeLeccion = async (id: string) => {
    const { error } = await supabase.from("program_modules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Lección eliminada");
    qc.invalidateQueries({ queryKey: ["admin", "lecciones", programaId] });
  };

  const moduloTitulo = (id: string | null) =>
    modulos.find((m) => m.id === id)?.titulo ?? "—";

  // Agrupar lecciones por módulo cuando es diplomado
  const grupos = esDiplomado
    ? modulos.map((m) => ({
        modulo: m,
        lecciones: rows.filter((r) => r.modulo_id === m.id),
      }))
    : [];
  const huerfanas = esDiplomado ? rows.filter((r) => !r.modulo_id) : [];

  return (
    <div>
      <AdminPageHeader
        title="Lecciones"
        description="Contenido del programa. Los diplomados se organizan en módulos; los cursos tienen lecciones directamente."
        action={
          programaId ? (
            <CreateButton
              label="Nueva lección"
              onClick={() => {
                setEditingLec(
                  emptyLeccion(programaId, esDiplomado ? modulos[0]?.id ?? null : null),
                );
                setOpenLec(true);
              }}
            />
          ) : null
        }
      />

      <div className="mb-6 max-w-md">
        <Label>Selecciona un programa</Label>
        <Select value={programaId} onValueChange={setProgramaId}>
          <SelectTrigger><SelectValue placeholder="-- elige un programa --" /></SelectTrigger>
          <SelectContent>
            {programas.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.titulo} <span className="ml-2 text-xs text-muted-foreground capitalize">({p.tipo})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!programaId ? (
        <EmptyState>Selecciona un programa para gestionar su contenido.</EmptyState>
      ) : (
        <>
          {/* Sección de Módulos (solo diplomados) */}
          {esDiplomado && (
            <section className="mb-8 rounded-lg border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Módulos del diplomado</h2>
                  <p className="text-sm text-muted-foreground">
                    Cada módulo agrupa un conjunto de lecciones.
                  </p>
                </div>
                <CreateButton
                  label="Nuevo módulo"
                  onClick={() => { setEditingMod(emptyModulo(programaId)); setOpenMod(true); }}
                />
              </div>

              {modulos.length === 0 ? (
                <EmptyState>Aún no hay módulos. Crea el primero para empezar a añadir lecciones.</EmptyState>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Lecciones</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modulos.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.orden}</TableCell>
                        <TableCell className="font-medium">{m.titulo}</TableCell>
                        <TableCell>
                          {rows.filter((r) => r.modulo_id === m.id).length}
                        </TableCell>
                        <TableCell className="text-right">
                          <EditButton onClick={() => { setEditingMod({ ...m }); setOpenMod(true); }} />
                          <DeleteButton onConfirm={() => removeModulo(m.id!)} label="el módulo" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          )}

          {/* Lecciones */}
          <h2 className="mb-3 text-lg font-bold">Lecciones</h2>
          {rows.length === 0 ? (
            <EmptyState>Este programa aún no tiene lecciones.</EmptyState>
          ) : esDiplomado ? (
            <div className="space-y-6">
              {grupos.map(({ modulo, lecciones }) => (
                <div key={modulo.id} className="rounded-lg border bg-card">
                  <div className="border-b px-4 py-3">
                    <h3 className="font-semibold">
                      {modulo.orden}. {modulo.titulo}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({lecciones.length} lecciones)
                      </span>
                    </h3>
                  </div>
                  {lecciones.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground">Sin lecciones todavía.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">#</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Duración</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lecciones.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.orden}</TableCell>
                            <TableCell className="font-medium">{r.titulo}</TableCell>
                            <TableCell>{r.es_en_vivo ? "En vivo (Zoom)" : "Grabado"}</TableCell>
                            <TableCell>{r.duracion_minutos ? `${r.duracion_minutos} min` : "—"}</TableCell>
                            <TableCell className="text-right">
                              <EditButton onClick={() => { setEditingLec({ ...r }); setOpenLec(true); }} />
                              <DeleteButton onConfirm={() => removeLeccion(r.id!)} label="la lección" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}
              {huerfanas.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                  <div className="border-b border-amber-300 px-4 py-3">
                    <Badge variant="outline">Sin módulo asignado</Badge>
                  </div>
                  <Table>
                    <TableBody>
                      {huerfanas.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.titulo}</TableCell>
                          <TableCell className="text-right">
                            <EditButton onClick={() => { setEditingLec({ ...r }); setOpenLec(true); }} />
                            <DeleteButton onConfirm={() => removeLeccion(r.id!)} label="la lección" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.orden}</TableCell>
                      <TableCell className="font-medium">{r.titulo}</TableCell>
                      <TableCell>{r.es_en_vivo ? "En vivo (Zoom)" : "Grabado"}</TableCell>
                      <TableCell>{r.duracion_minutos ? `${r.duracion_minutos} min` : "—"}</TableCell>
                      <TableCell className="text-right">
                        <EditButton onClick={() => { setEditingLec({ ...r }); setOpenLec(true); }} />
                        <DeleteButton onConfirm={() => removeLeccion(r.id!)} label="la lección" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Diálogo de Módulo */}
      <FormDialog<CourseModule>
        title={editingMod.id ? "Editar módulo" : "Nuevo módulo"}
        open={openMod}
        onOpenChange={setOpenMod}
        initial={editingMod}
        onSubmit={saveModulo}
      >
        {(s, set) => (
          <>
            <div className="grid gap-2">
              <Label>Título del módulo</Label>
              <Input value={s.titulo} onChange={(e) => set({ titulo: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                rows={3}
                value={s.descripcion ?? ""}
                onChange={(e) => set({ descripcion: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Orden</Label>
              <Input
                type="number"
                value={s.orden}
                onChange={(e) => set({ orden: Number(e.target.value) })}
              />
            </div>
          </>
        )}
      </FormDialog>

      {/* Diálogo de Lección */}
      <FormDialog<Leccion>
        title={editingLec.id ? "Editar lección" : "Nueva lección"}
        open={openLec}
        onOpenChange={setOpenLec}
        initial={editingLec}
        onSubmit={saveLeccion}
      >
        {(s, set) => (
          <>
            {esDiplomado && (
              <div className="grid gap-2">
                <Label>Módulo *</Label>
                <Select
                  value={s.modulo_id ?? ""}
                  onValueChange={(v) => set({ modulo_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el módulo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modulos.map((m) => (
                      <SelectItem key={m.id} value={m.id!}>
                        {m.orden}. {m.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {modulos.length === 0 && (
                  <p className="text-xs text-amber-600">
                    Crea primero un módulo en la sección superior.
                  </p>
                )}
              </div>
            )}
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={s.titulo} onChange={(e) => set({ titulo: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Descripción</Label>
                <AiContentGenerator
                  triggerLabel="Generar con IA"
                  onApply={({ titulo, contenido }: { titulo: string; contenido: string }) => set({
                    titulo: s.titulo || titulo,
                    descripcion: contenido,
                  })}
                />
              </div>
              <Textarea rows={6} value={s.descripcion ?? ""} onChange={(e) => set({ descripcion: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Orden</Label>
                <Input type="number" value={s.orden} onChange={(e) => set({ orden: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>Duración (min)</Label>
                <Input
                  type="number"
                  value={s.duracion_minutos ?? ""}
                  onChange={(e) => set({ duracion_minutos: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Docente de la lección (opcional, sobreescribe el del programa)</Label>
              <Select
                value={s.docente_id ?? "none"}
                onValueChange={(v) => set({ docente_id: v === "none" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Usar docente del programa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Usar docente del programa</SelectItem>
                  {docentes.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.nombre} {d.apellido}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Video grabado (URL de YouTube/Vimeo o video subido)</Label>
              <Input
                placeholder="https://..."
                value={s.video_url ?? ""}
                onChange={(e) => set({ video_url: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Audio de la lección</Label>
              <AudioUploader
                value={s.audio_url}
                onChange={(url) => set({ audio_url: url ?? "" })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Materiales complementarios</Label>
              {s.id ? (
                <LessonMaterialsManager
                  moduloId={s.id}
                  programaId={s.programa_id}
                />
              ) : (
                <p className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
                  Guarda primero la lección para poder adjuntar uno o varios documentos (PDF, Word, Excel, PowerPoint).
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={s.es_en_vivo} onCheckedChange={(c) => set({ es_en_vivo: c })} />
              <span className="text-sm">Sesión en vivo por Zoom</span>
            </div>
            {s.es_en_vivo && (
              <div className="grid gap-2">
                <Label>Fecha y hora de la sesión</Label>
                <Input
                  type="datetime-local"
                  value={s.fecha_sesion ? s.fecha_sesion.substring(0, 16) : ""}
                  onChange={(e) => set({ fecha_sesion: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label>Disponible para alumnos desde (opcional)</Label>
              <Input
                type="datetime-local"
                value={s.disponible_desde ? s.disponible_desde.substring(0, 16) : ""}
                onChange={(e) => set({ disponible_desde: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
              <p className="text-xs text-muted-foreground">
                Si estableces una fecha futura, la lección aparecerá bloqueada hasta ese momento. Deja vacío para publicarla de inmediato.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Lección encadenada al módulo: <strong>{moduloTitulo(s.modulo_id)}</strong>
            </p>
          </>
        )}
      </FormDialog>
    </div>
  );
}
