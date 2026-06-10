import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, BookOpen, ClipboardCheck, Award, UserCog, LogOut,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/NotificationsBell";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const nav: NavItem[] = [
  { to: "/estudiante", label: "Mi Aprendizaje", icon: LayoutDashboard, exact: true },
  { to: "/mis-cursos", label: "Mis Cursos", icon: BookOpen },
  { to: "/estudiante/evaluaciones", label: "Evaluaciones", icon: ClipboardCheck },
  { to: "/certificados", label: "Certificados", icon: Award },
  { to: "/estudiante/cuenta", label: "Mi Cuenta", icon: UserCog },
];

export function StudentShell({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando panel…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        <Link to="/" className="flex items-center gap-2 border-b p-4">
          <GraduationCap className="h-6 w-6 text-primary" />
          <div>
            <p className="text-sm font-bold">Mi Academia</p>
            <p className="text-xs text-muted-foreground">Ceapsi RD</p>
          </div>
        </Link>

        <div className="border-b px-4 py-3">
          <p className="text-xs text-muted-foreground">Hola,</p>
          <p className="truncate text-sm font-semibold">
            {user?.nombre} {user?.apellido}
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as never}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <Button
            variant="ghost"
            className="w-full justify-start hover:bg-muted"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <div className="flex-1 overflow-x-auto">
        <div className="border-b bg-card p-3 md:hidden">
          <select
            className="w-full rounded-md border bg-background p-2 text-sm"
            value={nav.find((n) => location.pathname.startsWith(n.to))?.to ?? "/estudiante"}
            onChange={(e) => { window.location.href = e.target.value; }}
          >
            {nav.map((item) => (
              <option key={item.to} value={item.to}>{item.label}</option>
            ))}
          </select>
        </div>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
