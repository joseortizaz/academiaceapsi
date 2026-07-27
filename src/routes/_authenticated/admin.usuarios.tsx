import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AdminPageHeader, EmptyState, DeleteButton } from "@/components/admin/AdminUI";
import { Eye, Search } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { deleteUserAccount } from "@/lib/admin-users.functions";


export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosPage,
});

const roles = ["admin", "docente", "estudiante"] as const;

function UsuariosPage() {
  const { user: current } = useAuth();
  const qc = useQueryClient();
  const deleteUser = useServerFn(deleteUserAccount);

  const [search, setSearch] = useState("");
  const [filtroRol, setFiltroRol] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const { data: perfiles = [] } = useQuery({
    queryKey: ["admin", "usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rolesData = [] } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: async () => (await supabase.from("user_roles").select("user_id,role")).data ?? [],
  });

  const rolesByUser = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of rolesData) {
      const arr = m.get(r.user_id) ?? [];
      arr.push(r.role);
      m.set(r.user_id, arr);
    }
    return m;
  }, [rolesData]);

  const toggleRole = async (userId: string, role: (typeof roles)[number], has: boolean) => {
    if (has) {
      const { error } = await supabase.from("user_roles").delete()
        .eq("user_id", userId).eq("role", role);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles")
        .insert({ user_id: userId, role, assigned_by: current?.id });
      if (error) return toast.error(error.message);
    }
    toast.success("Roles actualizados");
    qc.invalidateQueries({ queryKey: ["admin", "roles"] });
  };

  const toggleEstado = async (id: string, current: boolean) => {
    const { error } = await supabase.from("profiles")
      .update({ is_active: !current }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(current ? "Usuario suspendido" : "Usuario activado");
    qc.invalidateQueries({ queryKey: ["admin", "usuarios"] });
  };

  const removeUser = async (id: string) => {
    try {
      await deleteUser({ data: { userId: id } });
      toast.success("Usuario eliminado");
      qc.invalidateQueries({ queryKey: ["admin", "usuarios"] });
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar el usuario");
    }
  };


  const filtrados = perfiles.filter((p) => {
    const userRoles = rolesByUser.get(p.id) ?? [];
    if (filtroRol !== "todos" && !userRoles.includes(filtroRol)) return false;
    if (filtroEstado === "activos" && p.is_active === false) return false;
    if (filtroEstado === "suspendidos" && p.is_active !== false) return false;
    if (search) {
      const q = search.toLowerCase();
      const full = `${p.nombre} ${p.apellido} ${p.ciudad ?? ""}`.toLowerCase();
      if (!full.includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <AdminPageHeader
        title="Usuarios"
        description="Gestiona perfiles, roles y estado de cuenta."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o ciudad…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroRol} onValueChange={setFiltroRol}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los roles</SelectItem>
            <SelectItem value="admin">Administradores</SelectItem>
            <SelectItem value="docente">Profesores</SelectItem>
            <SelectItem value="estudiante">Estudiantes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="activos">Activos</SelectItem>
            <SelectItem value="suspendidos">Suspendidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState>No hay usuarios que coincidan con los filtros.</EmptyState>
      ) : (
        <div className="max-h-[640px] overflow-auto rounded-lg border bg-card">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((p) => {
                const userRoles = rolesByUser.get(p.id) ?? [];
                const activo = p.is_active !== false;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nombre} {p.apellido}</TableCell>
                    <TableCell>{p.ciudad ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("es-DO")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={activo} onCheckedChange={() => toggleEstado(p.id, activo)} />
                        <Badge
                          className={
                            activo
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
                          }
                          variant="outline"
                        >
                          {activo ? "Activo" : "Suspendido"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length === 0 && (
                          <span className="text-xs text-muted-foreground">Sin rol</span>
                        )}
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
                              key={r} size="sm"
                              variant={has ? "default" : "outline"}
                              onClick={() => toggleRole(p.id, r, has)}
                            >
                              {has ? "− " : "+ "}{r}
                            </Button>
                          );
                        })}
                        <Button size="sm" variant="ghost" onClick={() => setDetalleId(p.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <UserDetailDialog
        userId={detalleId}
        perfil={perfiles.find((p) => p.id === detalleId) ?? null}
        onClose={() => setDetalleId(null)}
      />
    </div>
  );
}

function UserDetailDialog({
  userId, perfil, onClose,
}: { userId: string | null; perfil: any; onClose: () => void }) {
  const { data: inscripciones = [] } = useQuery({
    queryKey: ["admin", "usuarios", "detalle", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments").select("*")
        .eq("user_id", userId!)
        .order("fecha_inscripcion", { ascending: false });
      return data ?? [];
    },
  });

  const programaIds = [...new Set(inscripciones.map((i) => i.programa_id))];
  const { data: programas = [] } = useQuery({
    queryKey: ["admin", "programas", "detalle", programaIds.length],
    enabled: programaIds.length > 0,
    queryFn: async () =>
      (await supabase.from("programs").select("id,titulo").in("id", programaIds)).data ?? [],
  });
  const pMap = new Map(programas.map((p: any) => [p.id, p.titulo]));

  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {perfil ? `${perfil.nombre} ${perfil.apellido}` : "Detalle de usuario"}
          </DialogTitle>
        </DialogHeader>
        {perfil && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Teléfono: </span>{perfil.telefono ?? "—"}</div>
              <div><span className="text-muted-foreground">Ciudad: </span>{perfil.ciudad ?? "—"}</div>
              <div><span className="text-muted-foreground">País: </span>{perfil.pais ?? "—"}</div>
              <div><span className="text-muted-foreground">Especialidad: </span>{perfil.especialidad ?? "—"}</div>
            </div>
            {perfil.bio && (
              <div>
                <p className="text-sm font-medium">Bio</p>
                <p className="text-sm text-muted-foreground">{perfil.bio}</p>
              </div>
            )}
            <div>
              <p className="mb-2 text-sm font-semibold">Cursos inscritos ({inscripciones.length})</p>
              {inscripciones.length === 0 ? (
                <p className="text-sm text-muted-foreground">Este usuario no tiene inscripciones.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Programa</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Progreso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inscripciones.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell>{pMap.get(i.programa_id) ?? "—"}</TableCell>
                          <TableCell><Badge variant="outline">{i.estado}</Badge></TableCell>
                          <TableCell>{i.progreso_porcentaje}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
