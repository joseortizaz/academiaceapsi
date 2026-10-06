import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { HandCoins, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminPageHeader, EmptyState } from "@/components/admin/AdminUI";
import {
  adminCerrarAcuerdo,
  adminCrearAcuerdo,
  adminEvaluarMora,
  adminGetMora,
  adminSaveMoraConfig,
} from "@/lib/mora.functions";
import {
  ETIQUETA_ETAPA,
  ETIQUETA_TIPO,
  fechaLarga,
  rd,
  hoyRD,
  sumarDias,
  textoPlano,
  type TipoAvisoMora,
} from "@/lib/mora-textos";

export const Route = createFileRoute("/_authenticated/admin/mora")({
  staticData: { sitemap: false },
  component: AdminMora,
});

type Alumno = {
  user_id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  etapa: string;
  dias_mora: number;
  cuotas_vencidas: number;
  monto_vencido: number;
  cuota_antigua_venc: string | null;
  cuota_antigua_saldo: number | null;
  proxima_venc: string | null;
  proxima_saldo: number | null;
  deberia_restringir: boolean;
  restringido: boolean;
  datos_frescos: boolean;
  datos_sync_at: string | null;
  aviso_hoy: TipoAvisoMora | null;
  previo_ref: string | null;
  ultimo_aviso: { tipo: TipoAvisoMora; fecha: string; canales: string[] } | null;
};

const ETAPA_CLASE: Record<string, string> = {
  al_dia: "bg-emerald-500/15 text-emerald-700",
  gracia: "bg-sky-500/15 text-sky-700",
  mora: "bg-amber-500/15 text-amber-800",
  por_restringir: "bg-orange-500/15 text-orange-800",
  restringido: "bg-red-500/15 text-red-700",
  acuerdo: "bg-violet-500/15 text-violet-700",
};

const FILTROS: Array<{ id: string; label: string; test: (a: Alumno) => boolean }> = [
  { id: "deuda", label: "Con deuda vencida", test: (a) => a.cuotas_vencidas > 0 || a.etapa === "acuerdo" },
  { id: "restringir", label: "Por restringir o restringidos", test: (a) => a.deberia_restringir || a.restringido },
  { id: "acuerdo", label: "En acuerdo", test: (a) => a.etapa === "acuerdo" },
  { id: "todos", label: "Todos", test: () => true },
];

/** Tipo de aviso que corresponde hoy a un alumno (para el WhatsApp manual). */
function tipoParaWhatsapp(a: Alumno): TipoAvisoMora | null {
  if (a.restringido) return "aviso4";
  if (a.etapa === "por_restringir") return "aviso3";
  if (a.etapa === "mora") return a.dias_mora >= 25 ? "aviso3" : "aviso2";
  if (a.etapa === "gracia") return "aviso1";
  if (a.proxima_venc && a.proxima_saldo) return "previo";
  return null;
}

