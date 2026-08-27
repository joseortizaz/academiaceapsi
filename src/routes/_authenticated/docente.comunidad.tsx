import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTeacherPrograms } from "@/hooks/use-teacher-programs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Send, Pencil, Trash2, Plus, Megaphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/docente/comunidad")({
  component: DocenteComunidad,
});

type Post = {
  id: string;
  programa_id: string;
  autor_id: string;
  titulo: string;
  contenido: string;
  imagen_url: string | null;
  created_at: string;
  updated_at: string;
};

function DocenteComunidad() {
  const { user } = useAuth();
  const qc = useQueryClient();

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
    queryKey: ["docente-comunidad-programas", programaIds],
    enabled: programaIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("id,titulo,slug").in("id", programaIds);
      return data ?? [];
    },
  });

  const [programaId, setProgramaId] = useState<string>("");
  const activeProgramaId = programaId || programas[0]?.id || "";

  const { data: posts = [], refetch } = useQuery({
    queryKey: ["docente-comunidad-posts", activeProgramaId],
    enabled: !!activeProgramaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("community_posts")
        .select("*")
        .eq("programa_id", activeProgramaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Post[];
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const startCreate = () => {
    setEditing(null);
    setTitulo(""); setContenido(""); setImagenUrl("");
    setOpen(true);
  };
  const startEdit = (p: Post) => {
    setEditing(p);
    setTitulo(p.titulo); setContenido(p.contenido); setImagenUrl(p.imagen_url ?? "");
    setOpen(true);
  };

  const save = async () => {
    if (!activeProgramaId) { toast.error("Selecciona un curso."); return; }
    if (!titulo.trim() || !contenido.trim()) { toast.error("Título y contenido son obligatorios."); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await (supabase as any)
          .from("community_posts")
          .update({ titulo: titulo.trim(), contenido: contenido.trim(), imagen_url: imagenUrl || null })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Publicación actualizada.");
      } else {
        const { error } = await (supabase as any)
          .from("community_posts")
          .insert({
            programa_id: activeProgramaId,
            autor_id: user!.id,
            titulo: titulo.trim(),
            contenido: contenido.trim(),
            imagen_url: imagenUrl || null,
          });
        if (error) throw error;
        toast.success("Publicación enviada. Los alumnos recibirán una notificación.");
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["docente-comunidad-posts", activeProgramaId] });
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta publicación?")) return;
    const { error } = await (supabase as any).from("community_posts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Publicación eliminada.");
    qc.invalidateQueries({ queryKey: ["docente-comunidad-posts", activeProgramaId] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comunidad</h1>
          <p className="text-muted-foreground">Comparte anuncios y mensajes con tus alumnos por curso.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={activeProgramaId} onValueChange={setProgramaId}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Selecciona un curso" />
            </SelectTrigger>
            <SelectContent>
              {programas.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={startCreate} disabled={!activeProgramaId}>
            <Plus className="mr-1 h-4 w-4" /> Crear publicación
          </Button>
        </div>
      </div>

      {programas.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          Aún no tienes cursos asignados.
        </CardContent></Card>
      )}

      <div className="grid gap-3">
        {posts.length === 0 && activeProgramaId && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            <Megaphone className="mx-auto mb-2 h-8 w-8 opacity-50" />
            Aún no has publicado nada en este curso. Crea tu primer anuncio.
          </CardContent></Card>
        )}
        {posts.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">{p.titulo}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleString()}
                  {p.updated_at !== p.created_at && " · editado"}
                </p>
              </div>
              {p.autor_id === user?.id && (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(p)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(p.id)} title="Eliminar">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-wrap text-sm">{p.contenido}</p>
              {p.imagen_url && (
                <img src={p.imagen_url} alt="" className="max-h-96 w-full rounded-md border object-contain" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar publicación" : "Nueva publicación"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Recordatorio de la sesión del viernes" />
            </div>
            <div>
              <Label>Contenido</Label>
              <Textarea
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                rows={6}
                placeholder="Escribe el mensaje para tus alumnos…"
              />
            </div>
            <div>
              <Label>Imagen (opcional)</Label>
              <ImageUploader bucket="course-images" folder="community" value={imagenUrl} onChange={setImagenUrl} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              <Send className="mr-1 h-4 w-4" /> {editing ? "Guardar cambios" : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
