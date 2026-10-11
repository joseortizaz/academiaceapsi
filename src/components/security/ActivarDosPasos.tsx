import { useState } from "react";
import { toast } from "sonner";
import { Copy, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodigoVerificacion } from "@/components/security/CodigoVerificacion";
import { MFA_ISSUER, limpiarFactoresPendientes, mensajeErrorMfa } from "@/lib/mfa";

type Registro = { factorId: string; qr: string; secret: string };

/**
 * Registro de un autenticador (Google Authenticator, Microsoft Authenticator, Authy…):
 * 1) nombre del dispositivo, 2) escanear QR, 3) confirmar con un código.
 */
export function ActivarDosPasos({
  nombreInicial = "Mi teléfono",
  onActivado,
  onCancelar,
}: {
  nombreInicial?: string;
  onActivado: () => void | Promise<void>;
  onCancelar?: () => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);

  const empezar = async () => {
    const limpio = nombre.trim();
    if (!limpio) {
      toast.error("Escribe un nombre para el dispositivo");
      return;
    }
    setCargando(true);
    try {
      await limpiarFactoresPendientes();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: limpio,
        issuer: MFA_ISSUER,
      });
      if (error) throw error;
      setRegistro({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) {
      toast.error(mensajeErrorMfa(e));
    } finally {
      setCargando(false);
    }
  };

  const confirmar = async (valor = codigo) => {
    if (!registro || valor.length !== 6) return;
    setCargando(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: registro.factorId,
        code: valor,
      });
      if (error) throw error;
      toast.success("Verificación en dos pasos activada");
      await onActivado();
    } catch (e) {
      setCodigo("");
      toast.error(mensajeErrorMfa(e));
    } finally {
      setCargando(false);
    }
  };

  const cancelar = async () => {
    if (registro) await supabase.auth.mfa.unenroll({ factorId: registro.factorId }).catch(() => {});
    setRegistro(null);
    setCodigo("");
    onCancelar?.();
  };

  const copiarClave = async () => {
    if (!registro) return;
    try {
      await navigator.clipboard.writeText(registro.secret);
      toast.success("Clave copiada");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  if (!registro) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Necesitas una app de autenticación en tu teléfono, por ejemplo Google Authenticator,
          Microsoft Authenticator o Authy (son gratuitas).
        </p>
        <div className="space-y-2">
          <Label htmlFor="mfa-nombre">Nombre del dispositivo</Label>
          <Input
            id="mfa-nombre"
            value={nombre}
            maxLength={40}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Mi teléfono"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={empezar} disabled={cargando}>
            <Smartphone className="mr-2 h-4 w-4" />
            {cargando ? "Preparando…" : "Continuar"}
          </Button>
          {onCancelar && (
            <Button variant="outline" onClick={onCancelar} disabled={cargando}>
              Cancelar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Abre tu app de autenticación y elige agregar una cuenta.</li>
        <li>Escanea este código QR.</li>
        <li>Escribe el código de 6 dígitos que muestra la app.</li>
      </ol>
      <div className="flex justify-center">
        <img
          src={registro.qr}
          alt="Código QR para la app de autenticación"
          className="h-48 w-48 rounded-md border bg-white p-2"
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          ¿No puedes escanear? Escribe esta clave en la app:
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-2 py-1.5 font-mono text-sm">
            {registro.secret}
          </code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={copiarClave}
            title="Copiar clave"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="mfa-codigo-registro">Código de 6 dígitos</Label>
        <CodigoVerificacion
          id="mfa-codigo-registro"
          value={codigo}
          onChange={setCodigo}
          onComplete={(v) => void confirmar(v)}
          disabled={cargando}
          autoFocus
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void confirmar()} disabled={cargando || codigo.length !== 6}>
          {cargando ? "Verificando…" : "Activar"}
        </Button>
        <Button variant="outline" onClick={() => void cancelar()} disabled={cargando}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
