import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  GraduationCap, BookOpen, Users, LogOut, Calendar, Video,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/docente")({
  component: DocenteDashboard,
});

function DocenteDashboard() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const { data: teacher } = useQuery({
    queryKey: ["docente-record", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("teachers").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: programas = [] } = useQuery({
    queryKey: ["docente-programas", teacher?.id],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("programs")
        .select("*")
        .eq("docente_id", teacher!.id);
      return data ?? [];
    },
  });

  const { data: modulos = [] } = useQuery({
    queryKey: ["docente-modulos", teacher?.id, programas.map((p) => p.id)],
    enabled: !!teacher?.id,
    queryFn: async () => {
      // Módulos asignados directamente al docente OR de sus programas
      const programaIds = programas.map((p) => p.id);
      const queries = [];
      queries.push(supabase.from("program_modules").select("*").eq("docente_id", teacher!.id));
      if (programaIds.length) {
        queries.push(supabase.from("program_modules").select("*").in("programa_id", programaIds));
      }
      const results = await Promise.all(queries);
      const all = results.flatMap((r) => r.data ?? []);
      const seen = new Map(all.map((m) => [m.id, m]));
      return Array.from(seen.values()).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    },
  });

  const programaIds = programas.map((p) => p.id);
  const { data: enrollments = [] } = useQuery({
    queryKey: ["docente-enrollments", programaIds],
    enabled: programaIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id,programa_id,estado")
        .in("programa_id", programaIds);
      return data ?? [];
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando…</div>;
  }

  const sesionesEnVivo = modulos.filter((m) => m.es_en_vivo && m.fecha_sesion);
  const proximasSesiones = sesionesEnVivo
    .filter((m) => new Date(m.fecha_sesion!) >= new Date())
    .sort((a, b) => new Date(a.fecha_sesion!).getTime() - new Date(b.fecha_sesion!).getTime())
    .slice(0, 5);

  const pmap = new Map(programas.map((p) => [p.id, p]));

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
          <h1 className="text-2xl font-bold">Panel del Docente</h1>
          <p className="text-muted-foreground">Bienvenido, {teacher?.nombre ?? user?.nombre}.</p>
        </div>

        {!teacher && (
          <div className="rounded-lg border border-dashed bg-card p-6 text-sm text-muted-foreground">
            Tu cuenta aún no está vinculada a un perfil de docente. Solicita al
            administrador que asocie tu usuario para gestionar tus programas.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Programas a cargo" value={programas.length} icon={BookOpen} />
          <Stat label="Módulos" value={modulos.length} icon={GraduationCap} />
          <Stat label="Estudiantes inscritos" value={enrollments.length} icon={Users} />
        </div>

        {proximasSesiones.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Calendar className="h-5 w-5 text-primary" /> Próximas sesiones en vivo
            </h2>
            <div className="space-y-2">
              {proximasSesiones.map((m) => (
                <div key={m.id} className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4">
                  <div>
                    <p className="font-semibold">{m.titulo}</p>
                    <p className="text-sm text-muted-foreground">
                      {pmap.get(m.programa_id)?.titulo ?? "—"}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <Badge variant="outline" className="gap-1">
                      <Video className="h-3 w-3" /> Zoom
                    </Badge>
                    <p className="mt-1 text-muted-foreground">
                      {new Date(m.fecha_sesion!).toLocaleString("es-DO")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-bold">Mis programas</h2>
          {programas.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card p-10 text-center text-muted-foreground">
              No tienes programas asignados todavía.
            </div>
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Programa</TableHead>
                    <TableHead>Modalidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Inscritos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programas.map((p) => {
                    const inscritos = enrollments.filter((e) => e.programa_id === p.id).length;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.titulo}</TableCell>
                        <TableCell className="capitalize">{p.modalidad}</TableCell>
                        <TableCell><Badge variant="outline">{p.estado}</Badge></TableCell>
                        <TableCell>{inscritos}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">Módulos asignados</h2>
          {modulos.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card p-10 text-center text-muted-foreground">
              No tienes módulos asignados.
            </div>
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Programa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modulos.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.titulo}</TableCell>
                      <TableCell>{pmap.get(m.programa_id)?.titulo ?? "—"}</TableCell>
                      <TableCell>{m.es_en_vivo ? "En vivo (Zoom)" : "Grabado"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.fecha_sesion ? new Date(m.fecha_sesion).toLocaleString("es-DO") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
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
