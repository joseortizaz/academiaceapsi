import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Link2, CheckCircle2, AlertCircle, Search } from "lucide-react";
import {
  getBaConnectionStatus,
  adminSearchCustomers,
  adminLinkCustomer,
  adminSyncUser,
} from "@/lib/balance-activo.functions";

export const Route = createFileRoute("/_authenticated/admin/facturacion")({
  component: AdminFacturacion,
});

function AdminFacturacion() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getBaConnectionStatus);
  const searchFn = useServerFn(adminSearchCustomers);
  const linkFn = useServerFn(adminLinkCustomer);
  const syncFn = useServerFn(adminSyncUser);

  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [candidates, setCandidates] = useState<any[]>([]);

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
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Facturación (Balance Activo)</h1>
        <p className="text-muted-foreground">Vincula alumnos con clientes contables y sincroniza sus facturas.</p>
      </div>

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
            <p className="mt-2 text-muted-foreground">
              Eventos: <code>factura.created</code>, <code>factura.updated</code>, <code>factura.paid</code>,{" "}
              <code>cobro.created</code>.
            </p>
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
    </div>
  );
}
