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

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/acceder", search: { redirect: location.pathname } });
    }
    registrarContextoDeAcceso(data.user);
    const debeCambiar = (data.user.app_metadata as any)?.must_change_password === true;
    if (debeCambiar && location.pathname !== "/cambiar-password") {
      throw redirect({ to: "/cambiar-password", search: {} });
    }
  },

  component: () => <Outlet />,
});
