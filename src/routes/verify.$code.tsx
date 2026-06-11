import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Award, CheckCircle2, XCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CertificatePreviewDialog } from "@/components/CertificatePreviewDialog";
import { buildVerifyUrl } from "@/lib/certificate-pdf";

export const Route = createFileRoute("/verify/$code")({
  component: VerifyCertificate,
  head: () => ({
    meta: [
      { title: "Verificación de Certificado | Academia Ceapsi RD" },
      {
        name: "description",
        content:
          "Verifica la autenticidad de un certificado emitido por Academia Ceapsi RD escaneando su código QR.",
      },
    ],
  }),
});

function VerifyCertificate() {
  const { code } = Route.useParams();
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["verify-cert", code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("verify_certificate", { _code: code });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ?? null;
    },
  });

  const isValid = !!data && data.estado === "emitido";

  return (
    <PublicLayout>
      <section className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="text-center">
            <Award className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-3 text-2xl font-bold">Verificación de Certificado</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Código consultado: <span className="font-mono">{code}</span>
            </p>
          </div>

          {isLoading ? (
            <p className="mt-8 text-center text-muted-foreground">Verificando…</p>
          ) : isValid && data ? (
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                <CheckCircle2 className="h-6 w-6 shrink-0" />
                <div>
                  <p className="font-semibold">Certificado Válido y Verificado</p>
                  <p className="text-sm">
                    Este código corresponde a un certificado emitido oficialmente por Academia Ceapsi RD.
                  </p>
                </div>
              </div>

              <dl className="grid gap-3 text-sm">
                <Row label="Estudiante" value={data.student_name} />
                <Row label="Programa" value={data.programa_titulo} />
                {data.programa_duracion_horas && (
                  <Row label="Duración" value={`${data.programa_duracion_horas} horas`} />
                )}
                <Row
                  label="Fecha de emisión"
                  value={new Date(data.fecha_emision).toLocaleDateString("es-DO", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
                <Row label="Número" value={data.numero_certificado} mono />
              </dl>

              <div className="pt-2">
                <Button className="w-full" onClick={() => setPreviewOpen(true)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver / descargar certificado
                </Button>
              </div>

              <CertificatePreviewDialog
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                data={{
                  studentName: data.student_name,
                  programTitle: data.programa_titulo,
                  programType: data.programa_tipo,
                  durationHours: data.programa_duracion_horas,
                  issueDate: data.fecha_emision,
                  verificationCode: data.verification_code,
                  certificateNumber: data.numero_certificado,
                  verifyUrl: buildVerifyUrl(data.verification_code),
                }}
              />
            </div>
          ) : (
            <div className="mt-8 flex items-center gap-3 rounded-lg bg-destructive/10 p-4 text-destructive">
              <XCircle className="h-6 w-6 shrink-0" />
              <div>
                <p className="font-semibold">Certificado no verificado</p>
                <p className="text-sm">
                  El código ingresado no corresponde a ningún certificado en nuestros registros
                  oficiales. Verifica que esté escrito correctamente.
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <Button asChild variant="outline">
              <Link to="/">Volver al inicio</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
