import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { GraduationCap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export const Route = createFileRoute("/registro")({
  component: Registro,
});

function Registro() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre, apellido, telefono },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Error de registro", { description: error.message });
      return;
    }
    if (data.user && !data.session) {
      toast.success("Registro exitoso", { description: "Revisa tu correo para confirmar tu cuenta." });
      return;
    }
    toast.success("¡Bienvenido a Ceapsi RD!");
    navigate({ to: "/estudiante" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center bg-background p-6 md:p-12">
        <Card className="w-full max-w-md border-border">
          <CardContent className="p-8">
            <Link to="/" className="mb-6 flex items-center gap-2 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
              <p className="font-bold text-primary">Academia Ceapsi RD</p>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Crea tu cuenta</h1>
            <p className="mt-1 text-sm text-muted-foreground">Únete a la comunidad educativa de Ceapsi RD.</p>

            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input id="nombre" required placeholder="María" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellido">Apellido</Label>
                  <Input id="apellido" required placeholder="Fernández" value={apellido} onChange={(e) => setApellido(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="correo">Correo electrónico</Label>
                <Input id="correo" type="email" required placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" type="tel" placeholder="+1 (809) 000-0000" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" required placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="terminos" required />
                <Label htmlFor="terminos" className="text-xs font-normal text-muted-foreground">
                  Acepto los términos del servicio y la política de privacidad de Academia Ceapsi RD.
                </Label>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Creando cuenta..." : "Crear cuenta"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link to="/acceder" className="font-semibold text-primary hover:text-accent">
                Accede aquí
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="relative hidden bg-gradient-to-br from-primary via-primary to-primary/80 p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="flex items-center gap-2 self-end">
          <div className="leading-tight text-right">
            <p className="text-sm font-bold">Academia Ceapsi RD</p>
            <p className="text-[10px] uppercase tracking-widest text-primary-foreground/70">República Dominicana</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
        </Link>
        <div>
          <h2 className="text-4xl font-bold leading-tight">Comienza tu camino profesional</h2>
          <p className="mt-3 max-w-md text-primary-foreground/80">
            Diplomados, cursos en vivo por Zoom y formación a tu ritmo.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "Catálogo completo de diplomados en RD",
              "Certificados digitales descargables",
              "Acceso de por vida a tus cursos asincrónicos",
              "Soporte de docentes dominicanos certificados",
            ].map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-primary-foreground/90">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" /> {b}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} Academia Ceapsi RD</p>
      </div>
    </div>
  );
}
