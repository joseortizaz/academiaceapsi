import { RecordingPlayer } from "@/components/RecordingPlayer";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { useTeacherPrograms } from "@/hooks/use-teacher-programs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Video, Plus, PlayCircle, Radio, FileVideo, Copy, Trash2, ExternalLink,
} from "lucide-react";
import {
  createZoomMeeting,
  deleteZoomMeeting,
  listZoomMeetings,
} from "@/lib/zoom.functions";

export const Route = createFileRoute("/_authenticated/docente/clases-vivo")({
  component: DocenteClasesVivo,
});

type ZoomMeetingRow = {
  id: string;
  programa_id: string;
  cohort_id: string | null;
  cohort?: { nombre: string } | null;
  titulo: string;
  docente_nombre: string | null;
  zoom_meeting_id: string;
  zoom_join_url: string;
  zoom_start_url: string | null;
  start_at: string;
  duration_min: number;
  status: "scheduled" | "live" | "ended" | "recorded";
  recording_url: string | null;
  recording_share_url: string | null;
  recording_duration_min: number | null;
};


function isLiveNow(m: ZoomMeetingRow) {
  const start = new Date(m.start_at).getTime();
  const end = start + m.duration_min * 60 * 1000;
  const now = Date.now();
  return now >= start - 5 * 60 * 1000 && now <= end;
}

