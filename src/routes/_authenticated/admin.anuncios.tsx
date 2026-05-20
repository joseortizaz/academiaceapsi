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
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import {
  AdminPageHeader, CreateButton, EditButton, DeleteButton, FormDialog, EmptyState,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/anuncios")({
  component: AnunciosPage,
});

type Anuncio = {
  id?: string;
  titulo: string;
  contenido: string;
  tipo: string;
  programa_id: string | null;
  autor_id: string;
  fecha_expiracion: string | null;
  activo: boolean;
};

const empty = (autor_id: string): Anuncio => ({
  titulo: "", contenido: "", tipo: "general", programa_id: null, autor_id,
  fecha_expiracion: null, activo: true,
});

function AnunciosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Anuncio>(empty(""));

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "anuncios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("fecha_publicacion", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: programas = [] } = useQuery({
    queryKey: ["admin", "programas", "lookup"],
    queryFn: async () => (await supabase.from("programs").select("id,titulo")).data ?? [],
  });

  const save = async (v: Anuncio) => {
    if (!v.autor_id && !user?.id) return toast.error("Sesión no encontrada");
    const payload = {
      ...v,
      autor_id: v.autor_id || user!.id,
      programa_id: v.programa_id || null,
      fecha_expiracion: v.fecha_expiracion || null,
    };
    const { error } = v.id
      ? await supabase.from("announcements").update(payload).eq("id", v.id)
      : await supabase.from("announcements").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Anuncio guardado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin", "anuncios"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Anuncio eliminado");
    qc.invalidateQueries({ queryKey: ["admin", "anuncios"] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Anuncios"
        description="Comunicados visibles en la plataforma."
        action={
          <CreateButton
            label="Nuevo anuncio"
            onClick={() => { setEditing(empty(user?.id ?? "")); setOpen(true); }}
          />
        }
      />

      {rows.length === 0 ? (
        <EmptyState>No hay anuncios publicados.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.titulo}</TableCell>
                  <TableCell><Badge variant="outline">{r.tipo}</Badge></TableCell>
                  <TableCell>{r.activo ? "Sí" : "No"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.fecha_expiracion ? new Date(r.fecha_expiracion).toLocaleDateString("es-DO") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <EditButton onClick={() => { setEditing({ ...(r as Anuncio) }); setOpen(true); }} />
                    <DeleteButton onConfirm={() => remove(r.id!)} label="el anuncio" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormDialog<Anuncio>
        title={editing.id ? "Editar anuncio" : "Nuevo anuncio"}
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
              <Label>Contenido</Label>
              <Textarea rows={4} value={s.contenido} onChange={(e) => set({ contenido: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={s.tipo} onValueChange={(v) => set({ tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="programa">Programa específico</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Programa (opcional)</Label>
                <Select
                  value={s.programa_id ?? "none"}
                  onValueChange={(v) => set({ programa_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todos los usuarios</SelectItem>
                    {programas.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Fecha de expiración</Label>
              <Input
                type="datetime-local"
                value={s.fecha_expiracion ? s.fecha_expiracion.substring(0, 16) : ""}
                onChange={(e) => set({
                  fecha_expiracion: e.target.value ? new Date(e.target.value).toISOString() : null,
                })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={s.activo} onCheckedChange={(c) => set({ activo: c })} />
              <span className="text-sm">Anuncio activo</span>
            </div>
          </>
        )}
      </FormDialog>
    </div>
  );
}
