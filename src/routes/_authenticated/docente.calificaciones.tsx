import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Search, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/docente/calificaciones")({
  component: DocenteCalificaciones,
});

type Entrega = {
  id: string;
  alumno: string;
  curso: string;
  tarea: string;
  fechaEntrega: string;
  estado: "pendiente" | "calificado";
  nota?: number;
  feedback?: string;
  contenido: string;
};

const initialEntregas: Entrega[] = [];

function DocenteCalificaciones() {
  const [entregas, setEntregas] = useState<Entrega[]>(initialEntregas);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "pendiente" | "calificado">("todos");
  const [editing, setEditing] = useState<Entrega | null>(null);
  const [nota, setNota] = useState("");
  const [feedback, setFeedback] = useState("");

  const filtered = entregas.filter((e) => {
    if (filter !== "todos" && e.estado !== filter) return false;
    if (search && !`${e.alumno} ${e.curso} ${e.tarea}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openEdit = (e: Entrega) => {
    setEditing(e);
    setNota(e.nota?.toString() ?? "");
    setFeedback(e.feedback ?? "");
  };

  const handleSave = () => {
    if (!editing) return;
    const num = Number(nota);
    if (!num || num < 0 || num > 100) {
      toast.error("La nota debe estar entre 0 y 100.");
      return;
    }
    setEntregas((prev) => prev.map((e) =>
      e.id === editing.id ? { ...e, estado: "calificado", nota: num, feedback } : e
    ));
    toast.success(`Calificación enviada a ${editing.alumno}.`);
    setEditing(null);
  };

  const pendientes = entregas.filter((e) => e.estado === "pendiente").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calificaciones</h1>
        <p className="text-muted-foreground">{pendientes} entregas pendientes de revisión.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar alumno, curso o tarea…" className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(["todos", "pendiente", "calificado"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
              {f}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Tarea</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.alumno}</TableCell>
                  <TableCell className="text-muted-foreground">{e.curso}</TableCell>
                  <TableCell>{e.tarea}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(e.fechaEntrega).toLocaleDateString("es-DO")}</TableCell>
                  <TableCell>
                    {e.estado === "calificado"
                      ? <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" />{e.nota}/100</Badge>
                      : <Badge variant="destructive">Pendiente</Badge>}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant={e.estado === "pendiente" ? "default" : "outline"} onClick={() => openEdit(e)}>
                      {e.estado === "pendiente" ? "Calificar" : "Ver"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Sin entregas.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Calificar: {editing?.tarea}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="text-xs text-muted-foreground">{editing.alumno} · {editing.curso}</p>
                <p className="mt-2">{editing.contenido}</p>
              </div>
              <div>
                <Label htmlFor="nota">Nota (0-100)</Label>
                <Input id="nota" type="number" min={0} max={100} value={nota} onChange={(e) => setNota(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="feedback">Retroalimentación</Label>
                <Textarea id="feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} placeholder="Comentarios para el alumno…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar calificación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
