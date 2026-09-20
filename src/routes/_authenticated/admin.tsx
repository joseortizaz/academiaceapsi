import { createFileRoute, Link, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  LogOut,
  Plug,
  FileCheck,
  Award,
  Users2,
  FileText,
  Star,
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
  { to: "/admin/grupos", label: "Grupos / Cohortes", icon: Users2 },
  { to: "/admin/modulos", label: "Lecciones", icon: BookOpen },
  { to: "/admin/evaluaciones", label: "Evaluaciones", icon: FileCheck },
  { to: "/admin/certificados", label: "Certificados", icon: Award },
  { to: "/admin/testimonios", label: "Testimonios", icon: MessageSquare },
  { to: "/admin/resenas", label: "Valoraciones", icon: Star },
  { to: "/admin/eventos", label: "Eventos", icon: Images },
  { to: "/admin/blog", label: "Blog", icon: Newspaper },
  { to: "/admin/anuncios", label: "Anuncios", icon: Megaphone },
  { to: "/admin/inscripciones", label: "Inscripciones", icon: ClipboardList },
  { to: "/admin/solicitudes", label: "Solicitudes", icon: ClipboardList },
  { to: "/admin/facturacion", label: "Facturación & Cobros", icon: CreditCard },
  { to: "/admin/mensajes", label: "Mensajes", icon: Mail },
  { to: "/admin/usuarios", label: "Usuarios", icon: UserCog },
  { to: "/admin/integraciones", label: "Integraciones", icon: Plug },
];

function AdminLayout() {
  const { isLoading, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: resenasPendientes = 0 } = useQuery({
    queryKey: ["admin", "resenas", "pendientes"],
    queryFn: async () => {
      const { count } = await (supabase.from as any)("program_reviews")
        .select("id", { count: "exact", head: true })
        .eq("estado", "pendiente");
      return count ?? 0;
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando panel…</div>;
  }
  if (!hasRole("admin")) {
    throw redirect({ to: "/" });
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="border-b p-4">
          <h2 className="text-lg font-bold">Administración</h2>
          <p className="text-xs text-muted-foreground">Academia Ceapsi RD</p>
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
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.to === "/admin/resenas" && resenasPendientes > 0 && (
                  <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                    {resenasPendientes}
                  </span>
                )}
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
