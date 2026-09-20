import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { logAuditExport } from "@/lib/audit.functions";
import { getUsersAuthInfo } from "@/lib/admin-users.functions";
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
  AuditEvent, ACCIONES_NAVEGADOR, CATEGORIAS, ENTIDADES, ROLES, describirEvento, nombreCampo, nombreEntidad, valorLegible,
} from "@/lib/audit-format";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  validateSearch: (search: Record<string, unknown>) => ({
    usuario: typeof search["usuario"] === "string" ? (search["usuario"] as string) : undefined,
    sensibles:
      search["sensibles"] === "1" || search["sensibles"] === 1 || search["sensibles"] === true
        ? ("1" as const)
        : undefined,
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
  const { usuario, sensibles } = Route.useSearch();
  const navigate = useNavigate();
  const exportarFn = useServerFn(logAuditExport);
  const [exportando, setExportando] = useState(false);
  const [desde, setDesde] = useState(isoDaysAgo(7));
  const [hasta, setHasta] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [rol, setRol] = useState("todos");
  const [entidad, setEntidad] = useState("todas");
  const [soloSensibles, setSoloSensibles] = useState(sensibles === "1");
  const [busqueda, setBusqueda] = useState("");
  const [buscado, setBuscado] = useState("");
  const [paginas, setPaginas] = useState<AuditEvent[][]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<AuditEvent | null>(null);

  const filtros = JSON.stringify({ desde, hasta, categoria, rol, entidad, soloSensibles, buscado, usuario });

  useEffect(() => {
    setPaginas([]);
    setCursor(null);
  }, [filtros]);

  const aplicarFiltros = (q: any) => {
    if (desde) q = q.gte("occurred_at", new Date(desde + "T00:00:00").toISOString());
    if (hasta) q = q.lte("occurred_at", new Date(hasta + "T23:59:59").toISOString());
    if (categoria !== "todas") q = q.eq("categoria", categoria);
    if (rol !== "todos") q = q.eq("actor_rol", rol);
    if (entidad !== "todas") q = q.eq("entidad", entidad);
    if (soloSensibles) q = q.eq("sensible", true);
    if (usuario) q = q.or(`actor_id.eq.${usuario},sujeto_id.eq.${usuario}`);
    if (buscado.trim()) {
      const t = `%${buscado.trim()}%`;
      q = q.or(`actor_nombre.ilike.${t},actor_email.ilike.${t},entidad_etiqueta.ilike.${t}`);
    }
    return q;
  };

  const { data: pagina, isFetching } = useQuery({
    queryKey: ["admin", "auditoria", filtros, cursor],
    queryFn: async () => {
      let q = aplicarFiltros(
        (supabase.from as any)("audit_log").select("*").order("id", { ascending: false }).limit(PAGE),
      );
      if (cursor !== null) q = q.lt("id", cursor);
      const { data, error } = await q;
      if (error) throw error;
      return (data as AuditEvent[]) ?? [];
    },
  });

  // ─────────── Tarjetas de resumen ───────────
  const { data: resumen } = useQuery({
    queryKey: ["admin", "auditoria", "resumen"],
    queryFn: async () => {
      const hace7 = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const t = (supabase.from as any)("audit_log");
      const [logins, sensibles, acciones, actores, auth] = await Promise.all([
        t.select("id", { count: "exact", head: true })
          .eq("categoria", "acceso").eq("accion", "login").gte("occurred_at", hace7),
        t.select("id", { count: "exact", head: true })
          .eq("sensible", true).gte("occurred_at", hace7),
        t.select("id", { count: "exact", head: true }).gte("occurred_at", hoy.toISOString()),
        t.select("actor_id").eq("categoria", "acceso").eq("accion", "login").gte("occurred_at", hace7),
        getUsersAuthInfo(),
      ]);
      const distintos = new Set(
        ((actores.data ?? []) as { actor_id: string | null }[]).map((r) => r.actor_id).filter(Boolean),
      ).size;
      const limite = Date.now() - 30 * 24 * 3600_000;
      const inactivos = (auth as { last_sign_in_at: string | null }[]).filter(
        (u) => !u.last_sign_in_at || new Date(u.last_sign_in_at).getTime() < limite,
      ).length;
      return {
        logins: logins.count ?? 0,
        distintos,
        sensibles: sensibles.count ?? 0,
        hoy: acciones.count ?? 0,
        inactivos,
      };
    },
  });

  // ─────────── Exportar CSV ───────────
  const exportarCsv = async () => {
    setExportando(true);
    try {
      const filas: AuditEvent[] = [];
      let ultimo: number | null = null;
      for (let i = 0; i < 5; i++) {
        let q = aplicarFiltros(
          (supabase.from as any)("audit_log").select("*").order("id", { ascending: false }).limit(1000),
        );
        if (ultimo !== null) q = q.lt("id", ultimo);
        const { data, error } = await q;
        if (error) throw error;
        const lote = (data as AuditEvent[]) ?? [];
        filas.push(...lote);
        if (lote.length < 1000) break;
        ultimo = lote[lote.length - 1]!.id;
        if (i === 4) toast.info("Se exportaron las primeras 5.000 filas; hay más resultados.");
      }

      const sujetos = Array.from(new Set(filas.map((f) => f.sujeto_id).filter(Boolean))) as string[];
      const progs = Array.from(new Set(filas.map((f) => f.programa_id).filter(Boolean))) as string[];
      const [{ data: perfilesCsv }, { data: programasCsv }] = await Promise.all([
        sujetos.length
          ? supabase.from("profiles").select("id,nombre,apellido").in("id", sujetos)
          : Promise.resolve({ data: [] as any[] }),
        progs.length
          ? supabase.from("programs").select("id,titulo").in("id", progs)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const nombresCsv = new Map((perfilesCsv ?? []).map((p: any) => [p.id, `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim()]));
      const programasMap = new Map((programasCsv ?? []).map((p: any) => [p.id, p.titulo]));
      const ctxCsv = { nombres: nombresCsv, programas: programasMap };

      const cab = [
        "Fecha", "Categoría", "Acción", "Actor", "Rol", "Correo", "Entidad", "Etiqueta",
        "Programa", "Sujeto", "Sensible", "IP", "Dispositivo", "Descripción", "Cambios",
      ];
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lineas = [cab.map(esc).join(",")];
      for (const f of filas) {
        lineas.push([
          new Date(f.occurred_at).toLocaleString("es-DO"),
          CATEGORIAS[f.categoria] ?? f.categoria,
          f.accion,
          f.actor_nombre ?? "Sistema",
          ROLES[f.actor_rol] ?? f.actor_rol,
          f.actor_email ?? "",
          nombreEntidad(f.entidad),
          f.entidad_etiqueta ?? "",
          f.programa_id ? programasMap.get(f.programa_id) ?? "" : "",
          f.sujeto_id ? nombresCsv.get(f.sujeto_id) ?? "" : "",
          f.sensible ? "Sí" : "No",
          f.ip ?? "",
          f.user_agent ?? "",
          describirEvento(f, ctxCsv),
          f.cambios ? JSON.stringify(f.cambios) : "",
        ].map(esc).join(","));
      }

      const blob = new Blob(["\uFEFF" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      void exportarFn({ data: { filas: filas.length, filtros: JSON.parse(filtros) } }).catch(() => {});
      toast.success(`Se exportaron ${filas.length} eventos`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setExportando(false);
    }
  };

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

  const { data: nombreUsuarioFiltrado } = useQuery({
    queryKey: ["admin", "auditoria", "usuario", usuario],
    enabled: !!usuario,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles").select("nombre,apellido").eq("id", usuario!).maybeSingle();
      return data ? `${data.nombre ?? ""} ${data.apellido ?? ""}`.trim() : usuario!;
    },
  });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" });

  return (
    <div>
      <AdminPageHeader
        title="Auditoría"
        description="Registro de acciones realizadas en el portal. Solo lectura."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
          onClick={() => { setCategoria("acceso"); setDesde(isoDaysAgo(7)); setHasta(""); setSoloSensibles(false); }}
        >
          <p className="text-xs text-muted-foreground">Accesos (7 días)</p>
          <p className="text-2xl font-bold">{resumen?.logins ?? 0}</p>
          <p className="text-xs text-muted-foreground">{resumen?.distintos ?? 0} usuarios distintos</p>
        </button>
        <button
          type="button"
          className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
          onClick={() => { setSoloSensibles(true); setCategoria("todas"); setDesde(isoDaysAgo(7)); setHasta(""); }}
        >
          <p className="text-xs text-muted-foreground">Eventos sensibles (7 días)</p>
          <p className="text-2xl font-bold">{resumen?.sensibles ?? 0}</p>
        </button>
        <button
          type="button"
          className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
          onClick={() => { setDesde(isoDaysAgo(0)); setHasta(""); setCategoria("todas"); setSoloSensibles(false); }}
        >
          <p className="text-xs text-muted-foreground">Acciones hoy</p>
          <p className="text-2xl font-bold">{resumen?.hoy ?? 0}</p>
        </button>
        <button
          type="button"
          className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
          onClick={() => navigate({ to: "/admin/usuarios" })}
        >
          <p className="text-xs text-muted-foreground">Sin actividad en 30 días</p>
          <p className="text-2xl font-bold">{resumen?.inactivos ?? 0}</p>
          <p className="text-xs text-muted-foreground">Ver usuarios</p>
        </button>
      </div>

      {usuario && (
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="secondary">
            Filtrando por: {nombreUsuarioFiltrado ?? "usuario"}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin/auditoria", search: { usuario: undefined, sensibles: undefined } })}>
            Quitar filtro
          </Button>
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={exportarCsv} disabled={exportando}>
          {exportando ? "Exportando…" : "Exportar CSV"}
        </Button>
      </div>

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

              {detalle.categoria === "actividad" && ACCIONES_NAVEGADOR.has(detalle.accion) && (
                <p className="text-xs italic text-muted-foreground">
                  Registrado por el navegador del usuario
                </p>
              )}

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
