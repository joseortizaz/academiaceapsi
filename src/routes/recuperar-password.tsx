import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/recuperar-password")({
  component: RecuperarPassword,
});

function RecuperarPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("No se pudo enviar", { description: error.message });
      return;
    }
    setSent(true);
    toast.success("Revisa tu correo para continuar");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-border">
        <CardContent className="p-8">
          <Link to="/" className="mb-6 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <p className="font-bold text-primary">Academia Ceapsi RD</p>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Recuperar contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
          </p>

          {sent ? (
            <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              Si existe una cuenta asociada a <strong>{email}</strong>, recibirás un correo con
              instrucciones para crear una nueva contraseña.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="correo">Correo electrónico</Label>
                <Input
                  id="correo"
                  type="email"
                  required
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar enlace"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/acceder" className="font-semibold text-primary hover:text-accent">
              Volver a iniciar sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
