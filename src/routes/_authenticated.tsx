import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/acceder", search: { redirect: location.pathname } });
    }
    const debeCambiar = (data.user.app_metadata as any)?.must_change_password === true;
    if (debeCambiar && location.pathname !== "/cambiar-password") {
      throw redirect({ to: "/cambiar-password", search: {} });
    }
  },

  component: () => <Outlet />,
});
