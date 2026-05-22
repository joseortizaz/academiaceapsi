import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Video, CheckCircle2, AlertCircle, Trash2, RefreshCw, ExternalLink } from "lucide-react";
import { useZoomStore, zoomStore } from "@/lib/zoom-mock";

export const Route = createFileRoute("/_authenticated/admin/integraciones")({
  component: AdminIntegraciones,
});

function AdminIntegraciones() {
  const { connection, logs } = useZoomStore();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("academia@ceapsi.do");
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    toast.message("Redirigiendo a Zoom OAuth…", { description: "Simulando autorización." });
    await new Promise((r) => setTimeout(r, 1200));
    zoomStore.connect(email);
    setConnecting(false);
    setOpen(false);
    toast.success("Cuenta de Zoom conectada con éxito");
  };

  const handleDisconnect = () => {
    zoomStore.disconnect();
    toast.warning("Cuenta de Zoom desconectada");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integraciones</h1>
        <p className="text-muted-foreground">Conecta servicios externos a tu plataforma.</p>
      </div>

      {/* Zoom card */}
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
                  Genera reuniones, recibe webhooks y publica grabaciones automáticamente.
                </CardDescription>
              </div>
            </div>
            {connection.connected ? (
              <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">
                <CheckCircle2 className="h-3 w-3" /> Conectado
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <AlertCircle className="h-3 w-3" /> Sin conectar
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {connection.connected ? (
            <div className="space-y-3">
              <div className="rounded-md border bg-emerald-500/5 p-4">
                <p className="text-sm">
                  <span className="font-semibold">Conectado con éxito</span> a la cuenta{" "}
                  <span className="font-mono text-emerald-700">{connection.email}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {connection.accountName} · desde {new Date(connection.connectedAt!).toLocaleString("es-DO")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  <Trash2 className="mr-2 h-4 w-4" /> Desconectar
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a href="https://marketplace.zoom.us/" target="_blank" rel="noreferrer">
                    Ver en Zoom Marketplace <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 rounded-md border border-dashed p-4">
              <p className="text-sm text-muted-foreground">
                Conecta una cuenta administradora de Zoom para crear reuniones automáticamente desde la plataforma.
              </p>
              <Button onClick={() => setOpen(true)}>
                <Video className="mr-2 h-4 w-4" /> Conectar cuenta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Logs de sincronización</CardTitle>
            <CardDescription>Historial de eventos y webhooks recibidos desde Zoom.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => zoomStore.clearLogs()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Limpiar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Mensaje</TableHead>
                <TableHead className="w-44">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    Sin eventos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                logs.slice(0, 25).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          l.level === "success"
                            ? "border-emerald-500/40 text-emerald-700"
                            : l.level === "warning"
                              ? "border-amber-500/40 text-amber-700"
                              : ""
                        }
                      >
                        {l.event}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{l.message}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(l.at).toLocaleString("es-DO")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* OAuth simulation dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Autorizar acceso a Zoom</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Inicia sesión con la cuenta Zoom que se utilizará para crear reuniones.
              <span className="ml-1 italic">(Flujo OAuth simulado.)</span>
            </p>
            <div>
              <Label htmlFor="zoom-email">Correo de la cuenta</Label>
              <Input
                id="zoom-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <ul className="ml-4 list-disc text-xs text-muted-foreground">
              <li>Crear y gestionar reuniones</li>
              <li>Acceder a grabaciones en la nube</li>
              <li>Recibir eventos webhook (meeting.ended, recording.completed)</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? "Conectando…" : "Autorizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
