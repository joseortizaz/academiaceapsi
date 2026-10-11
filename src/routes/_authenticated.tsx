import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { recordLoginContext } from "@/lib/audit.functions";

/** Registra IP y dispositivo una sola vez por inicio de sesión. */
function registrarContextoDeAcceso(user: { id: string; last_sign_in_at?: string | null }) {
  try {
    const clave = `audit-login:${user.id}:${user.last_sign_in_at ?? ""}`;
    if (sessionStorage.getItem("audit-login") === clave) return;
    sessionStorage.setItem("audit-login", clave);
  } catch {
    return;
  }
  void recordLoginContext({ data: undefined as never }).catch(() => {});
}

const PANTALLAS_2FA = new Set(["/verificar-2fa", "/configurar-2fa"]);

export const Route = createFileRoute("/_authenticated")({
  staticData: { sitemap: "exclude-subtree" },
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/acceder", search: { redirect: location.pathname } });
    }
    // Cuenta suspendida por un administrador: cerrar sesión y avisar.
    const { data: perfil } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .maybeSingle();
    if (perfil?.is_active === false) {
      await supabase.auth.signOut();
      throw redirect({ to: "/acceder", search: { suspendida: true } });
    }
    registrarContextoDeAcceso(data.user);
    const debeCambiar = (data.user.app_metadata as any)?.must_change_password === true;
    if (debeCambiar && location.pathname !== "/cambiar-password") {
      throw redirect({ to: "/cambiar-password", search: {} });
    }
    if (debeCambiar) return;

    // Verificación en dos pasos: obligatoria para administradores, opcional para el resto.
    if (PANTALLAS_2FA.has(location.pathname)) return;
    const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (nivel?.currentLevel === "aal2") return;
    if (nivel?.nextLevel === "aal2") {
      // Tiene autenticador: falta el código de esta sesión.
      throw redirect({ to: "/verificar-2fa", search: { redirect: location.href } });
    }
    const { data: esAdmin } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (esAdmin) {
      throw redirect({ to: "/configurar-2fa", search: { redirect: location.href } });
    }
  },

  component: () => <Outlet />,
});
