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
import { Label } from "@/components/ui/label";
import { Copy, Eye, EyeOff, KeyRound, MessageCircle, Search, UserPlus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  createStudentAccount,
  deleteUserAccount,
  getUsersAuthInfo,
  resetStudentPassword,
} from "@/lib/admin-users.functions";

const PALABRAS = [
  "Luna","Sol","Mar","Rio","Flor","Nube","Cielo","Bosque","Palma","Coral",
  "Faro","Duna","Ola","Viento","Perla","Ambar","Jade","Roca","Selva","Isla",
  "Aurora","Brisa","Canela","Arena","Lirio","Menta","Nieve","Puerto","Trigo","Valle",
];

function generarPassword(): string {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  const palabra = PALABRAS[buf[0]! % PALABRAS.length];
  const digitos = String(1000 + (buf[1]! % 9000));
  return `Ceapsi-${palabra}-${digitos}`;
}

function telefonoWhatsApp(telefono?: string | null): string {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  return digitos.length === 10 ? `1${digitos}` : digitos;
}

function mensajeCredenciales(email: string, password: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `Academia Ceapsi RD — Acceso: ${origin}/acceder · Correo: ${email} · Contraseña provisional: ${password} (deberás cambiarla al entrar)`;
}


export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosPage,
});

const roles = ["admin", "docente", "estudiante"] as const;

