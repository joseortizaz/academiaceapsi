import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { changeProvisionalPassword } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, GraduationCap, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cambiar-password")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect:
      typeof search.redirect === "string" &&
      search.redirect.startsWith("/") &&
      !search.redirect.startsWith("/cambiar-password")
        ? search.redirect
        : undefined,
  }),
  component: CambiarPassword,
});

async function destinoPorRol(userId: string): Promise<string> {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const list = (roles ?? []).map((r) => r.role as string);
  if (list.includes("admin")) return "/admin";
  if (list.includes("docente")) return "/docente";
  return "/estudiante";
}

function CambiarPassword() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { redirect } = Route.useSearch();
  const cambiar = useServerFn(changeProvisionalPassword);

  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [verificando, setVerificando] = useState(true);

  // Si el usuario no tiene el indicador, sacarlo de aquí.
  useEffect(() => {
    let activo = true;
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (!activo) return;
      if (error || !data.user) return;
      if ((data.user.app_metadata as any)?.must_change_password === true) {
        setVerificando(false);
        return;
      }
      const destino = redirect ?? (await destinoPorRol(data.user.id));
      await navigate({ to: destino as never, replace: true });
    });
    return () => {
      activo = false;
    };
  }, [navigate, redirect]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pass1.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (pass1 !== pass2) {
      toast.error("Las dos contraseñas no son iguales");
      return;
    }
    setEnviando(true);
    try {
      await cambiar({ data: { newPassword: pass1 } });
      await supabase.auth.refreshSession();
      qc.invalidateQueries();
      toast.success("Contraseña actualizada");
      const { data } = await supabase.auth.getUser();
      const destino = redirect ?? (data.user ? await destinoPorRol(data.user.id) : "/estudiante");
      await navigate({ to: destino as never, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setEnviando(false);
    }
  };

  const cerrarSesion = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/acceder", replace: true });
  };

  if (verificando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-6 w-6" />
            </div>
            <p className="text-lg font-bold text-primary">Academia Ceapsi RD</p>
          </div>

          <h1 className="text-3xl font-bold">Crea tu contraseña nueva</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Por tu seguridad debes cambiar la contraseña provisional que te entregaron antes de
            continuar.
          </p>

          <form onSubmit={enviar} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pass1" className="text-base">Contraseña nueva</Label>
              <div className="relative">
                <Input
                  id="pass1"
                  type={ver ? "text" : "password"}
                  value={pass1}
                  onChange={(e) => setPass1(e.target.value)}
                  className="h-12 pr-12 text-lg"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {ver ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pass2" className="text-base">Repite la contraseña</Label>
              <Input
                id="pass2"
                type={ver ? "text" : "password"}
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                className="h-12 text-lg"
                autoComplete="new-password"
                required
              />
            </div>

            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Debe tener al menos 8 caracteres.
            </p>

            <Button type="submit" size="lg" className="h-14 w-full text-lg" disabled={enviando}>
              {enviando ? "Guardando…" : "Guardar y continuar"}
            </Button>
          </form>

          <Button variant="ghost" className="mt-4 w-full" onClick={cerrarSesion}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
