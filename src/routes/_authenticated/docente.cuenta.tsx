import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, KeyRound } from "lucide-react";
import { AvatarUploader } from "@/components/AvatarUploader";

export const Route = createFileRoute("/_authenticated/docente/cuenta")({
  component: CuentaDocente,
});

function CuentaDocente() {
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

  const iniciales = `${form.nombre?.[0] ?? ""}${form.apellido?.[0] ?? ""}`.toUpperCase();

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        nombre: form.nombre,
        apellido: form.apellido,
        telefono: form.telefono || null,
        ciudad: form.ciudad || null,
        bio: form.bio || null,
      }).eq("id", user.id);
      if (error) throw error;
      toast.success("Perfil actualizado");
      qc.invalidateQueries({ queryKey: ["auth", "profile"] });
      qc.invalidateQueries({ queryKey: ["public", "teachers"] });
      qc.invalidateQueries({ queryKey: ["admin", "docentes"] });
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo actualizar");
    } finally { setSaving(false); }
  };


  const handleChangePassword = async () => {
    if (pw.nueva.length < 6) return toast.error("Mínimo 6 caracteres");
    if (pw.nueva !== pw.repetir) return toast.error("Las contraseñas no coinciden");
    const { error } = await supabase.auth.updateUser({ password: pw.nueva });
    if (error) return toast.error(error.message);
    toast.success("Contraseña actualizada");
    setPw({ nueva: "", repetir: "" });
  };

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mi Cuenta</h1>
        <p className="text-muted-foreground">Actualiza tu perfil docente y foto de perfil.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Datos personales</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <AvatarUploader
              userId={user.id}
              url={form.avatar_url}
              fallback={iniciales || "D"}
              onChange={async (newUrl) => {
                setForm((f) => ({ ...f, avatar_url: newUrl ?? "" }));
                qc.invalidateQueries({ queryKey: ["auth", "profile"] });
                qc.invalidateQueries({ queryKey: ["public", "teachers"] });
                qc.invalidateQueries({ queryKey: ["admin", "docentes"] });
              }}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
              <Field label="Apellido" value={form.apellido} onChange={(v) => setForm({ ...form, apellido: v })} />
              <Field label="Teléfono" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} />
              <Field label="Ciudad" value={form.ciudad} onChange={(v) => setForm({ ...form, ciudad: v })} />
            </div>

            <div>
              <Label>Correo</Label>
              <Input value={(user as any)?.email ?? ""} disabled />
            </div>

            <div>
              <Label htmlFor="bio">Biografía profesional</Label>
              <Textarea id="bio" rows={4} value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>

            <Button onClick={handleSave} disabled={saving}>
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
              <Input type="password" value={pw.nueva}
                onChange={(e) => setPw({ ...pw, nueva: e.target.value })} />
            </div>
            <div>
              <Label>Repetir</Label>
              <Input type="password" value={pw.repetir}
                onChange={(e) => setPw({ ...pw, repetir: e.target.value })} />
            </div>
            <Button variant="outline" className="w-full" onClick={handleChangePassword}>
              Actualizar contraseña
            </Button>
          </CardContent>
        </Card>
      </div>
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
