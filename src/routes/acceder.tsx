import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useState } from "react";

export const Route = createFileRoute("/acceder")({
  component: Acceder,
});

function Acceder() {
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

            <form
              onSubmit={(e) => {
                e.preventDefault();
                toast.info("Autenticación pendiente", { description: "El backend se activa en el PASO 2." });
              }}
              className="mt-6 space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="correo">Correo electrónico</Label>
                <Input id="correo" type="email" required placeholder="correo@ejemplo.com" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  <a href="#" className="text-xs text-primary hover:text-accent">¿Olvidaste tu contraseña?</a>
                </div>
                <Input id="password" type="password" required placeholder="••••••••" />
              </div>
              <Button type="submit" size="lg" className="w-full">Acceder</Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              ¿No tienes cuenta?{" "}
              <Link to="/registro" className="font-semibold text-primary hover:text-accent">
                Regístrate aquí
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