function UsuariosPage() {
  const { user: current } = useAuth();
  const qc = useQueryClient();
  const deleteUser = useServerFn(deleteUserAccount);
  const crearAlumno = useServerFn(createStudentAccount);
  const resetPassword = useServerFn(resetStudentPassword);

  const [search, setSearch] = useState("");
  const [filtroRol, setFiltroRol] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [creando, setCreando] = useState(false);
  const [verPass, setVerPass] = useState(false);
  const [form, setForm] = useState({
    nombre: "", apellido: "", email: "", telefono: "", password: "", programaId: "",
  });
  const [credenciales, setCredenciales] = useState<
    { email: string; password: string; telefono?: string | null } | null
  >(null);
  const [resetTarget, setResetTarget] = useState<{ id: string; nombre: string; email: string; telefono?: string | null } | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [reseteando, setReseteando] = useState(false);

  const { data: authInfo = [] } = useQuery({
    queryKey: ["admin", "usuarios", "auth"],
    queryFn: async () => await getUsersAuthInfo(),
  });
  const authByUser = useMemo(
    () => new Map(authInfo.map((a) => [a.id, a])),
    [authInfo],
  );

  const { data: programasDisponibles = [] } = useQuery({
    queryKey: ["admin", "usuarios", "programas"],
    queryFn: async () =>
      (
        await supabase
          .from("programs")
          .select("id,titulo,estado")
          .in("estado", ["publicado", "en_curso"])
          .order("titulo")
      ).data ?? [],
  });

  const abrirNuevo = () => {
    setForm({ nombre: "", apellido: "", email: "", telefono: "", password: generarPassword(), programaId: "" });
    setVerPass(false);
    setNuevoOpen(true);
  };

  const guardarAlumno = async () => {
    setCreando(true);
    try {
      const res = await crearAlumno({
        data: {
          nombre: form.nombre,
          apellido: form.apellido,
          email: form.email,
          telefono: form.telefono || undefined,
          password: form.password,
          programaId: form.programaId || undefined,
        },
      });
      if (res.enrollmentError) {
        toast.warning("Cuenta creada, pero no se pudo inscribir en el programa", {
          description: res.enrollmentError,
        });
      } else {
        toast.success("Cuenta creada");
      }
      setCredenciales({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        telefono: form.telefono,
      });
      setNuevoOpen(false);
      setForm({ nombre: "", apellido: "", email: "", telefono: "", password: "", programaId: "" });
      qc.invalidateQueries({ queryKey: ["admin", "usuarios"] });
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la cuenta");
    } finally {
      setCreando(false);
    }
  };

  const confirmarReset = async () => {
    if (!resetTarget) return;
    setReseteando(true);
    try {
      await resetPassword({ data: { userId: resetTarget.id, password: resetPass } });
      toast.success("Contraseña restablecida");
      setCredenciales({
        email: resetTarget.email,
        password: resetPass,
        telefono: resetTarget.telefono,
      });
      setResetTarget(null);
      setResetPass("");
      qc.invalidateQueries({ queryKey: ["admin", "usuarios", "auth"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo restablecer la contraseña");
    } finally {
      setReseteando(false);
    }
  };

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
      const correo = authByUser.get(p.id)?.email ?? "";
      const full = `${p.nombre} ${p.apellido} ${p.ciudad ?? ""} ${correo}`.toLowerCase();
      if (!full.includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <AdminPageHeader
        title="Usuarios"
        description="Gestiona perfiles, roles y estado de cuenta."
        action={
          <Button onClick={abrirNuevo}>
            <UserPlus className="mr-2 h-4 w-4" /> Nuevo alumno
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, ciudad o correo…"
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
                <TableHead>Correo</TableHead>
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
                    <TableCell className="font-medium">
                      {p.nombre} {p.apellido}
                      {authByUser.get(p.id)?.must_change_password && (
                        <Badge
                          variant="outline"
                          className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        >
                          Pendiente de cambio de contraseña
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {authByUser.get(p.id)?.email ?? "—"}
                    </TableCell>
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
                        {p.id !== current?.id && !userRoles.includes("admin") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Restablecer contraseña"
                            onClick={() => {
                              setResetTarget({
                                id: p.id,
                                nombre: `${p.nombre} ${p.apellido}`,
                                email: authByUser.get(p.id)?.email ?? "",
                                telefono: p.telefono,
                              });
                              setResetPass(generarPassword());
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        )}
                        {p.id !== current?.id && (
                          <DeleteButton
                            label={`la cuenta de ${p.nombre} ${p.apellido} y todos sus datos asociados`}
                            onConfirm={() => removeUser(p.id)}
                          />
                        )}

                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={nuevoOpen} onOpenChange={setNuevoOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo alumno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Apellido *</Label>
                <Input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Correo *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono (opcional)</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="809-000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Contraseña provisional *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={verPass ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPass((v) => !v)}
                    aria-label={verPass ? "Ocultar" : "Mostrar"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {verPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" onClick={() => setForm({ ...form, password: generarPassword() })}>
                  Generar
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Inscribir en programa (opcional)</Label>
              <Select
                value={form.programaId || "ninguno"}
                onValueChange={(v) => setForm({ ...form, programaId: v === "ninguno" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Sin programa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">Sin programa</SelectItem>
                  {programasDisponibles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNuevoOpen(false)}>Cancelar</Button>
              <Button onClick={guardarAlumno} disabled={creando}>
                {creando ? "Creando…" : "Crear cuenta"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) { setResetTarget(null); setResetPass(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se generará una contraseña provisional para {resetTarget?.nombre}. Deberá cambiarla al
              entrar.
            </p>
            <div className="space-y-2">
              <Label>Contraseña provisional</Label>
              <div className="flex gap-2">
                <Input value={resetPass} onChange={(e) => setResetPass(e.target.value)} />
                <Button type="button" variant="outline" onClick={() => setResetPass(generarPassword())}>
                  Generar
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setResetTarget(null); setResetPass(""); }}>
                Cancelar
              </Button>
              <Button onClick={confirmarReset} disabled={reseteando || resetPass.length < 8}>
                {reseteando ? "Guardando…" : "Restablecer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CredencialesDialog
        credenciales={credenciales}
        onClose={() => setCredenciales(null)}
      />

      <UserDetailDialog
        userId={detalleId}
        perfil={perfiles.find((p) => p.id === detalleId) ?? null}
        onClose={() => setDetalleId(null)}
      />
    </div>
  );
}

function CredencialesDialog({
  credenciales, onClose,
}: {
  credenciales: { email: string; password: string; telefono?: string | null } | null;
  onClose: () => void;
}) {
  const mensaje = credenciales
    ? mensajeCredenciales(credenciales.email, credenciales.password)
    : "";

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensaje);
      toast.success("Credenciales copiadas");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const whatsapp = () => {
    const tel = telefonoWhatsApp(credenciales?.telefono);
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={!!credenciales} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cuenta creada</DialogTitle>
        </DialogHeader>
        {credenciales && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input readOnly value={credenciales.email} className="h-12 text-lg" />
            </div>
            <div className="space-y-2">
              <Label>Contraseña provisional</Label>
              <Input readOnly value={credenciales.password} className="h-12 text-lg font-mono" />
            </div>
            <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              Esta contraseña solo se muestra ahora. No se guarda en el sistema.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copiar}>
                <Copy className="mr-2 h-4 w-4" /> Copiar credenciales
              </Button>
              <Button variant="outline" onClick={whatsapp}>
                <MessageCircle className="mr-2 h-4 w-4" /> Enviar por WhatsApp
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
