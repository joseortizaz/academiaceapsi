import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, FileText, Receipt, Wallet, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { listMyInvoices, syncMyInvoices } from "@/lib/balance-activo.functions";

export const Route = createFileRoute("/_authenticated/estudiante/facturacion")({
  component: EstudianteFacturacion,
});

function fmtMoney(v: number | null | undefined, moneda?: string | null) {
  const n = Number(v ?? 0);
  return `${moneda ?? "DOP"} ${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function estadoBadge(estado: string) {
  const map: Record<string, string> = {
    pagada: "bg-emerald-500/15 text-emerald-700",
    paid: "bg-emerald-500/15 text-emerald-700",
    pendiente: "bg-amber-500/15 text-amber-700",
    vencida: "bg-red-500/15 text-red-700",
    anulada: "bg-muted text-muted-foreground",
  };
  return <Badge className={map[estado] ?? "bg-muted text-muted-foreground"}>{estado}</Badge>;
}

function EstudianteFacturacion() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyInvoices);
  const syncFn = useServerFn(syncMyInvoices);

  const { data, isLoading } = useQuery({
    queryKey: ["mis-facturas"],
    queryFn: () => listFn(),
  });

  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (r: any) => {
      if (!r.linked) {
        toast.info("Aún no tienes cuenta vinculada con nuestro sistema contable. Contacta a administración.");
      } else {
        toast.success(`Actualizado: ${r.synced} facturas`);
        qc.invalidateQueries({ queryKey: ["mis-facturas"] });
      }
    },
    onError: (e: any) => toast.error(e.message ?? "Error al sincronizar"),
  });

  const invoices = data?.invoices ?? [];
  const payments = data?.payments ?? [];
  const totalPendiente = invoices.reduce((s: number, i: any) => s + Number(i.saldo ?? 0), 0);
  const totalFacturado = invoices.reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);
  const totalPagado = payments.reduce((s: number, p: any) => s + Number(p.monto ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mi estado de cuenta</h1>
          <p className="text-muted-foreground">Facturas y pagos registrados en el sistema contable.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard icon={Receipt} label="Total facturado" value={fmtMoney(totalFacturado, "DOP")} />
        <SummaryCard
          icon={AlertCircle}
          label="Saldo pendiente"
          value={fmtMoney(totalPendiente, "DOP")}
          accent={totalPendiente > 0 ? "amber" : "emerald"}
        />
        <SummaryCard icon={Wallet} label="Total pagado" value={fmtMoney(totalPagado, "DOP")} accent="emerald" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Facturas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Cargando…</TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Aún no tienes facturas registradas. Si crees que es un error, pulsa Actualizar o contacta a administración.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-muted-foreground">
                      {i.fecha ? new Date(i.fecha).toLocaleDateString("es-DO") : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div>{i.numero ?? "—"}</div>
                      {i.ncf && <div className="text-muted-foreground">{i.ncf}</div>}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{i.concepto ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(i.total, i.moneda)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(i.saldo, i.moneda)}</TableCell>
                    <TableCell>{estadoBadge(i.estado)}</TableCell>
                    <TableCell>
                      {i.pdf_url && (
                        <a href={i.pdf_url} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos aplicados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Nota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Sin pagos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">
                      {p.fecha ? new Date(p.fecha).toLocaleDateString("es-DO") : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.invoice_external_id}</TableCell>
                    <TableCell><Badge variant="outline">{p.metodo ?? "—"}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(p.monto, p.moneda)}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{p.nota ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: "emerald" | "amber";
}) {
  const color =
    accent === "emerald" ? "text-emerald-700" : accent === "amber" ? "text-amber-700" : "text-foreground";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-muted p-2">
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={`text-xl font-bold ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
