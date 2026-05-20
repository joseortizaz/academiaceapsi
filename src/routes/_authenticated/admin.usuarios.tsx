import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AdminPageHeader, EmptyState } from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosPage,
});

const roles = ["admin", "docente", "estudiante"] as const;

function UsuariosPage() {
  const { user: current } = useAuth();
  const qc = useQueryClient();

  const { data: perfiles = [] } = useQuery({
    queryKey: ["admin", "usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rolesData = [] } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: async () => (await supabase.from("user_roles").select("user_id,role")).data ?? [],
  });

  const rolesByUser = new Map<string, string[]>();
  for (const r of rolesData) {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role);
    rolesByUser.set(r.user_id, arr);
  }

  const toggleRole = async (userId: string, role: (typeof roles)[number], has: boolean) => {
    if (has) {
      const { error } = await supabase
        .from("user_roles").delete()
        .eq("user_id", userId).eq("role", role);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("user_roles").insert({ user_id: userId, role, assigned_by: current?.id });
      if (error) return toast.error(error.message);
    }
    toast.success("Roles actualizados");
    qc.invalidateQueries({ queryKey: ["admin", "roles"] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Usuarios"
        description="Gestiona perfiles y asigna roles del sistema."
      />
      {perfiles.length === 0 ? (
        <EmptyState>No hay usuarios registrados.</EmptyState>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perfiles.map((p) => {
                const userRoles = rolesByUser.get(p.id) ?? [];
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nombre} {p.apellido}</TableCell>
                    <TableCell>{p.ciudad ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("es-DO")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length === 0 && <span className="text-xs text-muted-foreground">Sin rol</span>}
                        {userRoles.map((r) => (
                          <Badge key={r} variant={r === "admin" ? "default" : "outline"}>{r}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {roles.map((r) => {
                          const has = userRoles.includes(r);
                          return (
                            <Button
                              key={r}
                              size="sm"
                              variant={has ? "default" : "outline"}
                              onClick={() => toggleRole(p.id, r, has)}
                            >
                              {has ? "− " : "+ "}{r}
                            </Button>
                          );
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
