import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Award, Eye, ExternalLink } from "lucide-react";
import { CertificatePreviewDialog } from "@/components/CertificatePreviewDialog";
import { buildVerifyUrl } from "@/lib/certificate-pdf";
import { registrarActividad } from "@/lib/audit-client";
import type { CertificateTemplateData } from "@/components/CertificateTemplate";

export const Route = createFileRoute("/_authenticated/certificados")({
  component: MisCertificados,
});

function MisCertificados() {
  const { user } = useAuth();
  const [previewData, setPreviewData] = useState<CertificateTemplateData | null>(null);

  const { data: certificados = [], isLoading } = useQuery({
    queryKey: ["mis-certificados", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("certificates")
        .select("id, numero_certificado, fecha_emision, estado, programa_id, verification_code")
        .eq("user_id", user!.id)
        .order("fecha_emision", { ascending: false });
      if (!data || data.length === 0) return [];

      const programIds = data.map((c) => c.programa_id);
      const { data: programas } = await supabase
        .from("programs")
        .select("id, titulo, duracion_horas, tipo")
        .in("id", programIds);

      return data.map((c) => ({
        ...c,
        programa: programas?.find((p) => p.id === c.programa_id),
      }));
    },
  });

  const openPreview = (cert: (typeof certificados)[number]) => {
    const code = (cert as any).verification_code ?? cert.numero_certificado;
    registrarActividad({
      accion: "descargar_certificado",
      entidad: "certificates",
      entidadId: cert.id,
      etiqueta: cert.numero_certificado,
      programaId: cert.programa_id,
    });
    setPreviewData({
      studentName:
        `${user?.nombre ?? ""} ${user?.apellido ?? ""}`.trim() || "Estudiante",
      programTitle: cert.programa?.titulo ?? "Programa Académico",
      programType: cert.programa?.tipo,
      durationHours: cert.programa?.duracion_horas,
      issueDate: cert.fecha_emision,
      verificationCode: code,
      certificateNumber: cert.numero_certificado,
      verifyUrl: buildVerifyUrl(code),
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold">Mis Certificados</h1>
        <p className="text-muted-foreground">
          Descarga e imparte tus logros académicos verificables con código QR.
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
          {certificados.map((cert) => {
            const code = (cert as any).verification_code ?? cert.numero_certificado;
            return (
              <li key={cert.id} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Award className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold leading-tight">{cert.programa?.titulo}</h2>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {cert.numero_certificado}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Emitido el{" "}
                      {new Date(cert.fecha_emision).toLocaleDateString("es-DO", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => openPreview(cert)}>
                    <Eye className="mr-2 h-4 w-4" /> Ver / descargar
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/verify/${code}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CertificatePreviewDialog
        open={!!previewData}
        onOpenChange={(o) => !o && setPreviewData(null)}
        data={previewData}
      />
    </div>
  );
}
