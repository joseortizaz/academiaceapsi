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

export const Route = createFileRoute("/_authenticated/admin/pagos")({
  component: PagosPage,
});

const estados = ["pendiente", "completado", "rechazado", "reembolsado"];

function PagosPage() {
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "pagos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });
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
    const payload: any = { estado };
    if (estado === "completado") payload.fecha_pago = new Date().toISOString();
    const { error } = await supabase.from("payments").update(payload).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pago actualizado");
    qc.invalidateQueries({ queryKey: ["admin", "pagos"] });
  };

  const total = rows
    .filter((r) => r.estado === "completado")
    .reduce((s, r) => s + Number(r.monto ?? 0), 0);

  return (
    <div>
      <AdminPageHeader
        title="Pagos"
        description={`Ingresos confirmados: RD$ ${total.toLocaleString("es-DO")}`}
      />
      {rows.length === 0 ? (
        <EmptyState>Aún no se registran pagos.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Estudiante</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("es-DO")}
                  </TableCell>
                  <TableCell>{uMap.get(r.user_id) ?? r.user_id.slice(0, 8)}</TableCell>
                  <TableCell>{pMap.get(r.programa_id) ?? "—"}</TableCell>
                  <TableCell className="font-medium">
                    {r.moneda} {Number(r.monto).toLocaleString("es-DO")}
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.metodo}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{r.referencia ?? "—"}</TableCell>
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
