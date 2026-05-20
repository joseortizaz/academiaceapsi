import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader, EmptyState } from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/inscripciones")({
  component: InscripcionesPage,
});

const estados = ["pendiente", "activo", "completado", "cancelado", "suspendido"];

function InscripcionesPage() {
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "inscripciones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .order("fecha_inscripcion", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: programas = [] } = useQuery({
    queryKey: ["admin", "programas", "lookup"],
    queryFn: async () => (await supabase.from("programs").select("id,titulo")).data ?? [],
  });

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: perfiles = [] } = useQuery({
    queryKey: ["admin", "perfiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () =>
      (await supabase.from("profiles").select("id,nombre,apellido").in("id", userIds)).data ?? [],
  });

  const pMap = new Map(programas.map((p: any) => [p.id, p.titulo]));
  const uMap = new Map(perfiles.map((p: any) => [p.id, `${p.nombre} ${p.apellido}`]));

  const updateEstado = async (id: string, estado: string) => {
    const { error } = await supabase.from("enrollments").update({ estado }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Estado actualizado");
    qc.invalidateQueries({ queryKey: ["admin", "inscripciones"] });
  };

  return (
    <div>
      <AdminPageHeader title="Inscripciones" description="Estudiantes matriculados por programa." />
      {rows.length === 0 ? (
        <EmptyState>Aún no hay inscripciones.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estudiante</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead>Inscrito</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{uMap.get(r.user_id) ?? r.user_id.slice(0, 8)}</TableCell>
                  <TableCell>{pMap.get(r.programa_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.fecha_inscripcion).toLocaleDateString("es-DO")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.progreso_porcentaje}%</Badge>
                  </TableCell>
                  <TableCell>
                    <Select value={r.estado} onValueChange={(v) => updateEstado(r.id, v)}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {estados.map((e) => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
