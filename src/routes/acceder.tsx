import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/acceder")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect:
      typeof search.redirect === "string" && search.redirect.startsWith("/")
        ? search.redirect
        : undefined,
  }),
  component: Acceder,
});

function Acceder() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const resolveDestination = async (userId: string): Promise<string> => {
    if (redirect) return redirect;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleList = (roles ?? []).map((r) => r.role as string);
    if (roleList.includes("admin")) return "/admin";
    if (roleList.includes("docente")) return "/docente";
    return "/estudiante";
  };

  const redirectAuthenticatedUser = async (userId: string) => {
    const destination = await resolveDestination(userId);
    // Si el destino incluye query string (p.ej. flujo de consent OAuth),
    // usar navegación nativa para preservar los search params.
    if (destination.includes("?")) {
      window.location.replace(destination);
      return;
    }
    await navigate({ to: destination as never, replace: true });
  };

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!active || error || !data.user) return;
      void redirectAuthenticatedUser(data.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        void redirectAuthenticatedUser(session.user.id);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate, redirect]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setLoading(false);
      toast.error("Error de acceso", { description: error?.message ?? "No se pudo iniciar sesión" });
      return;
    }
    toast.success("¡Bienvenido!");
    await redirectAuthenticatedUser(data.user.id);
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const callbackUrl = new URL("/acceder", window.location.origin);
    if (redirect) callbackUrl.searchParams.set("redirect", redirect);

    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: callbackUrl.toString(),
    });
    if (result.error) {
      toast.error("Error con Google", { description: result.error.message });
      return;
    }
    if (result.redirected) return;
    toast.success("¡Bienvenido!");
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await redirectAuthenticatedUser(data.user.id);
      return;
    }

    await navigate({ to: (redirect ?? "/estudiante") as never, replace: true });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden bg-gradient-to-br from-primary via-primary to-primary/80 p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold">Academia Ceapsi RD</p>
            <p className="text-[10px] uppercase tracking-widest text-primary-foreground/70">República Dominicana</p>
          </div>
        </Link>
        <div>
          <h2 className="text-4xl font-bold leading-tight">Bienvenido de vuelta</h2>
          <p className="mt-3 max-w-md text-primary-foreground/80">
            Accede a tu portal para continuar tus diplomados, descargar certificados y conectar con tus docentes.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} Academia Ceapsi RD</p>
      </div>

      <div className="flex items-center justify-center bg-background p-6 md:p-12">
        <Card className="w-full max-w-md border-border">
          <CardContent className="p-8">
            <Link to="/" className="mb-6 flex items-center gap-2 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
              <p className="font-bold text-primary">Academia Ceapsi RD</p>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Accede a tu cuenta</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ingresa tus credenciales para continuar.</p>

            <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="correo">Correo electrónico</Label>
                <Input id="correo" type="email" required placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link
                    to="/recuperar-password"
                    preload={false}
                    className="relative z-10 inline-flex min-h-8 items-center self-start rounded-md px-1 text-sm font-medium text-primary underline-offset-4 hover:text-accent hover:underline sm:self-auto"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <Input id="password" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Accediendo..." : "Acceder"}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">O continúa con</span>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </Button>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              ¿No tienes cuenta?{" "}
              <Link
                to="/registro"
                search={redirect ? { redirect } : undefined}
                className="font-semibold text-primary hover:text-accent"
              >
                Regístrate aquí
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
