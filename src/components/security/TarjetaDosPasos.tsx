import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ActivarDosPasos } from "@/components/security/ActivarDosPasos";
import { useAuth } from "@/hooks/use-auth";
import { factoresVerificados, mensajeErrorMfa, type FactorTotp } from "@/lib/mfa";

/**
 * Tarjeta "Verificación en dos pasos" para Mi cuenta.
 * `obligatoria`: cuentas de administrador (no se puede quitar el último dispositivo).
 */
export function TarjetaDosPasos({ obligatoria: forzada }: { obligatoria?: boolean }) {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const obligatoria = forzada ?? hasRole("admin");
  const [agregando, setAgregando] = useState(false);
  const [quitar, setQuitar] = useState<FactorTotp | null>(null);
  const [quitando, setQuitando] = useState(false);

  const { data: factores = [], isLoading } = useQuery({
    queryKey: ["mfa", "factores"],
    queryFn: factoresVerificados,
  });

  const activa = factores.length > 0;
  const recargar = () => qc.invalidateQueries({ queryKey: ["mfa", "factores"] });

  const confirmarQuitar = async () => {
    if (!quitar) return;
    setQuitando(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: quitar.id });
      if (error) throw error;
      // Renueva el token para que refleje el cambio.
      await supabase.auth.refreshSession();
      toast.success(
        factores.length === 1 ? "Verificación en dos pasos desactivada" : "Dispositivo quitado",
      );
      setQuitar(null);
      await recargar();
    } catch (e) {
      toast.error(mensajeErrorMfa(e));
    } finally {
      setQuitando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Verificación en dos pasos
          {!isLoading && (
            <Badge
              variant="outline"
              className={
                activa
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "text-muted-foreground"
              }
            >
              {activa ? "Activada" : "Desactivada"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {obligatoria
            ? "Es obligatoria para las cuentas de administración. Al entrar, además de la contraseña se pide un código de tu app de autenticación."
            : "Protege tu cuenta aunque alguien conozca tu contraseña: al entrar se pedirá también un código de tu app de autenticación."}
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : agregando ? (
          <ActivarDosPasos
            nombreInicial={activa ? "Segundo teléfono" : "Mi teléfono"}
            onActivado={async () => {
              setAgregando(false);
              await recargar();
            }}
            onCancelar={() => setAgregando(false)}
          />
        ) : (
          <>
            {activa && (
              <ul className="divide-y rounded-md border">
                {factores.map((f) => {
                  const ultimo = obligatoria && factores.length === 1;
                  return (
                    <li key={f.id} className="flex items-center gap-3 p-3 text-sm">
                      <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{f.friendly_name || "Autenticador"}</p>
                        <p className="text-xs text-muted-foreground">
                          Agregado el {new Date(f.created_at).toLocaleDateString("es-DO")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={ultimo}
                        title={
                          ultimo
                            ? "Agrega otro dispositivo antes de quitar este"
                            : "Quitar dispositivo"
                        }
                        onClick={() => setQuitar(f)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            {activa && obligatoria && factores.length === 1 && (
              <p className="text-xs text-muted-foreground">
                Recomendado: agrega un segundo dispositivo por si pierdes el teléfono.
              </p>
            )}
            <Button variant={activa ? "outline" : "default"} onClick={() => setAgregando(true)}>
              {activa ? (
                <>
                  <Plus className="mr-2 h-4 w-4" /> Agregar otro dispositivo
                </>
              ) : (
                "Activar verificación en dos pasos"
              )}
            </Button>
          </>
        )}
      </CardContent>

      <AlertDialog open={!!quitar} onOpenChange={(o) => !o && setQuitar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {factores.length === 1
                ? "¿Desactivar la verificación en dos pasos?"
                : "¿Quitar este dispositivo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {factores.length === 1
                ? "Al entrar solo se pedirá tu contraseña. Puedes volver a activarla cuando quieras."
                : `"${quitar?.friendly_name || "Autenticador"}" ya no servirá para entrar a tu cuenta.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={quitando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={quitando}
              onClick={(e) => {
                e.preventDefault();
                void confirmarQuitar();
              }}
            >
              {quitando ? "Quitando…" : factores.length === 1 ? "Desactivar" : "Quitar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
