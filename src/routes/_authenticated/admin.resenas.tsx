import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AdminPageHeader, DeleteButton, EmptyState } from "@/components/admin/AdminUI";
import { StarRating } from "@/components/reviews/StarRating";

export const Route = createFileRoute("/_authenticated/admin/resenas")({
  component: ResenasPage,
});

type Review = {
  id: string;
  programa_id: string;
  user_id: string;
  rating: number;
  comentario: string | null;
  estado: "pendiente" | "aprobado" | "rechazado";
  motivo_rechazo: string | null;
  created_at: string;
};

const ESTADOS = [
  { key: "pendiente", label: "Pendientes" },
  { key: "aprobado", label: "Aprobadas" },
  { key: "rechazado", label: "Rechazadas" },
] as const;

function ResenasPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof ESTADOS)[number]["key"]>("pendiente");
  const [rechazando, setRechazando] = useState<Review | null>(null);
  const [motivo, setMotivo] = useState("");

  const { data: reviews = [] } = useQuery({
    queryKey: ["admin", "resenas"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("program_reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Review[]) ?? [];
    },
  });

  const { data: programas = [] } = useQuery({
    queryKey: ["admin", "resenas", "programas"],
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("id,titulo");
      return data ?? [];
    },
  });
  const progMap = new Map(programas.map((p) => [p.id, p.titulo]));

  const userIds = Array.from(new Set(reviews.map((r) => r.user_id)));
  const { data: perfiles = [] } = useQuery({
    queryKey: ["admin", "resenas", "perfiles", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,nombre,apellido")
        .in("id", userIds);
      return data ?? [];
    },
  });
  const perfilMap = new Map(perfiles.map((p) => [p.id, `${p.nombre} ${p.apellido}`.trim()]));

  const counts = {
    pendiente: reviews.filter((r) => r.estado === "pendiente").length,
    aprobado: reviews.filter((r) => r.estado === "aprobado").length,
    rechazado: reviews.filter((r) => r.estado === "rechazado").length,
  };
  const rows = reviews.filter((r) => r.estado === tab);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["admin", "resenas"] });
    qc.invalidateQueries({ queryKey: ["reviews"] });
    qc.invalidateQueries({ queryKey: ["public", "programas", "ratings"] });
  };

  const cambiarEstado = async (r: Review, estado: Review["estado"], motivoRechazo?: string) => {
    const payload: Record<string, unknown> = { estado };
    if (estado === "rechazado") payload.motivo_rechazo = motivoRechazo?.trim() || null;
    const { error } = await (supabase.from as any)("program_reviews")
      .update(payload)
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(
      estado === "aprobado"
        ? "Valoración aprobada"
        : estado === "rechazado"
          ? "Valoración rechazada"
          : "Valoración devuelta a pendientes",
    );
    invalidar();
  };

  const eliminar = async (id: string) => {
    const { error } = await (supabase.from as any)("program_reviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Valoración eliminada");
    invalidar();
  };

  const usarComoTestimonio = async (r: Review) => {
    const { error } = await supabase.from("testimonials").insert({
      nombre: perfilMap.get(r.user_id) ?? "Alumno",
      contenido: r.comentario ?? "",
      calificacion: r.rating,
      programa_id: r.programa_id,
      aprobado: false,
    });
    if (error) return toast.error(error.message);
    toast.success("Creado como testimonio pendiente de publicar");
  };

  return (
    <div>
      <AdminPageHeader
        title="Valoraciones"
        description="Modera las valoraciones que dejan los alumnos en cada programa."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <Button
            key={e.key}
            size="sm"
            variant={tab === e.key ? "default" : "outline"}
            onClick={() => setTab(e.key)}
          >
            {e.label} ({counts[e.key]})
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState>No hay valoraciones en esta sección.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Programa</TableHead>
                <TableHead>Alumno</TableHead>
                <TableHead>Estrellas</TableHead>
                <TableHead>Comentario</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{progMap.get(r.programa_id) ?? "—"}</TableCell>
                  <TableCell>{perfilMap.get(r.user_id) ?? "—"}</TableCell>
                  <TableCell>
                    <StarRating value={r.rating} size={15} />
                  </TableCell>
                  <TableCell className="max-w-sm whitespace-pre-line text-sm">
                    {r.comentario || <span className="text-muted-foreground">Sin comentario</span>}
                    {r.estado === "rechazado" && r.motivo_rechazo && (
                      <p className="mt-1 text-xs text-destructive">Motivo: {r.motivo_rechazo}</p>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("es-DO")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {r.estado !== "aprobado" && (
                        <Button size="sm" onClick={() => cambiarEstado(r, "aprobado")}>
                          Aprobar
                        </Button>
                      )}
                      {r.estado !== "rechazado" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setRechazando(r); setMotivo(""); }}
                        >
                          Rechazar
                        </Button>
                      )}
                      {r.estado === "aprobado" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => cambiarEstado(r, "pendiente")}>
                            Devolver a pendiente
                          </Button>
                          {r.comentario && (
                            <Button size="sm" variant="ghost" onClick={() => usarComoTestimonio(r)}>
                              Usar como testimonio
                            </Button>
                          )}
                        </>
                      )}
                      <DeleteButton onConfirm={() => eliminar(r.id)} label="la valoración" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!rechazando} onOpenChange={(o) => !o && setRechazando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar valoración</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label>Motivo (opcional)</Label>
            <Textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="El alumno verá este motivo."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazando(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (rechazando) await cambiarEstado(rechazando, "rechazado", motivo);
                setRechazando(null);
              }}
            >
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {tab === "pendiente" && counts.pendiente > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          <Badge variant="outline">{counts.pendiente}</Badge> valoraciones esperan revisión.
        </p>
      )}
    </div>
  );
}
