import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AdminPageHeader, CreateButton, DeleteButton, EmptyState, FormDialog,
} from "@/components/admin/AdminUI";
import { CreditCard, TrendingUp, Users, Ticket } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finanzas")({
  component: FinanzasPage,
});

type Coupon = {
  id?: string;
  codigo: string;
  descripcion: string;
  porcentaje_descuento: number;
  fecha_expiracion: string | null;
  usos_maximos: number | null;
  activo: boolean;
};
const emptyCoupon: Coupon = {
  codigo: "",
  descripcion: "",
  porcentaje_descuento: 10,
  fecha_expiracion: null,
  usos_maximos: null,
  activo: true,
};

const estadoBadge: Record<string, string> = {
  completado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  aprobado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  pendiente: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  rechazado: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  reembolsado: "bg-zinc-200 text-zinc-700",
};

function FinanzasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon>(emptyCoupon);

  const { data: pagos = [] } = useQuery({
    queryKey: ["admin", "pagos", "all"],
    queryFn: async () =>
      (await supabase.from("payments").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["admin", "enrollments", "all"],
    queryFn: async () =>
      (await supabase.from("enrollments").select("id,estado").eq("estado", "activo")).data ?? [],
  });

  const { data: programas = [] } = useQuery({
    queryKey: ["admin", "programas", "lookup"],
    queryFn: async () => (await supabase.from("programs").select("id,titulo")).data ?? [],
  });

  const userIds = [...new Set(pagos.map((p) => p.user_id))];
  const { data: perfiles = [] } = useQuery({
    queryKey: ["admin", "perfiles", userIds.length],
    enabled: userIds.length > 0,
    queryFn: async () =>
      (await supabase.from("profiles").select("id,nombre,apellido").in("id", userIds)).data ?? [],
  });

  const { data: cupones = [] } = useQuery({
    queryKey: ["admin", "cupones"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pMap = new Map(programas.map((p: any) => [p.id, p.titulo]));
  const uMap = new Map(perfiles.map((p: any) => [p.id, `${p.nombre} ${p.apellido}`]));

  const completados = pagos.filter((p) => p.estado === "completado" || p.estado === "aprobado");
  const ingresosTotales = completados.reduce((s, p) => s + Number(p.monto ?? 0), 0);
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const ventasMes = completados.filter((p) => new Date(p.fecha_pago ?? p.created_at).getTime() >= inicioMes).length;
  const ingresoMes = completados
    .filter((p) => new Date(p.fecha_pago ?? p.created_at).getTime() >= inicioMes)
    .reduce((s, p) => s + Number(p.monto ?? 0), 0);

  const saveCoupon = async (v: Coupon) => {
    const payload = {
      ...v,
      porcentaje_descuento: Number(v.porcentaje_descuento) || 0,
      usos_maximos: v.usos_maximos ? Number(v.usos_maximos) : null,
      fecha_expiracion: v.fecha_expiracion || null,
      codigo: v.codigo.trim().toUpperCase(),
    };
    const { error } = v.id
      ? await (supabase as any).from("coupons").update(payload).eq("id", v.id)
      : await (supabase as any).from("coupons").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Cupón guardado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin", "cupones"] });
  };

  const removeCoupon = async (id: string) => {
    const { error } = await (supabase as any).from("coupons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cupón eliminado");
    qc.invalidateQueries({ queryKey: ["admin", "cupones"] });
  };

  const kpis = [
    { label: "Ingresos totales", value: `RD$ ${ingresosTotales.toLocaleString("es-DO")}`, icon: CreditCard },
    { label: "Ingresos del mes", value: `RD$ ${ingresoMes.toLocaleString("es-DO")}`, icon: TrendingUp },
    { label: "Ventas del mes", value: ventasMes, icon: Ticket },
    { label: "Suscripciones activas", value: enrollments.length, icon: Users },
  ];

  return (
    <div className="space-y-8">
      <AdminPageHeader title="Finanzas" description="Ingresos, transacciones y cupones de descuento." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{k.label}</p>
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-bold">{k.value}</p>
            </div>
          );
        })}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Historial de transacciones</h2>
          <span className="text-sm text-muted-foreground">{pagos.length} registros</span>
        </div>
        {pagos.length === 0 ? (
          <EmptyState>Aún no hay transacciones registradas.</EmptyState>
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-lg border bg-card">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell>{uMap.get(r.user_id) ?? r.user_id.slice(0, 8)}</TableCell>
                    <TableCell>{pMap.get(r.programa_id) ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      {r.moneda} {Number(r.monto).toLocaleString("es-DO")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("es-DO")}
                    </TableCell>
                    <TableCell>
                      <Badge className={estadoBadge[r.estado] ?? ""} variant="outline">
                        {r.estado}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cupones de descuento</h2>
          <CreateButton
            label="Nuevo cupón"
            onClick={() => {
              setEditing(emptyCoupon);
              setOpen(true);
            }}
          />
        </div>
        {cupones.length === 0 ? (
          <EmptyState>Aún no hay cupones creados.</EmptyState>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descuento</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cupones.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-semibold">{c.codigo}</TableCell>
                    <TableCell>{c.porcentaje_descuento}%</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.fecha_expiracion
                        ? new Date(c.fecha_expiracion).toLocaleDateString("es-DO")
                        : "Sin vencimiento"}
                    </TableCell>
                    <TableCell>
                      {c.usos_actuales}
                      {c.usos_maximos ? ` / ${c.usos_maximos}` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          c.activo
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
                        }
                        variant="outline"
                      >
                        {c.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteButton onConfirm={() => removeCoupon(c.id)} label="el cupón" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <FormDialog<Coupon>
        title={editing.id ? "Editar cupón" : "Nuevo cupón"}
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSubmit={saveCoupon}
      >
        {(s, set) => (
          <>
            <div className="grid gap-2">
              <Label>Código</Label>
              <Input
                value={s.codigo}
                onChange={(e) => set({ codigo: e.target.value.toUpperCase() })}
                placeholder="VERANO2026"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Input value={s.descripcion ?? ""} onChange={(e) => set({ descripcion: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>% de descuento</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={s.porcentaje_descuento}
                  onChange={(e) => set({ porcentaje_descuento: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Usos máximos</Label>
                <Input
                  type="number"
                  value={s.usos_maximos ?? ""}
                  placeholder="Ilimitado"
                  onChange={(e) => set({ usos_maximos: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Fecha de expiración</Label>
              <Input
                type="date"
                value={s.fecha_expiracion ?? ""}
                onChange={(e) => set({ fecha_expiracion: e.target.value || null })}
              />
            </div>
            <label className="flex items-center gap-2">
              <Switch checked={s.activo} onCheckedChange={(c) => set({ activo: c })} />
              <span className="text-sm">Cupón activo</span>
            </label>
          </>
        )}
      </FormDialog>
    </div>
  );
}