function DocenteClasesVivo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ZoomMeetingRow | null>(null);

  const listFn = useServerFn(listZoomMeetings);
  const deleteFn = useServerFn(deleteZoomMeeting);

  const { data: teacher } = useQuery({
    queryKey: ["docente-record", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("teachers").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { programaIds } = useTeacherPrograms();
  const { data: programas = [] } = useQuery({
    queryKey: ["docente-programas-zoom", programaIds],
    enabled: programaIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("id,titulo").in("id", programaIds);
      return data ?? [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["zoom-meetings"],
    queryFn: async () => (await listFn({ data: {} })) as ZoomMeetingRow[],
    refetchInterval: 30_000,
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zoom-meetings"] });
      toast.success("Clase eliminada");
    },
  });

  const docenteNombre = useMemo(
    () => (user ? `${user.nombre ?? ""} ${user.apellido ?? ""}`.trim() : "Docente"),
    [user],
  );

  const programados = classes.filter((c) => c.status === "scheduled" && !isLiveNow(c));
  const enVivo = classes.filter((c) => c.status === "live" || isLiveNow(c));
  const grabadas = classes.filter((c) => c.status === "recorded");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clases en vivo y grabaciones</h1>
          <p className="text-muted-foreground">
            Programa sesiones de Zoom y verifica grabaciones automáticas.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Crear clase en vivo</Button>
          </DialogTrigger>
          <CreateClassDialog
            programas={programas}
            docenteNombre={docenteNombre}
            onClose={() => setOpen(false)}
            onCreated={() => qc.invalidateQueries({ queryKey: ["zoom-meetings"] })}
          />
        </Dialog>
      </div>

      {enVivo.length > 0 && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <Radio className="h-5 w-5 animate-pulse" /> Clases en vivo ahora
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {enVivo.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3">
                <div>
                  <p className="font-medium">{c.titulo}</p>
                  <p className="text-xs text-muted-foreground">ID Zoom {c.zoom_meeting_id}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" asChild>
                    <Link to="/clase-vivo/$meetingId" params={{ meetingId: c.id }}>
                      <PlayCircle className="mr-1 h-3 w-3" /> Entrar a la sala
                    </Link>
                  </Button>
                  {c.zoom_start_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={c.zoom_start_url} target="_blank" rel="noreferrer">
                        Abrir en Zoom <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Próximas clases</CardTitle>
          <CardDescription>Sesiones programadas que aún no han iniciado.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ClassTable
            rows={programados}
            empty="No hay clases programadas."
            onDelete={(id) => removeMut.mutate(id)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileVideo className="h-5 w-5 text-primary" /> Clases grabadas
          </CardTitle>
          <CardDescription>
            Grabaciones procesadas por Zoom — disponibles cuando termina la clase.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ClassTable
            rows={grabadas}
            empty="Aún no hay grabaciones disponibles."
            onDelete={(id) => removeMut.mutate(id)}
            onPreview={setPreview}
            showRecording
          />
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.titulo}</DialogTitle>
          </DialogHeader>
          {preview && (preview.status === "recorded" || preview.recording_share_url) ? (
            <div className="space-y-3">
              <RecordingPlayer
                meetingRowId={preview.id}
                fallbackUrl={preview.recording_share_url}
              />
              {preview.recording_duration_min ? (
                <p className="text-sm text-muted-foreground">
                  Duración: {preview.recording_duration_min} min.
                </p>
              ) : null}
              {preview.recording_share_url && (
                <Button asChild variant="outline" size="sm">
                  <a href={preview.recording_share_url} target="_blank" rel="noreferrer">
                    Abrir en Zoom <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              La grabación aún no está disponible.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClassTable({
  rows, empty, onDelete, onPreview, showRecording,
}: {
  rows: ZoomMeetingRow[];
  empty: string;
  onDelete: (id: string) => void;
  onPreview?: (c: ZoomMeetingRow) => void;
  showRecording?: boolean;
}) {
  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">{empty}</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Clase</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">
              <div className="flex flex-wrap items-center gap-2">
                <span>{c.titulo}</span>
                {c.cohort?.nombre ? (
                  <Badge variant="outline" className="text-xs">Grupo: {c.cohort.nombre}</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Todos los grupos</Badge>
                )}
              </div>
            </TableCell>

            <TableCell className="whitespace-nowrap text-sm">
              {new Date(c.start_at).toLocaleString("es-DO", {
                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </TableCell>
            <TableCell><StatusBadge status={c.status} /></TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                {showRecording && onPreview && (
                  <Button size="sm" variant="outline" onClick={() => onPreview(c)}>
                    <PlayCircle className="mr-1 h-3 w-3" /> Ver
                  </Button>
                )}
                {c.status === "scheduled" && (
                  <Button size="sm" variant="ghost" onClick={() => {
                    navigator.clipboard.writeText(c.zoom_join_url);
                    toast.success("Enlace copiado");
                  }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onDelete(c.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StatusBadge({ status }: { status: ZoomMeetingRow["status"] }) {
  if (status === "recorded")
    return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">Grabación disponible</Badge>;
  if (status === "live")
    return <Badge className="animate-pulse bg-red-500/15 text-red-700 hover:bg-red-500/15">En vivo</Badge>;
  if (status === "ended") return <Badge variant="outline">Finalizada</Badge>;
  return <Badge variant="outline">Planificada</Badge>;
}

function CreateClassDialog({
  programas, docenteNombre, onClose, onCreated,
}: {
  programas: { id: string; titulo: string }[];
  docenteNombre: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [programaId, setProgramaId] = useState(programas[0]?.id ?? "");
  const [cohortId, setCohortId] = useState<string>("__all__");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [duracion, setDuracion] = useState(60);
  const [autoRecord, setAutoRecord] = useState(true);
  const createFn = useServerFn(createZoomMeeting);

  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts-for-program", programaId],
    enabled: !!programaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("program_cohorts")
        .select("id, nombre")
        .eq("programa_id", programaId)
        .order("nombre");
      return data ?? [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      const startAt = new Date(`${fecha}T${hora}`).toISOString();
      return createFn({
        data: {
          programaId, titulo,
          cohortId: cohortId === "__all__" ? null : cohortId,
          startAt, durationMin: duracion,
          autoRecord, docenteNombre,
        },
      });
    },
    onSuccess: (m) => {
      toast.success("Reunión creada en Zoom", {
        description: `ID ${m.zoom_meeting_id}`,
        action: { label: "Copiar enlace", onClick: () => navigator.clipboard.writeText(m.zoom_join_url) },
      });
      onCreated();
      onClose();
    },
    onError: (e) => toast.error("No se pudo crear", { description: e instanceof Error ? e.message : String(e) }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!programaId) {
      toast.error("Selecciona un programa");
      return;
    }
    mut.mutate();
  };


  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" /> Crear clase en vivo
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="cls-titulo">Título de la clase</Label>
          <Input id="cls-titulo" required value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Repaso Módulo 4" />
        </div>
        <div>
          <Label>Programa</Label>
          <Select value={programaId} onValueChange={(v) => { setProgramaId(v); setCohortId("__all__"); }}>
            <SelectTrigger><SelectValue placeholder="Selecciona un programa" /></SelectTrigger>
            <SelectContent>
              {programas.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Grupo / Cohorte (opcional)</Label>
          <Select value={cohortId} onValueChange={setCohortId}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los grupos del programa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los grupos del programa</SelectItem>
              {cohorts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Si eliges un grupo, solo esos alumnos verán la clase.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="cls-fecha">Fecha</Label>
            <Input id="cls-fecha" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cls-hora">Hora</Label>
            <Input id="cls-hora" type="time" required value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cls-dur">Duración (min)</Label>
            <Input id="cls-dur" type="number" min={15} max={240} value={duracion}
              onChange={(e) => setDuracion(Number(e.target.value))} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
          <div>
            <Label htmlFor="cls-rec" className="cursor-pointer">Grabar en la nube</Label>
            <p className="text-xs text-muted-foreground">La grabación se publica automáticamente al finalizar.</p>
          </div>
          <Switch id="cls-rec" checked={autoRecord} onCheckedChange={setAutoRecord} />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? "Creando…" : "Crear reunión"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
