import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Link2, CheckCircle2, AlertCircle, Search, FileText, ExternalLink } from "lucide-react";
import {
  getBaConnectionStatus,
  adminSearchCustomers,
  adminLinkCustomer,
  adminSyncUser,
} from "@/lib/balance-activo.functions";

export const Route = createFileRoute("/_authenticated/admin/facturacion")({
  component: AdminFacturacion,
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

function AdminFacturacion() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getBaConnectionStatus);
  const searchFn = useServerFn(adminSearchCustomers);
  const linkFn = useServerFn(adminLinkCustomer);
  const syncFn = useServerFn(adminSyncUser);

  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [invFilter, setInvFilter] = useState("");
  const [payFilter, setPayFilter] = useState("");

  const { data: status, isFetching, refetch } = useQuery({
    queryKey: ["ba-status"],
    queryFn: () => statusFn(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-ba"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nombre, apellido, balance_activo_customer_id")
        .order("nombre");
      return data ?? [];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["admin", "external_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_invoices")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["admin", "external_payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_payments")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p: any) => m.set(p.id, `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim() || p.id.slice(0, 8)));
    return m;
  }, [profiles]);

  const filteredInvoices = useMemo(() => {
    const q = invFilter.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((i: any) => {
      const alumno = i.user_id ? profileMap.get(i.user_id) ?? "" : "";
      return [i.numero, i.ncf, i.concepto, i.estado, alumno].some((v) =>
        String(v ?? "").toLowerCase().includes(q),
      );
    });
  }, [invoices, invFilter, profileMap]);

  const filteredPayments = useMemo(() => {
    const q = payFilter.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p: any) => {
      const alumno = p.user_id ? profileMap.get(p.user_id) ?? "" : "";
      return [p.invoice_external_id, p.metodo, p.nota, alumno].some((v) =>
        String(v ?? "").toLowerCase().includes(q),
      );
    });
  }, [payments, payFilter, profileMap]);

  const { data: logs = [] } = useQuery({
    queryKey: ["ba-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("balance_activo_webhook_logs")
        .select("id,event,signature_valid,processed,error,created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    try {
      const results = await searchFn({ data: { search: searchTerm } });
      setCandidates(results);
      if (results.length === 0) toast.info("Sin coincidencias en Balance Activo");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleLink = async (customerId: string) => {
    if (!selectedUser) return toast.error("Selecciona un alumno");
    try {
      await linkFn({ data: { userId: selectedUser, customerId } });
      toast.success("Alumno vinculado");
      qc.invalidateQueries({ queryKey: ["profiles-ba"] });
      setCandidates([]);
      setSearchTerm("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleSync = async (userId: string) => {
    try {
      const r = await syncFn({ data: { userId } });
      toast.success(`Sincronizado: ${r.invoices} facturas, ${r.payments} cobros`);
      qc.invalidateQueries({ queryKey: ["admin", "external_invoices"] });
      qc.invalidateQueries({ queryKey: ["admin", "external_payments"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const totalFacturado = invoices.reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);
  const totalPendiente = invoices.reduce((s: number, i: any) => s + Number(i.saldo ?? 0), 0);
  const totalCobrado = payments.reduce((s: number, p: any) => s + Number(p.monto ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Facturación (Balance Activo)</h1>
        <p className="text-muted-foreground">
          Vincula alumnos con clientes contables y consulta facturas y cobros sincronizados.
        </p>
      </div>

      <Tabs defaultValue="conexion" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conexion">Conexión & vínculos</TabsTrigger>
          <TabsTrigger value="facturas">Facturas ({invoices.length})</TabsTrigger>
          <TabsTrigger value="pagos">Pagos ({payments.length})</TabsTrigger>
          <TabsTrigger value="logs">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="conexion" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Conexión con Balance Activo</CardTitle>
                  <CardDescription>API key y webhook secret.</CardDescription>
                </div>
                {status?.connected ? (
                  <Badge className="gap-1 bg-emerald-500/15 text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-700">
                    <AlertCircle className="h-3 w-3" /> Sin conectar
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {status?.connected ? (
                <p className="text-sm">
                  <span className="font-semibold">Tenant:</span> {status.tenant?.razon_social}{" "}
                  <span className="text-muted-foreground">(RNC {status.tenant?.rnc ?? "—"})</span>
                </p>
              ) : (
                <p className="text-sm text-amber-700">{status?.error ?? "Configura los secretos BALANCE_ACTIVO_*"}</p>
              )}
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Probar
              </Button>
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <p className="font-medium">Webhook URL (regístrala en Balance Activo → API & Webhooks):</p>
                <code className="mt-1 block break-all">
                  https://ceapsird.lovable.app/api/public/balance-activo-webhook
                </code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vincular alumno con cliente</CardTitle>
              <CardDescription>1) Selecciona un alumno · 2) busca su cliente en BA · 3) vincular.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Alumno</label>
                  <select
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={selectedUser ?? ""}
                    onChange={(e) => setSelectedUser(e.target.value || null)}
                  >
                    <option value="">— Elegir alumno —</option>
                    {profiles.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} {p.apellido} {p.balance_activo_customer_id ? "✓" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Buscar cliente en Balance Activo</label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      placeholder="Nombre, email o documento"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                    <Button variant="outline" onClick={handleSearch}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              {candidates.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidates.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.nombre}</TableCell>
                          <TableCell>{c.email ?? "—"}</TableCell>
                          <TableCell>{c.documento ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => handleLink(c.id)}>
                              <Link2 className="mr-2 h-3 w-3" /> Vincular
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {selectedUser && (
                <Button variant="outline" size="sm" onClick={() => handleSync(selectedUser)}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar facturas de este alumno
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="facturas" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard label="Total facturado" value={fmtMoney(totalFacturado, "DOP")} />
            <StatCard label="Saldo pendiente" value={fmtMoney(totalPendiente, "DOP")} accent="amber" />
            <StatCard label="Facturas" value={String(invoices.length)} />
          </div>
          <div className="flex items-center gap-2">
            <Input
              className="max-w-sm"
              placeholder="Buscar por alumno, número, NCF, concepto…"
              value={invFilter}
              onChange={(e) => setInvFilter(e.target.value)}
            />
          </div>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Número / NCF</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No hay facturas sincronizadas.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell className="text-muted-foreground">
                        {i.fecha ? new Date(i.fecha).toLocaleDateString("es-DO") : "—"}
                      </TableCell>
                      <TableCell>
                        {i.user_id ? profileMap.get(i.user_id) ?? i.user_id.slice(0, 8) : (
                          <span className="text-muted-foreground italic">Sin vincular</span>
                        )}
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
          </div>
        </TabsContent>

        <TabsContent value="pagos" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <StatCard label="Total cobrado" value={fmtMoney(totalCobrado, "DOP")} accent="emerald" />
            <StatCard label="Cobros registrados" value={String(payments.length)} />
          </div>
          <Input
            className="max-w-sm"
            placeholder="Buscar por alumno, factura, método…"
            value={payFilter}
            onChange={(e) => setPayFilter(e.target.value)}
          />
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Nota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No hay cobros sincronizados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground">
                        {p.fecha ? new Date(p.fecha).toLocaleDateString("es-DO") : "—"}
                      </TableCell>
                      <TableCell>
                        {p.user_id ? profileMap.get(p.user_id) ?? p.user_id.slice(0, 8) : (
                          <span className="text-muted-foreground italic">Sin vincular</span>
                        )}
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
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Logs de webhook</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Procesado</TableHead>
                    <TableHead className="w-44">Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        Sin eventos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell><Badge variant="outline">{l.event}</Badge></TableCell>
                        <TableCell>
                          {l.signature_valid
                            ? <Badge className="bg-emerald-500/15 text-emerald-700">Válida</Badge>
                            : <Badge className="bg-red-500/15 text-red-700">Inválida</Badge>}
                        </TableCell>
                        <TableCell>
                          {l.error
                            ? <span className="text-xs text-red-700">{l.error}</span>
                            : l.processed
                              ? <Badge className="bg-emerald-500/15 text-emerald-700">Sí</Badge>
                              : <Badge variant="outline">Pendiente</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(l.created_at).toLocaleString("es-DO")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "amber" }) {
  const color =
    accent === "emerald" ? "text-emerald-700" : accent === "amber" ? "text-amber-700" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
