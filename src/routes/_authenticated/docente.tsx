import { createFileRoute, Link, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  MessagesSquare,
  LogOut,
  GraduationCap,
  Video,
  UserCog,
  FileCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/NotificationsBell";

export const Route = createFileRoute("/_authenticated/docente")({
  component: DocenteLayout,
});

const nav = [
  { to: "/docente", label: "Resumen", icon: LayoutDashboard, exact: true },
  { to: "/docente/cursos", label: "Mis Cursos", icon: BookOpen },
  { to: "/docente/grupos", label: "Mis Grupos", icon: Users },
  { to: "/docente/clases-vivo", label: "Clases en Vivo", icon: Video },
  { to: "/docente/evaluaciones", label: "Evaluaciones", icon: FileCheck },
  { to: "/docente/calificaciones", label: "Calificaciones", icon: ClipboardCheck },
  { to: "/docente/comunidad", label: "Comunidad", icon: MessagesSquare },
  { to: "/docente/cuenta", label: "Mi Cuenta", icon: UserCog },
];

function DocenteLayout() {
  const { isLoading, hasRole, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando panel…</div>;
  }
  if (!hasRole("docente") && !hasRole("admin")) {
    throw redirect({ to: "/" });
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="border-b p-4">
          <Link to="/" className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-bold leading-tight">Panel Docente</h2>
              <p className="text-xs text-muted-foreground">{user?.nombre} {user?.apellido}</p>
            </div>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
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
            className="w-full justify-start text-foreground hover:bg-muted hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>
      <div className="flex-1 overflow-x-auto">
        <div className="flex items-center gap-2 border-b bg-card p-3">
          <select
            className="flex-1 rounded-md border bg-background p-2 text-sm md:hidden"
            value={location.pathname}
            onChange={(e) => { window.location.href = e.target.value; }}
          >
            {nav.map((item) => (
              <option key={item.to} value={item.to}>{item.label}</option>
            ))}
          </select>
          <div className="hidden flex-1 md:block" />
          <NotificationsBell />
          <Button size="sm" variant="outline" onClick={handleLogout} className="md:hidden">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
