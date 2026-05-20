import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, GraduationCap, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/", label: "Inicio" },
  { to: "/programas", label: "Programas" },
  { to: "/sobre-nosotros", label: "Sobre nosotros" },
  { to: "/docentes", label: "Docentes" },
  { to: "/blog", label: "Blog" },
  { to: "/contactos", label: "Contactos" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/85 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-primary">Academia Ceapsi</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              República Dominicana
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeProps={{ className: "text-primary" }}
              className="text-sm font-medium text-foreground/80 transition hover:text-primary [&.active]:text-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="outline">
            <Link to="/registro">Registro</Link>
          </Button>
          <Button asChild>
            <Link to="/acceder">Accede</Link>
          </Button>
        </div>

        <button
          className="rounded-md p-2 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Menú"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background lg:hidden">
          <div className="container mx-auto flex flex-col gap-1 px-4 py-3">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button asChild variant="outline">
                <Link to="/registro" onClick={() => setOpen(false)}>
                  Registro
                </Link>
              </Button>
              <Button asChild>
                <Link to="/acceder" onClick={() => setOpen(false)}>
                  Accede
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
