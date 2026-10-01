import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/admin/AdminUI";

const DIAS = 30;

type DocResumen = { id: string; titulo: string; descargas: number; estado: string };
type Evento = {
  accion: string;
  entidad_id: string | null;
  actor_id: string | null;
  occurred_at: string;
};

/** Clave de día local (AAAA-MM-DD) para agrupar eventos. */
function claveDia(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function LibraryStats({ docs }: { docs: DocResumen[] }) {
  const desde = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (DIAS - 1));
    return d;
  }, []);

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["admin", "biblioteca", "estadisticas", desde.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("accion, entidad_id, actor_id, occurred_at")
        .eq("categoria", "actividad")
        .eq("entidad", "library_documents")
        .in("accion", ["descargar_libro", "ver_libro"])
        .gte("occurred_at", desde.toISOString())
        .order("occurred_at", { ascending: true })
        .limit(20000);
      if (error) throw error;
      return (data ?? []) as Evento[];
    },
  });

  const stats = useMemo(() => {
    const porDia = new Map<string, number>();
    for (let i = 0; i < DIAS; i++) {
      const d = new Date(desde);
      d.setDate(desde.getDate() + i);
      porDia.set(claveDia(d), 0);
    }
    const porDoc = new Map<string, { d30: number; l30: number }>();
    const personas = new Set<string>();
    let descargas = 0;
    let lecturas = 0;

    for (const e of eventos) {
      if (e.actor_id) personas.add(e.actor_id);
      const fila = porDoc.get(e.entidad_id ?? "") ?? { d30: 0, l30: 0 };
      if (e.accion === "descargar_libro") {
        descargas++;
        fila.d30++;
        const k = claveDia(new Date(e.occurred_at));
        if (porDia.has(k)) porDia.set(k, (porDia.get(k) ?? 0) + 1);
      } else {
        lecturas++;
        fila.l30++;
      }
      if (e.entidad_id) porDoc.set(e.entidad_id, fila);
    }

    const serie = [...porDia.entries()].map(([k, valor]) => {
      const [y, m, d] = k.split("-").map(Number);
      return {
        dia: new Date(y, m - 1, d).toLocaleDateString("es-DO", { day: "numeric", month: "short" }),
        descargas: valor,
      };
    });

    const top = docs
      .map((doc) => ({ ...doc, ...(porDoc.get(doc.id) ?? { d30: 0, l30: 0 }) }))
      .filter((d) => d.descargas > 0 || d.d30 > 0 || d.l30 > 0)
      .sort((a, b) => b.d30 - a.d30 || b.descargas - a.descargas || b.l30 - a.l30)
      .slice(0, 10);

    return { serie, top, descargas, lecturas, personas: personas.size };
  }, [eventos, docs, desde]);

  const totalHistorico = docs.reduce((a, d) => a + (d.descargas ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Descargas totales"
          valor={totalHistorico}
          nota="Desde que existe la biblioteca"
        />
        <Tile label={`Descargas, últimos ${DIAS} días`} valor={stats.descargas} />
        <Tile label={`Lecturas en línea, ${DIAS} días`} valor={stats.lecturas} />
        <Tile
          label={`Personas distintas, ${DIAS} días`}
          valor={stats.personas}
          nota="Leyeron o descargaron"
        />
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Descargas por día</h2>
          <span className="text-xs text-muted-foreground">Últimos {DIAS} días</span>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.serie} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="dia"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                  className="text-xs"
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  className="text-xs"
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                  formatter={(v: number) => [v, "Descargas"]}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey="descargas"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Según el registro de actividad: si una misma persona descarga el mismo documento varias
          veces en 10 minutos, cuenta una vez. El contador de "Descargas totales" suma cada clic.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Documentos más descargados</h2>
        {stats.top.length === 0 ? (
          <EmptyState>Todavía no hay descargas ni lecturas.</EmptyState>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="text-right">Descargas {DIAS} días</TableHead>
                  <TableHead className="text-right">Lecturas {DIAS} días</TableHead>
                  <TableHead className="text-right">Descargas totales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.top.map((d, i) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">
                      {d.titulo}
                      {d.estado !== "publicado" && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (no publicado)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{d.d30}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.l30}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.descargas}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ label, valor, nota }: { label: string; valor: number; nota?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{valor.toLocaleString("es-DO")}</p>
      {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}
