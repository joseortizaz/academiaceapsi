import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  GraduationCap,
  FolderTree,
  Users,
  BookOpen,
  MessageSquare,
  Newspaper,
  Megaphone,
  ClipboardList,
  CreditCard,
  Mail,
  UserCog,
  Images,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { to: "/admin/hero", label: "Carrusel Hero", icon: Images },
  { to: "/admin/programas", label: "Programas", icon: GraduationCap },
  { to: "/admin/categorias", label: "Categorías", icon: FolderTree },
  { to: "/admin/docentes", label: "Docentes", icon: Users },
  { to: "/admin/modulos", label: "Módulos", icon: BookOpen },
  { to: "/admin/testimonios", label: "Testimonios", icon: MessageSquare },
  { to: "/admin/blog", label: "Blog", icon: Newspaper },
  { to: "/admin/anuncios", label: "Anuncios", icon: Megaphone },
  { to: "/admin/inscripciones", label: "Inscripciones", icon: ClipboardList },
  { to: "/admin/pagos", label: "Pagos", icon: CreditCard },
  { to: "/admin/finanzas", label: "Finanzas", icon: TrendingUp },
  { to: "/admin/mensajes", label: "Mensajes", icon: Mail },
  { to: "/admin/usuarios", label: "Usuarios", icon: UserCog },
];

function AdminLayout() {
  const { isLoading, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando panel…</div>;
  }
  if (!hasRole("admin")) {
    throw redirect({ to: "/" });
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
        <div className="border-b p-4">
          <h2 className="text-lg font-bold">Administración</h2>
          <p className="text-xs text-muted-foreground">Academia Ceapsi RD</p>
        </div>
        <nav className="flex flex-col gap-1 p-3">
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
      </aside>
      <div className="flex-1 overflow-x-auto">
        <div className="border-b bg-card p-3 md:hidden">
          <select
            className="w-full rounded-md border bg-background p-2 text-sm"
            value={location.pathname}
            onChange={(e) => {
              window.location.href = e.target.value;
            }}
          >
            {nav.map((item) => (
              <option key={item.to} value={item.to}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
