import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, Plus, ExternalLink, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/solicitudes")({
  component: AdminSolicitudes,
});

const ESTADOS = ["nuevo", "contactado", "inscrito", "descartado"] as const;
type Estado = (typeof ESTADOS)[number];

const ESTADO_STYLE: Record<string, string> = {
  nuevo: "bg-blue-100 text-blue-800",
  contactado: "bg-amber-100 text-amber-800",
  inscrito: "bg-green-100 text-green-800",
  descartado: "bg-muted text-muted-foreground",
};

function AdminSolicitudes() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes de Cursos y Diplomados</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona las solicitudes recibidas y edita las opciones del formulario público.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/solicitud-curso" target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Ver formulario público
          </a>
        </Button>
      </div>

      <Tabs defaultValue="solicitudes">
        <TabsList>
          <TabsTrigger value="solicitudes">Solicitudes recibidas</TabsTrigger>
          <TabsTrigger value="opciones">Opciones del formulario</TabsTrigger>
        </TabsList>
        <TabsContent value="solicitudes" className="mt-4">
          <SolicitudesTab />
        </TabsContent>
        <TabsContent value="opciones" className="mt-4">
          <OpcionesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Solicitudes ---------------- */

type Solicitud = {
  id: string;
  nombre_completo: string;
  email: string;
  codigo_pais: string;
  telefono: string;
  tipo_documento: string;
  numero_documento: string;
  nivel_estudios: string;
  provincia: string;
  tipo_formacion: string;
  programa: string;
  estado: string;
  notas: string | null;
  created_at: string;
};

function SolicitudesTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Solicitud | null>(null);
  const [toDelete, setToDelete] = useState<Solicitud | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "course_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Solicitud[];
    },
  });

  const updateEstado = useMutation({
    mutationFn: async ({ id, estado, notas }: { id: string; estado?: string; notas?: string }) => {
      const patch: Record<string, unknown> = {};
      if (estado !== undefined) patch.estado = estado;
      if (notas !== undefined) patch.notas = notas;
      const { error } = await supabase.from("course_requests").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitud actualizada");
      qc.invalidateQueries({ queryKey: ["admin", "course_requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitud eliminada");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["admin", "course_requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (data ?? []).filter((s) => {
    if (filter !== "all" && s.estado !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.nombre_completo.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.programa.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Solicitudes ({filtered.length})</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Buscar nombre, email o programa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {ESTADOS.map((e) => (
                <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">Sin solicitudes.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{s.nombre_completo}</div>
                    <div className="text-xs text-muted-foreground">{s.provincia}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{s.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.codigo_pais} {s.telefono}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{s.programa}</div>
                    <div className="text-xs capitalize text-muted-foreground">{s.tipo_formacion}</div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={s.estado}
                      onValueChange={(v) => updateEstado.mutate({ id: s.id, estado: v })}
                    >
                      <SelectTrigger className="h-8 w-36">
                        <Badge className={ESTADO_STYLE[s.estado] ?? "bg-muted"}>
                          <span className="capitalize">{s.estado}</span>
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS.map((e) => (
                          <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setSelected(s)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setToDelete(s)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de solicitud</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <Field label="Nombre" value={selected.nombre_completo} />
              <Field label="Email" value={selected.email} />
              <Field label="Teléfono" value={`${selected.codigo_pais} ${selected.telefono}`} />
              <Field label="Documento" value={`${selected.tipo_documento.toUpperCase()}: ${selected.numero_documento}`} />
              <Field label="Nivel de estudios" value={selected.nivel_estudios} />
              <Field label="Provincia" value={selected.provincia} />
              <Field label="Programa" value={`${selected.tipo_formacion} — ${selected.programa}`} />
              <div>
                <Label>Notas internas</Label>
                <Textarea
                  defaultValue={selected.notas ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== (selected.notas ?? "")) {
                      updateEstado.mutate({ id: selected.id, notas: v });
                    }
                  }}
                  rows={4}
                  placeholder="Agrega notas de seguimiento…"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar solicitud</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && remove.mutate(toDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/* ---------------- Opciones del formulario ---------------- */

type Opcion = {
  id: string;
  tipo: "curso" | "diplomado";
  nombre: string;
  activo: boolean;
  orden: number;
};

function OpcionesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Opcion> | null>(null);
  const [toDelete, setToDelete] = useState<Opcion | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "course_request_options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_request_options")
        .select("*")
        .order("tipo", { ascending: true })
        .order("orden", { ascending: true });
      if (error) throw error;
      return data as Opcion[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (o: Partial<Opcion>) => {
      if (o.id) {
        const { error } = await supabase
          .from("course_request_options")
          .update({ tipo: o.tipo, nombre: o.nombre, activo: o.activo, orden: o.orden })
          .eq("id", o.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_request_options").insert({
          tipo: o.tipo!,
          nombre: o.nombre!,
          activo: o.activo ?? true,
          orden: o.orden ?? 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Guardado");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "course_request_options"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_request_options").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Eliminado");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["admin", "course_request_options"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = (o: Opcion) => upsert.mutate({ ...o, activo: !o.activo });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Cursos y diplomados listados en el formulario</CardTitle>
        <Button
          size="sm"
          onClick={() => setEditing({ tipo: "curso", nombre: "", activo: true, orden: 0 })}
        >
          <Plus className="mr-2 h-4 w-4" /> Nueva opción
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-24">Orden</TableHead>
                <TableHead className="w-28">Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="capitalize">{o.tipo}</TableCell>
                  <TableCell>{o.nombre}</TableCell>
                  <TableCell>{o.orden}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleActive(o)}>
                      <Badge className={o.activo ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
                        {o.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(o)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setToDelete(o)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Sin opciones. Crea la primera con el botón "Nueva opción".
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar opción" : "Nueva opción"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={editing.tipo}
                  onValueChange={(v) => setEditing({ ...editing, tipo: v as "curso" | "diplomado" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="curso">Curso</SelectItem>
                    <SelectItem value="diplomado">Diplomado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nombre</Label>
                <Input
                  value={editing.nombre ?? ""}
                  onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
                  placeholder="Ej. Diplomado en Neurociencia"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Orden</Label>
                  <Input
                    type="number"
                    value={editing.orden ?? 0}
                    onChange={(e) => setEditing({ ...editing, orden: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Select
                    value={editing.activo === false ? "no" : "si"}
                    onValueChange={(v) => setEditing({ ...editing, activo: v === "si" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="si">Activo</SelectItem>
                      <SelectItem value="no">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => editing && upsert.mutate(editing)}
              disabled={!editing?.nombre || !editing?.tipo || upsert.isPending}
            >
              {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar opción</AlertDialogTitle>
            <AlertDialogDescription>
              La opción desaparecerá del formulario público. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && remove.mutate(toDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
