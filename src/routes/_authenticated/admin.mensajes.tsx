import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader, EmptyState } from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/mensajes")({
  component: MensajesPage,
});

function MensajesPage() {
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "mensajes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const marcarLeido = async (id: string) => {
    const { error } = await supabase.from("contact_messages").update({ leido: true }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin", "mensajes"] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Mensajes de contacto"
        description="Solicitudes recibidas desde el formulario público."
      />
      {rows.length === 0 ? (
        <EmptyState>No hay mensajes recibidos.</EmptyState>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article
              key={r.id}
              className={`rounded-lg border bg-card p-5 shadow-sm ${!r.leido ? "border-primary/40" : ""}`}
            >
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{r.asunto}</h3>
                  <p className="text-sm text-muted-foreground">
                    {r.nombre} · {r.email}
                    {r.telefono ? ` · ${r.telefono}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!r.leido && <Badge>Nuevo</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("es-DO")}
                  </span>
                </div>
              </header>
              <p className="mt-3 whitespace-pre-wrap text-sm">{r.mensaje}</p>
              {!r.leido && (
                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => marcarLeido(r.id)}>
                    Marcar como leído
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
