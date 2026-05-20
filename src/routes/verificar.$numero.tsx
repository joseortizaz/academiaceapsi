import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Award, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/verificar/$numero")({
  component: VerificarCertificado,
  head: () => ({
    meta: [
      { title: "Verificación de Certificado | Academia Ceapsi RD" },
      { name: "description", content: "Verifica la autenticidad de un certificado emitido por Academia Ceapsi RD." },
    ],
  }),
});

function VerificarCertificado() {
  const { numero } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["verify-cert", numero],
    queryFn: async () => {
      const { data: cert } = await supabase
        .from("certificates")
        .select("numero_certificado, fecha_emision, estado, programa_id, user_id")
        .eq("numero_certificado", numero)
        .maybeSingle();

      if (!cert) return null;

      const [{ data: programa }, { data: profile }] = await Promise.all([
        supabase.from("programs").select("titulo, duracion_horas").eq("id", cert.programa_id).maybeSingle(),
        supabase.from("profiles").select("nombre, apellido").eq("id", cert.user_id).maybeSingle(),
      ]);

      return { cert, programa, profile };
    },
  });

  return (
    <PublicLayout>
      <section className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="text-center">
            <Award className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-3 text-2xl font-bold">Verificación de Certificado</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Código consultado: <span className="font-mono">{numero}</span>
            </p>
          </div>

          {isLoading ? (
            <p className="mt-8 text-center text-muted-foreground">Verificando…</p>
          ) : data ? (
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-4 text-emerald-900">
                <CheckCircle2 className="h-6 w-6" />
                <div>
                  <p className="font-semibold">Certificado válido</p>
                  <p className="text-sm">Este código corresponde a un certificado emitido oficialmente.</p>
                </div>
              </div>
              <dl className="grid gap-3 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <dt className="text-muted-foreground">Estudiante</dt>
                  <dd className="font-medium">
                    {data.profile?.nombre} {data.profile?.apellido}
                  </dd>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <dt className="text-muted-foreground">Programa</dt>
                  <dd className="font-medium text-right">{data.programa?.titulo}</dd>
                </div>
                {data.programa?.duracion_horas && (
                  <div className="flex justify-between border-b pb-2">
                    <dt className="text-muted-foreground">Duración</dt>
                    <dd className="font-medium">{data.programa.duracion_horas} horas</dd>
                  </div>
                )}
                <div className="flex justify-between border-b pb-2">
                  <dt className="text-muted-foreground">Fecha de emisión</dt>
                  <dd className="font-medium">
                    {new Date(data.cert.fecha_emision).toLocaleDateString("es-DO", {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Estado</dt>
                  <dd className="font-medium capitalize">{data.cert.estado}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="mt-8 flex items-center gap-3 rounded-lg bg-destructive/10 p-4 text-destructive">
              <XCircle className="h-6 w-6" />
              <div>
                <p className="font-semibold">Certificado no encontrado</p>
                <p className="text-sm">El código ingresado no corresponde a ningún certificado emitido.</p>
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
