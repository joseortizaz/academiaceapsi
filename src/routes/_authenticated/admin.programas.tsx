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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AdminPageHeader,
  CreateButton,
  EditButton,
  DeleteButton,
  FormDialog,
  EmptyState,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/programas")({
  component: ProgramasPage,
});

type Programa = {
  id?: string;
  titulo: string;
  slug: string;
  descripcion: string;
  resumen: string;
  tipo: string;
  modalidad: string;
  categoria_id: string | null;
  docente_id: string | null;
  precio: number;
  precio_descuento: number | null;
  duracion_horas: number | null;
  duracion_semanas: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  horario: string;
  max_estudiantes: number | null;
  imagen_url: string;
  syllabus_url: string;
  estado: string;
  destacado: boolean;
  certificado_incluido: boolean;
};

const empty: Programa = {
  titulo: "",
  slug: "",
  descripcion: "",
  resumen: "",
  tipo: "curso",
  modalidad: "asincrono",
  categoria_id: null,
  docente_id: null,
  precio: 0,
  precio_descuento: null,
  duracion_horas: null,
  duracion_semanas: null,
  fecha_inicio: null,
  fecha_fin: null,
  horario: "",
  max_estudiantes: null,
  imagen_url: "",
  syllabus_url: "",
  estado: "borrador",
  destacado: false,
  certificado_incluido: true,
};

const estadoColor: Record<string, string> = {
  borrador: "bg-muted text-foreground",
  publicado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  en_curso: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  finalizado: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  archivado: "bg-orange-100 text-orange-800",
};

function ProgramasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Programa>(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "programas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["admin", "categorias", "lookup"],
    queryFn: async () => (await supabase.from("categories").select("id,nombre")).data ?? [],
  });

  const { data: docentes = [] } = useQuery({
    queryKey: ["admin", "docentes", "lookup"],
    queryFn: async () => (await supabase.from("teachers").select("id,nombre,apellido")).data ?? [],
  });

  const save = async (v: Programa) => {
    const payload = {
      ...v,
      precio: Number(v.precio) || 0,
      precio_descuento: v.precio_descuento ? Number(v.precio_descuento) : null,
      duracion_horas: v.duracion_horas ? Number(v.duracion_horas) : null,
      duracion_semanas: v.duracion_semanas ? Number(v.duracion_semanas) : null,
      max_estudiantes: v.max_estudiantes ? Number(v.max_estudiantes) : null,
      fecha_inicio: v.fecha_inicio || null,
      fecha_fin: v.fecha_fin || null,
      categoria_id: v.categoria_id || null,
      docente_id: v.docente_id || null,
    };
    const { error } = v.id
      ? await supabase.from("programs").update(payload).eq("id", v.id)
      : await supabase.from("programs").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Programa guardado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin", "programas"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("programs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Programa eliminado");
    qc.invalidateQueries({ queryKey: ["admin", "programas"] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Programas"
        description="Diplomados y cursos disponibles en la plataforma."
        action={
          <CreateButton
            label="Nuevo programa"
            onClick={() => {
              setEditing(empty);
              setOpen(true);
            }}
          />
        }
      />

      {rows.length === 0 ? (
        <EmptyState>Aún no has creado ningún programa.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Modalidad</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.titulo}</TableCell>
                  <TableCell className="capitalize">{r.tipo}</TableCell>
                  <TableCell className="capitalize">{r.modalidad}</TableCell>
                  <TableCell>RD$ {Number(r.precio).toLocaleString("es-DO")}</TableCell>
                  <TableCell>
                    <Badge className={estadoColor[r.estado] ?? ""} variant="outline">
                      {r.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <EditButton
                      onClick={() => {
                        setEditing({ ...(r as Programa) });
                        setOpen(true);
                      }}
                    />
                    <DeleteButton onConfirm={() => remove(r.id!)} label="el programa" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormDialog<Programa>
        title={editing.id ? "Editar programa" : "Nuevo programa"}
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSubmit={save}
      >
        {(s, set) => (
          <>
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={s.titulo} onChange={(e) => set({ titulo: e.target.value })} required />
            </div>
            <div className="grid gap-2">
              <Label>Slug</Label>
              <Input
                value={s.slug}
                onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Resumen</Label>
              <Input value={s.resumen ?? ""} onChange={(e) => set({ resumen: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea
                rows={4}
                value={s.descripcion}
                onChange={(e) => set({ descripcion: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={s.tipo} onValueChange={(v) => set({ tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diplomado">Diplomado</SelectItem>
                    <SelectItem value="curso">Curso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Modalidad</Label>
                <Select value={s.modalidad} onValueChange={(v) => set({ modalidad: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sincrono">Sincrónico (en vivo)</SelectItem>
                    <SelectItem value="asincrono">Asincrónico</SelectItem>
                    <SelectItem value="mixto">Mixto (híbrido)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Categoría</Label>
                <Select
                  value={s.categoria_id ?? "none"}
                  onValueChange={(v) => set({ categoria_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {categorias.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Docente principal</Label>
                <Select
                  value={s.docente_id ?? "none"}
                  onValueChange={(v) => set({ docente_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {docentes.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>{d.nombre} {d.apellido}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Precio (DOP)</Label>
                <Input type="number" value={s.precio} onChange={(e) => set({ precio: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>Precio con descuento</Label>
                <Input
                  type="number"
                  value={s.precio_descuento ?? ""}
                  onChange={(e) => set({ precio_descuento: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Duración (horas)</Label>
                <Input
                  type="number"
                  value={s.duracion_horas ?? ""}
                  onChange={(e) => set({ duracion_horas: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Duración (semanas)</Label>
                <Input
                  type="number"
                  value={s.duracion_semanas ?? ""}
                  onChange={(e) => set({ duracion_semanas: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Fecha de inicio</Label>
                <Input type="date" value={s.fecha_inicio ?? ""} onChange={(e) => set({ fecha_inicio: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Fecha de fin</Label>
                <Input type="date" value={s.fecha_fin ?? ""} onChange={(e) => set({ fecha_fin: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Horario</Label>
              <Input
                value={s.horario ?? ""}
                placeholder="Ej: Lunes y miércoles, 7:00 - 9:00 PM"
                onChange={(e) => set({ horario: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Cupo máximo</Label>
                <Input
                  type="number"
                  value={s.max_estudiantes ?? ""}
                  onChange={(e) => set({ max_estudiantes: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Estado</Label>
                <Select value={s.estado} onValueChange={(v) => set({ estado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="borrador">Borrador</SelectItem>
                    <SelectItem value="publicado">Publicado</SelectItem>
                    <SelectItem value="en_curso">En curso</SelectItem>
                    <SelectItem value="finalizado">Finalizado</SelectItem>
                    <SelectItem value="archivado">Archivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>URL de imagen</Label>
              <Input value={s.imagen_url ?? ""} onChange={(e) => set({ imagen_url: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>URL del syllabus (PDF)</Label>
              <Input value={s.syllabus_url ?? ""} onChange={(e) => set({ syllabus_url: e.target.value })} />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <Switch checked={s.destacado} onCheckedChange={(c) => set({ destacado: c })} />
                <span className="text-sm">Destacado</span>
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={s.certificado_incluido}
                  onCheckedChange={(c) => set({ certificado_incluido: c })}
                />
                <span className="text-sm">Incluye certificado</span>
              </label>
            </div>
          </>
        )}
      </FormDialog>
    </div>
  );
}
