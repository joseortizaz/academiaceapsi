import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Users, Calendar, MapPin, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/docente/grupos")({
  head: () => ({
    meta: [
      { title: "Mis grupos docentes — Academia Ceapsi" },
      { name: "description", content: "Consulta y gestión de los grupos asignados al docente en Academia Ceapsi." },
      { property: "og:title", content: "Mis grupos docentes — Academia Ceapsi" },
      { property: "og:description", content: "Consulta y gestión de los grupos asignados al docente en Academia Ceapsi." },
    ],
  }),
  component: DocenteGrupos,
});

function formatStudentName(enrollment: any, profile?: any) {
  const profileName = [profile?.nombre, profile?.apellido].filter(Boolean).join(" ").trim();
  return profileName || enrollment.nombre_completo || enrollment.email_contacto || "Alumno sin nombre";
}

function DocenteGrupos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);

  const { data: teacher } = useQuery({
    queryKey: ["docente-me", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("teachers").select("id").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: cohorts = [] } = useQuery({
    queryKey: ["docente-cohorts", teacher?.id],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_cohorts" as any)
        .select("*, programs(titulo,slug,tipo)")
        .eq("docente_id", teacher!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const save = async (patch: any) => {
    const { error } = await supabase
      .from("program_cohorts" as any)
      .update({
        nivel_actual: patch.nivel_actual || null,
        horario: patch.horario || null,
        dias_clase: patch.dias_clase ?? [],
      })
      .eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Grupo actualizado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["docente-cohorts"] });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Mis grupos</h1>
        <p className="text-muted-foreground">Grupos donde eres docente titular.</p>
      </header>

      {cohorts.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center text-muted-foreground">
          Aún no tienes grupos asignados.
        </div>
      ) : (
        <div className="grid gap-4">
          {cohorts.map((c: any) => (
            <CohortCard key={c.id} cohort={c} onEdit={() => setEditing(c)} />
          ))}
        </div>
      )}

      {editing && (
        <EditCohortDialog cohort={editing} onClose={() => setEditing(null)} onSave={save} />
      )}
    </div>
  );
}

function CohortCard({ cohort, onEdit }: { cohort: any; onEdit: () => void }) {
  const { data: members = [] } = useQuery({
    queryKey: ["docente-cohort-members", cohort.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cohort_enrollments" as any)
        .select("*")
        .eq("cohort_id", cohort.id)
        .eq("estado", "activo");
      return (data as any[]) ?? [];
    },
  });

  const enrollmentIds = members.map((m: any) => m.enrollment_id);
  const { data: enrolls = [] } = useQuery({
    queryKey: ["docente-cohort-enrolls", cohort.id, enrollmentIds.length],
    enabled: enrollmentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id,nombre_completo,email_contacto,user_id")
        .in("id", enrollmentIds);
      return data ?? [];
    },
  });

  const userIds = enrolls.map((e: any) => e.user_id).filter(Boolean);
  const { data: profilesById = new Map<string, any>() } = useQuery({
    queryKey: ["docente-cohort-member-profiles", cohort.id, userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("profiles_public")
        .select("id,nombre,apellido")
        .in("id", userIds);
      if (error) throw error;
      return new Map(((data as any[]) ?? []).map((profile) => [profile.id, profile]));
    },
  });

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{cohort.nombre}</h2>
            <Badge variant="outline" className="capitalize">{cohort.modalidad}</Badge>
            <Badge variant="secondary">{cohort.estado}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{cohort.programs?.titulo}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="mr-1 h-4 w-4" /> Editar
        </Button>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Nivel actual</p>
          <p>{cohort.nivel_actual ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Horario</p>
          <p className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {cohort.horario ?? "—"}</p>
        </div>
        {cohort.ubicacion && (
          <div className="sm:col-span-2">
            <p className="text-xs uppercase text-muted-foreground">Ubicación</p>
            <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {cohort.ubicacion}</p>
          </div>
        )}
        {Array.isArray(cohort.dias_clase) && cohort.dias_clase.length > 0 && (
          <div className="sm:col-span-2">
            <p className="text-xs uppercase text-muted-foreground">Fechas de clase</p>
            <p className="text-xs">{cohort.dias_clase.join(" · ")}</p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1 text-sm font-bold">
          <Users className="h-4 w-4" /> Alumnos ({enrolls.length})
        </p>
        {enrolls.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin alumnos asignados.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {enrolls.map((e: any) => (
              <li key={e.id} className="rounded border px-3 py-1.5">
                {formatStudentName(e, profilesById.get(e.user_id))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function EditCohortDialog({
  cohort, onClose, onSave,
}: { cohort: any; onClose: () => void; onSave: (p: any) => Promise<void> }) {
  const [state, setState] = useState({
    nivel_actual: cohort.nivel_actual ?? "",
    horario: cohort.horario ?? "",
    dias_clase: Array.isArray(cohort.dias_clase) ? cohort.dias_clase.join("\n") : "",
  });
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Actualizar grupo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Nivel actual</Label>
            <Input value={state.nivel_actual} onChange={(e) => setState({ ...state, nivel_actual: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Horario</Label>
            <Input value={state.horario} onChange={(e) => setState({ ...state, horario: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Fechas de clase (una por línea)</Label>
            <textarea
              className="min-h-[100px] rounded-md border bg-background p-2 text-sm"
              value={state.dias_clase}
              onChange={(e) => setState({ ...state, dias_clase: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await onSave({
                  ...state,
                  dias_clase: state.dias_clase.split("\n").map((l: string) => l.trim()).filter(Boolean),
                });
              } finally { setLoading(false); }
            }}
          >
            {loading ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
