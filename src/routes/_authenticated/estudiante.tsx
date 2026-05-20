import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap, BookOpen, Award, LogOut, Megaphone, Calendar,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/estudiante")({
  component: EstudianteDashboard,
});

function EstudianteDashboard() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["estudiante-dash", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [enrolls, certs, announcements] = await Promise.all([
        supabase.from("enrollments").select("*").eq("user_id", user!.id),
        supabase.from("certificates").select("*").eq("user_id", user!.id),
        supabase
          .from("announcements")
          .select("*")
          .eq("activo", true)
          .order("fecha_publicacion", { ascending: false })
          .limit(5),
      ]);
      const programaIds = (enrolls.data ?? []).map((e) => e.programa_id);
      const programs = programaIds.length
        ? (await supabase
            .from("programs")
            .select("id,titulo,slug,imagen_url,fecha_inicio")
            .in("id", programaIds)).data ?? []
        : [];
      const pmap = new Map(programs.map((p) => [p.id, p]));
      return {
        enrollments: (enrolls.data ?? []).map((e) => ({ ...e, programa: pmap.get(e.programa_id) })),
        certificates: certs.data ?? [],
        announcements: announcements.data ?? [],
      };
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const enrollments = data?.enrollments ?? [];
  const activos = enrollments.filter((e) => e.estado === "activo");
  const promedio = activos.length
    ? Math.round(activos.reduce((s, e) => s + (e.progreso_porcentaje ?? 0), 0) / activos.length)
    : 0;

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando…</div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="font-bold text-primary">Academia Ceapsi RD</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.nombre} {user?.apellido}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 p-6">
        <div>
          <h1 className="text-2xl font-bold">¡Hola, {user?.nombre}!</h1>
          <p className="text-muted-foreground">Continúa tu formación profesional.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Cursos activos" value={activos.length} icon={BookOpen} />
          <Stat label="Inscripciones" value={enrollments.length} icon={GraduationCap} />
          <Stat label="Progreso promedio" value={`${promedio}%`} icon={Calendar} />
          <Stat label="Certificados" value={data?.certificates.length ?? 0} icon={Award} />
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Mis cursos</h2>
            <Button asChild variant="outline" size="sm">
              <Link to="/mis-cursos">Ver todos</Link>
            </Button>
          </div>
          {enrollments.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card p-10 text-center">
              <p className="text-muted-foreground">Aún no estás inscrito en ningún programa.</p>
              <Button asChild className="mt-4">
                <Link to="/programas">Explorar catálogo</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {enrollments.slice(0, 6).map((e) => (
                <Link
                  key={e.id}
                  to={e.estado === "activo" ? "/mis-cursos/$slug" : "/mis-cursos"}
                  params={e.estado === "activo" ? { slug: e.programa?.slug ?? "" } : undefined}
                  className="block overflow-hidden rounded-lg border bg-card transition hover:shadow-md"
                >
                  <div className="aspect-video bg-muted">
                    {e.programa?.imagen_url && (
                      <img src={e.programa.imagen_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="space-y-2 p-4">
                    <Badge variant={e.estado === "activo" ? "default" : "secondary"}>{e.estado}</Badge>
                    <h3 className="line-clamp-2 font-semibold">{e.programa?.titulo}</h3>
                    <Progress value={e.progreso_porcentaje ?? 0} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {(data?.announcements ?? []).length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Megaphone className="h-5 w-5 text-primary" /> Anuncios
            </h2>
            <div className="space-y-3">
              {data!.announcements.map((a) => (
                <article key={a.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{a.titulo}</h3>
                    <Badge variant="outline">{a.tipo}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.contenido}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
