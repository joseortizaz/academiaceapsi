import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Save, KeyRound, Receipt } from "lucide-react";
import { AvatarUploader } from "@/components/AvatarUploader";

export const Route = createFileRoute("/_authenticated/estudiante/cuenta")({
  component: MiCuenta,
});

function MiCuenta() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    nombre: "", apellido: "", telefono: "", ciudad: "", bio: "", avatar_url: "",
  });
  const [pw, setPw] = useState({ nueva: "", repetir: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        nombre: user.nombre ?? "",
        apellido: user.apellido ?? "",
        telefono: (user as any).telefono ?? "",
        ciudad: (user as any).ciudad ?? "",
        bio: (user as any).bio ?? "",
        avatar_url: (user as any).avatar_url ?? "",
      });
    }
  }, [user]);

  const { data: pagos = [] } = useQuery({
    queryKey: ["mis-pagos", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: pagos } = await supabase
        .from("payments")
        .select("id, programa_id, fecha_pago, created_at, monto, moneda, metodo, estado")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      const ids = (pagos ?? []).map((p) => p.programa_id);
      const programas = ids.length
        ? (await supabase.from("programs").select("id,titulo").in("id", ids)).data ?? []
        : [];
      const map = new Map(programas.map((p) => [p.id, p]));
      return (pagos ?? []).map((p) => ({ ...p, programa: map.get(p.programa_id) }));
    },
  });

  const handleSavePerfil = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        nombre: form.nombre,
        apellido: form.apellido,
        telefono: form.telefono || null,
        ciudad: form.ciudad || null,
        bio: form.bio || null,
        avatar_url: form.avatar_url || null,
      }).eq("id", user.id);
      if (error) throw error;
      toast.success("Perfil actualizado");
      qc.invalidateQueries({ queryKey: ["auth", "profile"] });
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo actualizar");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (pw.nueva.length < 6) return toast.error("Mínimo 6 caracteres");
    if (pw.nueva !== pw.repetir) return toast.error("Las contraseñas no coinciden");
    const { error } = await supabase.auth.updateUser({ password: pw.nueva });
    if (error) return toast.error(error.message);
    toast.success("Contraseña actualizada");
    setPw({ nueva: "", repetir: "" });
  };

  const iniciales = `${form.nombre?.[0] ?? ""}${form.apellido?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mi Cuenta</h1>
        <p className="text-muted-foreground">Gestiona tu perfil y revisa tu historial de pagos.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Datos personales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={form.avatar_url} />
                <AvatarFallback className="text-lg">{iniciales || "U"}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Label htmlFor="avatar">URL de foto de perfil</Label>
                <Input
                  id="avatar"
                  placeholder="https://…"
                  value={form.avatar_url}
                  onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
              <Field label="Apellido" value={form.apellido} onChange={(v) => setForm({ ...form, apellido: v })} />
              <Field label="Teléfono" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} />
              <Field label="Ciudad" value={form.ciudad} onChange={(v) => setForm({ ...form, ciudad: v })} />
            </div>

            <div>
              <Label>Correo</Label>
              <Input value={(user as any)?.email ?? ""} disabled />
              <p className="mt-1 text-xs text-muted-foreground">
                El correo no puede modificarse desde aquí.
              </p>
            </div>

            <div>
              <Label htmlFor="bio">Biografía</Label>
              <Textarea
                id="bio"
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>

            <Button onClick={handleSavePerfil} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Cambiar contraseña
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nueva contraseña</Label>
              <Input
                type="password"
                value={pw.nueva}
                onChange={(e) => setPw({ ...pw, nueva: e.target.value })}
              />
            </div>
            <div>
              <Label>Repetir</Label>
              <Input
                type="password"
                value={pw.repetir}
                onChange={(e) => setPw({ ...pw, repetir: e.target.value })}
              />
            </div>
            <Button variant="outline" className="w-full" onClick={handleChangePassword}>
              Actualizar contraseña
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> Historial de facturación
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {pagos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aún no tienes transacciones registradas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Programa</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Recibo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(p.fecha_pago ?? p.created_at).toLocaleDateString("es-DO")}
                    </TableCell>
                    <TableCell className="font-medium">{p.programa?.titulo ?? "—"}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {p.metodo ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {`${p.moneda ?? "RD$"} ${Number(p.monto ?? 0).toLocaleString("es-DO")}`}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={p.estado === "verificado" ? "default" : "secondary"}
                        className={
                          p.estado === "verificado"
                            ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20"
                            : ""
                        }
                      >
                        {p.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => toast.info("Recibo en preparación")}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
