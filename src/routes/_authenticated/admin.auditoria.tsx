import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AdminPageHeader, EmptyState } from "@/components/admin/AdminUI";
import { ShieldAlert } from "lucide-react";
import {
  AuditEvent, CATEGORIAS, ENTIDADES, ROLES, describirEvento, nombreCampo, nombreEntidad, valorLegible,
} from "@/lib/audit-format";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  validateSearch: (search: Record<string, unknown>) => ({
    usuario: typeof search["usuario"] === "string" ? (search["usuario"] as string) : undefined,
  }),
  component: AuditoriaPage,
});

const PAGE = 50;

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function AuditoriaPage() {
  const [desde, setDesde] = useState(isoDaysAgo(7));
  const [hasta, setHasta] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [rol, setRol] = useState("todos");
  const [entidad, setEntidad] = useState("todas");
  const [soloSensibles, setSoloSensibles] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [buscado, setBuscado] = useState("");
  const [paginas, setPaginas] = useState<AuditEvent[][]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<AuditEvent | null>(null);

  const filtros = JSON.stringify({ desde, hasta, categoria, rol, entidad, soloSensibles, buscado });

  useEffect(() => {
    setPaginas([]);
    setCursor(null);
  }, [filtros]);

  const { data: pagina, isFetching } = useQuery({
    queryKey: ["admin", "auditoria", filtros, cursor],
    queryFn: async () => {
      let q = (supabase.from as any)("audit_log")
        .select("*")
        .order("id", { ascending: false })
        .limit(PAGE);
      if (desde) q = q.gte("occurred_at", new Date(desde + "T00:00:00").toISOString());
      if (hasta) q = q.lte("occurred_at", new Date(hasta + "T23:59:59").toISOString());
      if (categoria !== "todas") q = q.eq("categoria", categoria);
      if (rol !== "todos") q = q.eq("actor_rol", rol);
      if (entidad !== "todas") q = q.eq("entidad", entidad);
      if (soloSensibles) q = q.eq("sensible", true);
      if (buscado.trim()) {
        const t = `%${buscado.trim()}%`;
        q = q.or(`actor_nombre.ilike.${t},actor_email.ilike.${t},entidad_etiqueta.ilike.${t}`);
      }
      if (cursor !== null) q = q.lt("id", cursor);
      const { data, error } = await q;
      if (error) throw error;
      return (data as AuditEvent[]) ?? [];
    },
  });

  useEffect(() => {
    if (!pagina) return;
    setPaginas((prev) => {
      if (cursor === null) return [pagina];
      if (prev.some((p) => p[0]?.id === pagina[0]?.id)) return prev;
      return [...prev, pagina];
    });
  }, [pagina, cursor]);

  const eventos = useMemo(() => paginas.flat(), [paginas]);
  const hayMas = (pagina?.length ?? 0) === PAGE;

  const sujetoIds = useMemo(
    () => Array.from(new Set(eventos.map((e) => e.sujeto_id).filter(Boolean))) as string[],
    [eventos],
  );
  const programaIds = useMemo(
    () => Array.from(new Set(eventos.map((e) => e.programa_id).filter(Boolean))) as string[],
    [eventos],
  );

  const { data: nombres = new Map<string, string>() } = useQuery({
    queryKey: ["admin", "auditoria", "perfiles", sujetoIds.join(",")],
    enabled: sujetoIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,nombre,apellido").in("id", sujetoIds);
      return new Map((data ?? []).map((p) => [p.id, `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim()]));
    },
  });

  const { data: programas = new Map<string, string>() } = useQuery({
    queryKey: ["admin", "auditoria", "programas", programaIds.join(",")],
    enabled: programaIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("id,titulo").in("id", programaIds);
      return new Map((data ?? []).map((p) => [p.id, p.titulo]));
    },
  });

  const ctx = { nombres, programas };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" });

  return (
    <div>
      <AdminPageHeader
        title="Auditoría"
        description="Registro de acciones realizadas en el portal. Solo lectura."
      />

      <div className="mb-4 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3 lg:grid-cols-4">
        <div className="grid gap-1.5">
          <Label className="text-xs">Desde</Label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Hasta</Label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Categoría</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {Object.entries(CATEGORIAS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Rol del actor</Label>
          <Select value={rol} onValueChange={setRol}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {Object.entries(ROLES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Tipo de dato</Label>
          <Select value={entidad} onValueChange={setEntidad}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos</SelectItem>
              {Object.entries(ENTIDADES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.charAt(0).toUpperCase() + v.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5 md:col-span-2">
          <Label className="text-xs">Buscar (persona, correo o registro)</Label>
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); setBuscado(busqueda); }}
          >
            <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, correo o título…" />
            <Button type="submit" variant="secondary">Buscar</Button>
          </form>
        </div>
        <div className="flex items-end gap-2">
          <Switch id="sens" checked={soloSensibles} onCheckedChange={setSoloSensibles} />
          <Label htmlFor="sens" className="text-sm">Solo eventos sensibles</Label>
        </div>
        <div className="flex items-end gap-2">
          <Button variant="outline" size="sm" onClick={() => { setDesde(isoDaysAgo(0)); setHasta(""); }}>Hoy</Button>
          <Button variant="outline" size="sm" onClick={() => { setDesde(isoDaysAgo(7)); setHasta(""); }}>7 días</Button>
          <Button variant="outline" size="sm" onClick={() => { setDesde(isoDaysAgo(30)); setHasta(""); }}>30 días</Button>
          <Button variant="outline" size="sm" onClick={() => { setDesde(""); setHasta(""); }}>Todo</Button>
        </div>
      </div>

      {eventos.length === 0 ? (
        <EmptyState>{isFetching ? "Cargando eventos…" : "No hay eventos con estos filtros."}</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Fecha</TableHead>
                <TableHead className="w-56">Quién</TableHead>
                <TableHead>Qué ocurrió</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos.map((ev) => (
                <TableRow key={ev.id} className="cursor-pointer" onClick={() => setDetalle(ev)}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {fmt(ev.occurred_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{ev.actor_nombre || "Sistema"}</span>
                      <Badge variant="secondary">{ROLES[ev.actor_rol] ?? ev.actor_rol}</Badge>
                    </div>
                    {ev.actor_email && (
                      <div className="text-xs text-muted-foreground">{ev.actor_email}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-start gap-2">
                      <span>{describirEvento(ev, ctx)}</span>
                      {ev.sensible && (
                        <Badge variant="destructive" className="shrink-0 gap-1">
                          <ShieldAlert className="h-3 w-3" /> Sensible
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {hayMas && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            disabled={isFetching}
            onClick={() => setCursor(eventos[eventos.length - 1]?.id ?? null)}
          >
            {isFetching ? "Cargando…" : "Cargar más"}
          </Button>
        </div>
      )}

      <Sheet open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Detalle del evento</SheetTitle>
          </SheetHeader>
          {detalle && (
            <div className="mt-4 space-y-4 text-sm">
              <p className="text-base">{describirEvento(detalle, ctx)}</p>
              <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
                <Dato k="Fecha" v={new Date(detalle.occurred_at).toLocaleString("es-DO", { dateStyle: "full", timeStyle: "medium" })} />
                <Dato k="Actor" v={detalle.actor_nombre || "Sistema"} />
                <Dato k="Rol" v={ROLES[detalle.actor_rol] ?? detalle.actor_rol} />
                <Dato k="Correo" v={detalle.actor_email} />
                <Dato k="Categoría" v={CATEGORIAS[detalle.categoria] ?? detalle.categoria} />
                <Dato k="Tipo de dato" v={nombreEntidad(detalle.entidad)} />
                <Dato k="Identificador" v={detalle.entidad_id} />
                <Dato k="Registro" v={detalle.entidad_etiqueta} />
                <Dato k="Programa" v={detalle.programa_id ? programas.get(detalle.programa_id) ?? detalle.programa_id : null} />
                <Dato k="Persona afectada" v={detalle.sujeto_id ? nombres.get(detalle.sujeto_id) ?? detalle.sujeto_id : null} />
                <Dato k="IP" v={detalle.ip} />
                <Dato k="Dispositivo" v={detalle.user_agent} />
              </dl>

              {detalle.detalle && Object.keys(detalle.detalle).length > 0 && (
                <div>
                  <h4 className="mb-1 font-medium">Información adicional</h4>
                  <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(detalle.detalle, null, 2)}
                  </pre>
                </div>
              )}

              {detalle.cambios && Object.keys(detalle.cambios).length > 0 && (
                <div>
                  <h4 className="mb-2 font-medium">Antes / Después</h4>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campo</TableHead>
                          <TableHead>Antes</TableHead>
                          <TableHead>Después</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(detalle.cambios).map(([k, c]) => (
                          <TableRow key={k}>
                            <TableCell className="align-top font-medium">{nombreCampo(k)}</TableCell>
                            <TableCell className="whitespace-pre-wrap break-words align-top text-xs">
                              {valorLegible(c.antes)}
                            </TableCell>
                            <TableCell className="whitespace-pre-wrap break-words align-top text-xs">
                              {valorLegible(c.despues)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Dato({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="col-span-2 break-words">{v}</dd>
    </>
  );
}
