import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
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
  Video, Plus, PlayCircle, AlertTriangle, Radio, FileVideo, Copy, FlaskConical, Trash2,
} from "lucide-react";
import { useZoomStore, zoomStore, isLiveNow, type ZoomClass } from "@/lib/zoom-mock";

export const Route = createFileRoute("/_authenticated/docente/clases-vivo")({
  component: DocenteClasesVivo,
});

function DocenteClasesVivo() {
  const { user } = useAuth();
  const { connection, classes } = useZoomStore();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ZoomClass | null>(null);

  const { data: teacher } = useQuery({
    queryKey: ["docente-record", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("teachers").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: programas = [] } = useQuery({
    queryKey: ["docente-programas-zoom", teacher?.id],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("id,titulo").eq("docente_id", teacher!.id);
      return data ?? [];
    },
  });

  const docenteNombre = useMemo(
    () => (user ? `${user.nombre ?? ""} ${user.apellido ?? ""}`.trim() : "Docente"),
    [user],
  );

  const programados = classes.filter((c) => c.status === "scheduled");
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
            programas={programas.length ? programas : [{ id: "demo-web", titulo: "Introducción a Desarrollo Web" }]}
            docenteNombre={docenteNombre}
            onClose={() => setOpen(false)}
          />
        </Dialog>
      </div>

      {!connection.connected && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="text-sm">
              Zoom aún no está conectado. Las reuniones se crearán en modo simulado.
              Pide al administrador conectar la cuenta desde <span className="font-medium">Integraciones</span>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* En vivo ahora */}
      {enVivo.length > 0 && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <Radio className="h-5 w-5 animate-pulse" /> Clases en vivo ahora
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {enVivo.map((c) => (
              <ClassRow
                key={c.id}
                cls={c}
                onSimulate={() => simulateEnd(c)}
                onOpenPreview={() => setPreview(c)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Programadas */}
      <Card>
        <CardHeader>
          <CardTitle>Próximas clases</CardTitle>
          <CardDescription>Sesiones programadas que aún no han iniciado.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ClassTable
            rows={programados}
            empty="No hay clases programadas."
            onSimulate={simulateEnd}
            onOpenPreview={setPreview}
          />
        </CardContent>
      </Card>

      {/* Grabadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileVideo className="h-5 w-5 text-primary" /> Clases grabadas
          </CardTitle>
          <CardDescription>
            Grabaciones procesadas por Zoom — verifica antes de publicar al alumnado.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ClassTable
            rows={grabadas}
            empty="Aún no hay grabaciones disponibles."
            onSimulate={simulateEnd}
            onOpenPreview={setPreview}
            showRecording
          />
        </CardContent>
      </Card>

      {/* Recording preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.titulo}</DialogTitle>
          </DialogHeader>
          {preview?.recordingUrl ? (
            <div className="space-y-2">
              <video
                key={preview.id}
                src={preview.recordingUrl}
                controls
                className="aspect-video w-full rounded-md bg-black"
              />
              <p className="text-xs text-muted-foreground">
                Duración: {preview.recordingDurationMin} min · ID Zoom: {preview.zoomMeetingId}
              </p>
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

  function simulateEnd(c: ZoomClass) {
    toast.info("Procesando grabación de video…", {
      description: `Webhook simulado: meeting.ended (${c.zoomMeetingId})`,
    });
    zoomStore.simulateMeetingEnd(c.id);
    setTimeout(() => {
      toast.success("Grabación disponible en el aula virtual", {
        description: c.titulo,
      });
    }, 1700);
  }
}

function ClassTable({
  rows, empty, onSimulate, onOpenPreview, showRecording,
}: {
  rows: ZoomClass[];
  empty: string;
  onSimulate: (c: ZoomClass) => void;
  onOpenPreview: (c: ZoomClass) => void;
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
          <TableHead>Programa</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">{c.titulo}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{c.programaTitulo}</TableCell>
            <TableCell className="whitespace-nowrap text-sm">
              {new Date(c.startAt).toLocaleString("es-DO", {
                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </TableCell>
            <TableCell><StatusBadge cls={c} /></TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                {showRecording && c.recordingUrl && (
                  <Button size="sm" variant="outline" onClick={() => onOpenPreview(c)}>
                    <PlayCircle className="mr-1 h-3 w-3" /> Ver
                  </Button>
                )}
                {c.status !== "recorded" && (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        zoomStore.startClass(c.id);
                        if (c.zoomStartUrl) window.open(c.zoomStartUrl, "_blank");
                        toast.success("Iniciando clase en Zoom…");
                      }}
                    >
                      <PlayCircle className="mr-1 h-3 w-3" /> Iniciar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onSimulate(c)} title="Simular fin de reunión y carga de video">
                      <FlaskConical className="h-3 w-3" />
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    zoomStore.deleteClass(c.id);
                    toast.success("Clase eliminada");
                  }}
                >
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

function ClassRow({
  cls, onSimulate, onOpenPreview,
}: { cls: ZoomClass; onSimulate: () => void; onOpenPreview: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3">
      <div>
        <p className="font-medium">{cls.titulo}</p>
        <p className="text-xs text-muted-foreground">
          {cls.programaTitulo} · ID Zoom {cls.zoomMeetingId}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" asChild>
          <a href={cls.zoomStartUrl || cls.zoomJoinUrl} target="_blank" rel="noreferrer">
            <PlayCircle className="mr-1 h-3 w-3" /> Entrar como anfitrión
          </a>
        </Button>
        <Button size="sm" variant="outline" onClick={onSimulate}>
          <FlaskConical className="mr-1 h-3 w-3" /> Simular fin
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ cls }: { cls: ZoomClass }) {
  if (cls.status === "recorded")
    return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">Grabación disponible</Badge>;
  if (cls.status === "live" || isLiveNow(cls))
    return <Badge className="animate-pulse bg-red-500/15 text-red-700 hover:bg-red-500/15">En vivo</Badge>;
  return <Badge variant="outline">Planificada</Badge>;
}

function CreateClassDialog({
  programas, docenteNombre, onClose,
}: { programas: { id: string; titulo: string }[]; docenteNombre: string; onClose: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [programaId, setProgramaId] = useState(programas[0]?.id ?? "");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [duracion, setDuracion] = useState(60);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [autoRecord, setAutoRecord] = useState(true);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const programa = programas.find((p) => p.id === programaId);
    if (!programa) return;
    const startAt = new Date(`${fecha}T${hora}`).toISOString();
    const created = zoomStore.scheduleClass({
      titulo,
      programaId,
      programaTitulo: programa.titulo,
      docenteNombre,
      startAt,
      durationMin: duracion,
      autoGenerate,
      autoRecord,
    });
    if (autoGenerate) {
      toast.success("Enlace de Zoom generado", {
        description: `ID ${created.zoomMeetingId}`,
        action: {
          label: "Copiar",
          onClick: () => navigator.clipboard.writeText(created.zoomJoinUrl),
        },
      });
    } else {
      toast.success("Clase guardada sin enlace de Zoom");
    }
    onClose();
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
          <Input
            id="cls-titulo" required value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Repaso Módulo 4 — Flexbox y Grid"
          />
        </div>
        <div>
          <Label>Programa</Label>
          <Select value={programaId} onValueChange={setProgramaId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {programas.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="cls-auto" className="cursor-pointer">Generar enlace de Zoom automáticamente</Label>
              <p className="text-xs text-muted-foreground">Crea la reunión vía API de Zoom y comparte el enlace con los inscritos.</p>
            </div>
            <Switch id="cls-auto" checked={autoGenerate} onCheckedChange={setAutoGenerate} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="cls-rec" className="cursor-pointer">Grabar clase automáticamente en la nube</Label>
              <p className="text-xs text-muted-foreground">La grabación se publicará en el aula virtual al finalizar.</p>
            </div>
            <Switch id="cls-rec" checked={autoRecord} onCheckedChange={setAutoRecord} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit"><Copy className="mr-2 h-4 w-4" /> Crear y generar enlace</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
