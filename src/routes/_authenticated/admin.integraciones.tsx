import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Video, CheckCircle2, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getZoomConnectionStatus } from "@/lib/zoom.functions";

export const Route = createFileRoute("/_authenticated/admin/integraciones")({
  component: AdminIntegraciones,
});

function AdminIntegraciones() {
  const statusFn = useServerFn(getZoomConnectionStatus);

  const { data: status, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["zoom-status"],
    queryFn: () => statusFn(),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["zoom-webhook-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("zoom_webhook_logs")
        .select("id,event,signature_valid,processed,error,created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integraciones</h1>
        <p className="text-muted-foreground">Conecta servicios externos a tu plataforma.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-500/10 p-3 text-blue-600">
                <Video className="h-6 w-6" />
              </div>
              <div>
                <CardTitle>Zoom</CardTitle>
                <CardDescription>
                  Server-to-Server OAuth para crear reuniones + Meeting SDK embebido + webhook de grabaciones.
                </CardDescription>
              </div>
            </div>
            {isLoading ? (
              <Badge variant="outline">Verificando…</Badge>
            ) : status?.connected ? (
              <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">
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
            <div className="rounded-md border bg-emerald-500/5 p-4 text-sm">
              <p>
                <span className="font-semibold">Cuenta conectada:</span>{" "}
                <span className="font-mono text-emerald-700">{status.email}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Account ID: {status.accountId} {status.displayName ? `· ${status.displayName}` : ""}
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-sm">
              <p className="mb-2 font-medium">Configura los secretos de Zoom para activar la integración:</p>
              <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
                <li><code>ZOOM_ACCOUNT_ID</code>, <code>ZOOM_CLIENT_ID</code>, <code>ZOOM_CLIENT_SECRET</code> (Server-to-Server OAuth)</li>
                <li><code>ZOOM_SDK_KEY</code>, <code>ZOOM_SDK_SECRET</code> (Meeting SDK)</li>
                <li><code>ZOOM_WEBHOOK_SECRET_TOKEN</code> (validación de webhooks)</li>
              </ul>
              {status?.error && (
                <p className="mt-3 text-xs text-amber-700">Error: {status.error}</p>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Probar conexión
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="https://marketplace.zoom.us/" target="_blank" rel="noreferrer">
                Zoom Marketplace <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <p className="font-medium">Webhook URL (pegar en Zoom Marketplace → Feature → Event Subscriptions):</p>
            <code className="mt-1 block break-all">
              https://ceapsird.lovable.app/api/public/zoom-webhook
            </code>
            <p className="mt-2 text-muted-foreground">
              Eventos a suscribir: <code>endpoint.url_validation</code>, <code>meeting.started</code>,{" "}
              <code>meeting.ended</code>, <code>recording.completed</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logs de webhooks de Zoom</CardTitle>
          <CardDescription>Últimos eventos recibidos (auto-actualiza cada 15s).</CardDescription>
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
                    Sin eventos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Badge variant="outline">{l.event}</Badge>
                    </TableCell>
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
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
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