function enlaceWhatsapp(a: Alumno, contacto: string): string | null {
  const tipo = tipoParaWhatsapp(a);
  const digitos = (a.telefono ?? "").replace(/\D/g, "");
  if (!tipo || digitos.length < 10) return null;
  const numero = digitos.length === 10 ? `1${digitos}` : digitos; // RD: +1
  const previo = tipo === "previo";
  const vencimiento = (previo ? a.proxima_venc : a.cuota_antigua_venc) ?? "";
  if (!vencimiento) return null;
  const texto = textoPlano(tipo, {
    nombre: a.nombre.split(" ")[0] ?? "",
    monto: Number(previo ? a.proxima_saldo : a.cuota_antigua_saldo) || 0,
    vencimiento,
    saldoVencido: Number(a.monto_vencido) || 0,
    contacto,
    hoy: hoyRD(),
  });
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

function AdminMora() {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetMora);
  const saveFn = useServerFn(adminSaveMoraConfig);
  const evalFn = useServerFn(adminEvaluarMora);
  const crearFn = useServerFn(adminCrearAcuerdo);
  const cerrarFn = useServerFn(adminCerrarAcuerdo);

  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "mora"], queryFn: () => getFn() });
  const refrescar = () => qc.invalidateQueries({ queryKey: ["admin", "mora"] });

  const [filtro, setFiltro] = useState("deuda");
  const [evaluando, setEvaluando] = useState(false);
  const [acuerdoPara, setAcuerdoPara] = useState<Alumno | null>(null);

  const alumnos = (data?.alumnos ?? []) as Alumno[];
  const visibles = useMemo(
    () => alumnos.filter(FILTROS.find((f) => f.id === filtro)?.test ?? (() => true)),
    [alumnos, filtro],
  );
  const contacto = data?.config?.contacto_direccion ?? "admin@ceapsird.com";
  const conteo = (etapa: string) => alumnos.filter((a) => a.etapa === etapa).length;
  const totalVencido = alumnos.reduce((s, a) => s + Number(a.monto_vencido || 0), 0);

  const evaluar = async () => {
    setEvaluando(true);
    try {
      const r = await evalFn();
      toast.success(`Evaluados ${r.evaluados} alumnos`);
      refrescar();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo evaluar");
    } finally {
      setEvaluando(false);
    }
  };

  if (error) {
    return (
      <div>
        <AdminPageHeader title="Mora y acuerdos de pago" />
        <EmptyState>No se pudo cargar: {(error as Error).message}</EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Mora y acuerdos de pago"
        description="Estado de pago de los alumnos vinculados con Balance Activo, avisos y restricción de contenidos."
        action={
          <Button variant="outline" size="sm" onClick={evaluar} disabled={evaluando}>
            <RefreshCw className={`mr-2 h-4 w-4 ${evaluando ? "animate-spin" : ""}`} />
            Recalcular ahora
          </Button>
        }
      />

      {data?.config && (
        <ConfigCard
          config={data.config}
          porRestringir={alumnos.filter((a) => a.deberia_restringir && !a.restringido).length}
          onSave={async (v) => {
            const r = await saveFn({ data: v });
            toast.success("Configuración guardada", {
              description: v.restriccion_activa ? `${r.restringidos} alumnos con acceso restringido.` : undefined,
            });
            refrescar();
          }}
          ultimaCorrida={data.ultimaCorrida}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(["al_dia", "gracia", "mora", "por_restringir", "restringido", "acuerdo"] as const).map((e) => (
          <Card key={e}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{ETIQUETA_ETAPA[e]}</p>
              <p className="text-2xl font-bold">{conteo(e)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Saldo vencido total: <strong>{rd(totalVencido)}</strong>. Solo se evalúan alumnos vinculados con un cliente de
        Balance Activo y con facturas a crédito en cuotas.
      </p>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Alumnos</CardTitle>
          <Tabs value={filtro} onValueChange={setFiltro}>
            <TabsList>
              {FILTROS.map((f) => (
                <TabsTrigger key={f.id} value={f.id}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Cargando…</p>
          ) : visibles.length === 0 ? (
            <div className="p-6">
              <EmptyState>No hay alumnos en esta lista.</EmptyState>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead className="text-right">Días</TableHead>
                  <TableHead className="text-right">Cuotas vencidas</TableHead>
                  <TableHead className="text-right">Vencido</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Aviso de hoy</TableHead>
                  <TableHead>Último aviso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((a) => {
                  const wa = enlaceWhatsapp(a, contacto);
                  const avisoHoy = a.aviso_hoy ?? (a.previo_ref ? "previo" : null);
                  return (
                    <TableRow key={a.user_id}>
                      <TableCell>
                        <div className="font-medium">{a.nombre}</div>
                        <div className="text-xs text-muted-foreground">{a.email ?? "—"}</div>
                        {!a.datos_frescos && a.cuotas_vencidas > 0 && (
                          <div className="text-xs text-amber-700">Sin datos recientes de Balance Activo</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{a.dias_mora || "—"}</TableCell>
                      <TableCell className="text-right">{a.cuotas_vencidas || "—"}</TableCell>
                      <TableCell className="text-right">{a.monto_vencido ? rd(a.monto_vencido) : "—"}</TableCell>
                      <TableCell>
                        <Badge className={ETAPA_CLASE[a.etapa] ?? ""}>{ETIQUETA_ETAPA[a.etapa] ?? a.etapa}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {avisoHoy ? (
                          <span>
                            {ETIQUETA_TIPO[avisoHoy]}
                            {!data?.config?.avisos_activos && (
                              <span className="block text-xs text-muted-foreground">se enviaría (simulación)</span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.ultimo_aviso ? (
                          <span>
                            {ETIQUETA_TIPO[a.ultimo_aviso.tipo]}
                            <span className="block text-xs text-muted-foreground">
                              {fechaLarga(a.ultimo_aviso.fecha)} · {a.ultimo_aviso.canales.join(", ")}
                            </span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {wa && (
                            <Button asChild size="sm" variant="ghost" title="Enviar el aviso por WhatsApp">
                              <a href={wa} target="_blank" rel="noreferrer">
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {a.etapa !== "acuerdo" && a.cuotas_vencidas > 0 && (
                            <Button size="sm" variant="outline" onClick={() => setAcuerdoPara(a)}>
                              <HandCoins className="mr-1 h-4 w-4" /> Acuerdo
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acuerdos de pago vigentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(data?.acuerdos ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No hay acuerdos vigentes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead>Hasta</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.acuerdos ?? []).map((ac: any) => {
                  const vencido = ac.hasta < hoyRD();
                  return (
                    <TableRow key={ac.id}>
                      <TableCell className="font-medium">{ac.nombre}</TableCell>
                      <TableCell>{fechaLarga(ac.desde)}</TableCell>
                      <TableCell className={vencido ? "text-muted-foreground" : ""}>
                        {fechaLarga(ac.hasta)}
                        {vencido && <span className="block text-xs">Vencido: ya no protege al alumno</span>}
                      </TableCell>
                      <TableCell className="max-w-sm whitespace-pre-wrap text-sm">{ac.nota ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await cerrarFn({ data: { id: ac.id } });
                              toast.success("Acuerdo cerrado");
                              refrescar();
                            } catch (e: any) {
                              toast.error(e.message);
                            }
                          }}
                        >
                          Cerrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AcuerdoDialog
        alumno={acuerdoPara}
        onClose={() => setAcuerdoPara(null)}
        onSave={async (hasta, nota) => {
          await crearFn({ data: { userId: acuerdoPara!.user_id, hasta, nota } });
          toast.success("Acuerdo registrado", { description: "Se pausaron los avisos y se devolvió el acceso." });
          setAcuerdoPara(null);
          refrescar();
        }}
      />
    </div>
  );
}

type ConfigValues = {
  avisos_activos: boolean;
  restriccion_activa: boolean;
  contacto_direccion: string;
  medios_pago: string | null;
};

function ConfigCard({
  config,
  porRestringir,
  onSave,
  ultimaCorrida,
}: {
  config: ConfigValues;
  porRestringir: number;
  onSave: (v: ConfigValues) => Promise<void>;
  ultimaCorrida: { created_at: string; processed: boolean; error: string | null } | null;
}) {
  const [v, setV] = useState<ConfigValues>(config);
  const [guardando, setGuardando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => setV(config), [config]);

  const cambios = JSON.stringify(v) !== JSON.stringify(config);
  const enciendeRestriccion = v.restriccion_activa && !config.restriccion_activa;
  const simulacion = !v.avisos_activos && !v.restriccion_activa;

  const guardar = async () => {
    setGuardando(true);
    try {
      await onSave(v);
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo guardar");
    } finally {
      setGuardando(false);
      setConfirmar(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Configuración</CardTitle>
        <Badge className={simulacion ? "bg-muted text-muted-foreground" : "bg-emerald-500/15 text-emerald-700"}>
          {simulacion ? "Modo simulación: no se envía ni se restringe" : "Activo"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="avisos">Enviar avisos</Label>
            <p className="text-sm text-muted-foreground">
              Recordatorio previo y avisos 1 a 4 por correo y por la campana del portal, cada día a las 8:00 a. m.
            </p>
          </div>
          <Switch
            id="avisos"
            checked={v.avisos_activos}
            onCheckedChange={(c) => setV({ ...v, avisos_activos: c })}
          />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="restriccion">Restringir contenidos</Label>
            <p className="text-sm text-muted-foreground">
              Con dos cuotas vencidas o 30 días de atraso, el alumno deja de ver el contenido de sus programas hasta
              pagar la cuota más antigua o firmar un acuerdo. Tiene efecto inmediato.
            </p>
          </div>
          <Switch
            id="restriccion"
            checked={v.restriccion_activa}
            onCheckedChange={(c) => setV({ ...v, restriccion_activa: c })}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contacto">Contacto de la dirección (aparece en los avisos)</Label>
            <Input
              id="contacto"
              value={v.contacto_direccion}
              onChange={(e) => setV({ ...v, contacto_direccion: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="medios">Medios de pago (nota interna)</Label>
            <Textarea
              id="medios"
              rows={2}
              value={v.medios_pago ?? ""}
              onChange={(e) => setV({ ...v, medios_pago: e.target.value })}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {ultimaCorrida
              ? `Última corrida diaria: ${new Date(ultimaCorrida.created_at).toLocaleString("es-DO")}${
                  ultimaCorrida.processed ? "" : ` · con errores: ${ultimaCorrida.error ?? ""}`
                }`
              : "La corrida diaria aún no se ha ejecutado."}
          </p>
          <Button
            onClick={() => (enciendeRestriccion ? setConfirmar(true) : guardar())}
            disabled={!cambios || guardando || v.contacto_direccion.trim().length < 3}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Activar la restricción de contenidos?</AlertDialogTitle>
            <AlertDialogDescription>
              {porRestringir > 0
                ? `${porRestringir} alumno(s) cumplen hoy la condición y perderán el acceso al contenido de inmediato.`
                : "Hoy ningún alumno cumple la condición; se aplicará a quienes la cumplan desde ahora."}{" "}
              Podrá devolver el acceso a cualquiera registrando un acuerdo de pago.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={guardar}>Activar restricción</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function AcuerdoDialog({
  alumno,
  onClose,
  onSave,
}: {
  alumno: Alumno | null;
  onClose: () => void;
  onSave: (hasta: string, nota: string) => Promise<void>;
}) {
  const [hasta, setHasta] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    if (alumno) {
      setHasta(sumarDias(hoyRD(), 15));
      setNota("");
    }
  }, [alumno]);

  return (
    <Dialog open={!!alumno} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar acuerdo de pago</DialogTitle>
          <DialogDescription>
            {alumno?.nombre}: mientras el acuerdo esté vigente no recibe avisos y tiene acceso completo. Al vencer, el
            sistema lo vuelve a evaluar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hasta">Vigente hasta</Label>
            <Input id="hasta" type="date" min={hoyRD()} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nota">Nota del acuerdo</Label>
            <Textarea
              id="nota"
              rows={3}
              placeholder="Ej.: paga RD$3,000 el 15 y el resto el 30"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!hasta || hasta < hoyRD() || guardando}
            onClick={async () => {
              setGuardando(true);
              try {
                await onSave(hasta, nota);
              } catch (e: any) {
                toast.error(e.message ?? "No se pudo registrar");
              } finally {
                setGuardando(false);
              }
            }}
          >
            {guardando ? "Guardando…" : "Registrar acuerdo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
