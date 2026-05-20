import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  GraduationCap,
  Users,
  ClipboardList,
  CreditCard,
  Mail,
  Newspaper,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminIndex,
});

async function fetchStats() {
  const [programs, enrollments, payments, messages, posts, users] = await Promise.all([
    supabase.from("programs").select("*", { count: "exact", head: true }),
    supabase.from("enrollments").select("*", { count: "exact", head: true }),
    supabase.from("payments").select("monto, estado"),
    supabase.from("contact_messages").select("*", { count: "exact", head: true }).eq("leido", false),
    supabase.from("blog_posts").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
  ]);

  const ingresos = (payments.data ?? [])
    .filter((p) => p.estado === "completado" || p.estado === "aprobado")
    .reduce((sum, p) => sum + Number(p.monto ?? 0), 0);

  return {
    programas: programs.count ?? 0,
    inscripciones: enrollments.count ?? 0,
    ingresos,
    mensajesPendientes: messages.count ?? 0,
    posts: posts.count ?? 0,
    usuarios: users.count ?? 0,
  };
}

function AdminIndex() {
  const { data } = useQuery({ queryKey: ["admin-stats"], queryFn: fetchStats });

  const cards = [
    { label: "Usuarios registrados", value: data?.usuarios ?? 0, icon: Users },
    { label: "Programas", value: data?.programas ?? 0, icon: GraduationCap },
    { label: "Inscripciones", value: data?.inscripciones ?? 0, icon: ClipboardList },
    {
      label: "Ingresos (DOP)",
      value: `RD$ ${(data?.ingresos ?? 0).toLocaleString("es-DO")}`,
      icon: CreditCard,
    },
    { label: "Mensajes sin leer", value: data?.mensajesPendientes ?? 0, icon: Mail },
    { label: "Artículos del blog", value: data?.posts ?? 0, icon: Newspaper },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resumen general</h1>
        <p className="text-muted-foreground">Indicadores principales de la plataforma.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-2 text-3xl font-bold">{c.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
