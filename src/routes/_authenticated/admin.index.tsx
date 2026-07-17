import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  GraduationCap, Users, ClipboardList, CreditCard, Mail, Newspaper,
  TrendingUp, Award, Activity,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminIndex,
});

async function fetchStats() {
  const [programs, enrollments, extPayments, messages, posts, users, certificates] = await Promise.all([
    supabase.from("programs").select("id,titulo", { count: "exact" }),
    supabase.from("enrollments").select("id,programa_id,user_id,estado,fecha_inscripcion,progreso_porcentaje"),
    supabase.from("external_payments").select("monto,fecha,created_at"),
    supabase.from("contact_messages").select("*", { count: "exact", head: true }).eq("leido", false),
    supabase.from("blog_posts").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("id,nombre,apellido,created_at,is_active"),
    supabase.from("certificates").select("id,created_at,user_id,programa_id"),
  ]);

  const pagos = extPayments.data ?? [];
  const ingresos = pagos.reduce((s, p) => s + Number(p.monto ?? 0), 0);

  // Monthly revenue last 6 months (from Balance Activo)
  const months: { label: string; ingresos: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const total = pagos
      .filter((p) => {
        const t = new Date(p.fecha ?? p.created_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      })
      .reduce((s, p) => s + Number(p.monto ?? 0), 0);
    months.push({
      label: d.toLocaleDateString("es-DO", { month: "short" }),
      ingresos: Math.round(total),
    });
  }

  const enr = enrollments.data ?? [];
  const activos = (users.data ?? []).filter((u) => u.is_active !== false).length;
  const tasaFinalizacion = enr.length === 0
    ? 0
    : Math.round((enr.reduce((s, e) => s + (e.progreso_porcentaje ?? 0), 0) / enr.length));

  // Top programs by enrollments (payment linkage lives in Balance Activo)
  const inscMap = new Map<string, number>();
  for (const e of enr) {
    inscMap.set(e.programa_id, (inscMap.get(e.programa_id) ?? 0) + 1);
  }
  const programaTitulos = new Map((programs.data ?? []).map((p) => [p.id, p.titulo]));
  const topCursos = [...inscMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ titulo: programaTitulos.get(id) ?? "—", count }));


  // Recent activity (last 8 events)
  const profileMap = new Map(
    (users.data ?? []).map((u) => [u.id, `${u.nombre} ${u.apellido}`]),
  );
  type Evt = { tipo: string; texto: string; fecha: string };
  const eventos: Evt[] = [];
  for (const e of enr) {
    eventos.push({
      tipo: "inscripcion",
      texto: `${profileMap.get(e.user_id) ?? "Un estudiante"} se inscribió en ${programaTitulos.get(e.programa_id) ?? "un programa"}`,
      fecha: e.fecha_inscripcion,
    });
  }
  for (const c of certificates.data ?? []) {
    eventos.push({
      tipo: "certificado",
      texto: `${profileMap.get(c.user_id) ?? "Un estudiante"} obtuvo certificado de ${programaTitulos.get(c.programa_id) ?? "un programa"}`,
      fecha: c.created_at,
    });
  }
  for (const u of users.data ?? []) {
    eventos.push({
      tipo: "registro",
      texto: `${u.nombre} ${u.apellido} se registró en la plataforma`,
      fecha: u.created_at,
    });
  }
  eventos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return {
    programas: programs.count ?? 0,
    inscripciones: enr.length,
    ingresos,
    mensajesPendientes: messages.count ?? 0,
    posts: posts.count ?? 0,
    usuarios: users.count ?? activos,
    activos,
    tasaFinalizacion,
    topCursos,
    months,
    eventos: eventos.slice(0, 8),
  };
}

function AdminIndex() {
  const { data } = useQuery({ queryKey: ["admin-stats-v3"], queryFn: fetchStats });

  const cards = [
    { label: "Usuarios registrados", value: data?.usuarios ?? 0, icon: Users },
    { label: "Alumnos activos", value: data?.activos ?? 0, icon: Activity },
    { label: "Programas", value: data?.programas ?? 0, icon: GraduationCap },
    { label: "Inscripciones", value: data?.inscripciones ?? 0, icon: ClipboardList },
    {
      label: "Ingresos totales (DOP)",
      value: `RD$ ${(data?.ingresos ?? 0).toLocaleString("es-DO")}`,
      icon: CreditCard,
    },
    { label: "Tasa de finalización", value: `${data?.tasaFinalizacion ?? 0}%`, icon: TrendingUp },
    { label: "Artículos del blog", value: data?.posts ?? 0, icon: Newspaper },
    { label: "Mensajes sin leer", value: data?.mensajesPendientes ?? 0, icon: Mail },
  ];

  const eventoColor: Record<string, string> = {
    inscripcion: "bg-blue-500",
    certificado: "bg-emerald-500",
    registro: "bg-violet-500",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resumen general</h1>
        <p className="text-muted-foreground">Indicadores principales de la academia.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-bold">{c.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ingresos mensuales</h2>
            <span className="text-xs text-muted-foreground">Últimos 6 meses</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.months ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  formatter={(value: number) => [`RD$ ${value.toLocaleString("es-DO")}`, "Ingresos"]}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="ingresos" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Programas con más inscripciones</h2>
          </div>
          {(data?.topCursos ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay inscripciones registradas.</p>
          ) : (
            <ol className="space-y-3">
              {data?.topCursos.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{c.titulo}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{c.count} inscripciones</span>

                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Actividad reciente</h2>
        {(data?.eventos ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay actividad para mostrar.</p>
        ) : (
          <ul className="space-y-3">
            {data?.eventos.map((e, i) => (
              <li key={i} className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${eventoColor[e.tipo] ?? "bg-muted"}`} />
                <div className="flex-1">
                  <p className="text-sm">{e.texto}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.fecha).toLocaleString("es-DO")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
