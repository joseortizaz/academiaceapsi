import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Award, Download, ExternalLink } from "lucide-react";
import { generarCertificadoPDF } from "@/lib/certificate-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/certificados")({
  component: MisCertificados,
});

function MisCertificados() {
  const { user, profile } = useAuth();

  const { data: certificados = [], isLoading } = useQuery({
    queryKey: ["mis-certificados", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("certificates")
        .select("id, numero_certificado, fecha_emision, estado, programa_id")
        .eq("user_id", user!.id)
        .order("fecha_emision", { ascending: false });
      if (!data || data.length === 0) return [];

      const programIds = data.map((c) => c.programa_id);
      const { data: programas } = await supabase
        .from("programs")
        .select("id, titulo, duracion_horas, docente_id")
        .in("id", programIds);

      const teacherIds = (programas ?? []).map((p) => p.docente_id).filter(Boolean) as string[];
      const { data: docentes } = teacherIds.length
        ? await supabase.from("teachers").select("id, nombre, apellido").in("id", teacherIds)
        : { data: [] as any[] };

      return data.map((c) => {
        const prog = programas?.find((p) => p.id === c.programa_id);
        const doc = docentes?.find((d) => d.id === prog?.docente_id);
        return {
          ...c,
          programa: prog,
          docente: doc ? `${doc.nombre} ${doc.apellido}` : null,
        };
      });
    },
  });

  const descargar = (cert: (typeof certificados)[number]) => {
    if (!profile) {
      toast.error("Carga tu perfil antes de generar el certificado.");
      return;
    }
    generarCertificadoPDF({
      numero: cert.numero_certificado,
      nombreCompleto: `${profile.nombre} ${profile.apellido}`.trim(),
      tituloPrograma: cert.programa?.titulo ?? "Programa Académico",
      duracionHoras: cert.programa?.duracion_horas,
      fechaEmision: cert.fecha_emision,
      docente: cert.docente,
      verificacionUrl: `${window.location.origin}/verificar/${cert.numero_certificado}`,
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold">Mis Certificados</h1>
        <p className="text-muted-foreground">
          Descarga e imparte tus logros académicos verificables.
        </p>
      </header>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : certificados.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center">
          <Award className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">Aún no tienes certificados emitidos</p>
          <p className="text-sm text-muted-foreground">
            Completa el 100% de un programa para obtener tu certificado oficial.
          </p>
          <Button asChild className="mt-4">
            <Link to="/mis-cursos">Ver mis cursos</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {certificados.map((cert) => (
            <li key={cert.id} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold leading-tight">{cert.programa?.titulo}</h2>
                  <p className="mt-1 text-xs font-mono text-muted-foreground">
                    {cert.numero_certificado}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Emitido el{" "}
                    {new Date(cert.fecha_emision).toLocaleDateString("es-DO", {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => descargar(cert)}>
                  <Download className="mr-2 h-4 w-4" /> Descargar PDF
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/verificar/$numero" params={{ numero: cert.numero_certificado }}>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
