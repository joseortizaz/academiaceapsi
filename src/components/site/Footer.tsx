import { Link } from "@tanstack/react-router";
import { GraduationCap, Facebook, Instagram, Youtube, Mail, MapPin, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="container mx-auto grid gap-10 px-4 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <p className="text-base font-bold">Academia Ceapsi RD</p>
          </div>
          <p className="mt-4 text-sm text-primary-foreground/75">
            Formación profesional en psicología y ciencias del comportamiento para
            República Dominicana y el Caribe.
          </p>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-accent">
            Explora
          </p>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li><Link to="/" className="hover:text-accent">Inicio</Link></li>
            <li><Link to="/sobre-nosotros" className="hover:text-accent">Sobre nosotros</Link></li>
            <li><Link to="/docentes" className="hover:text-accent">Docentes</Link></li>
            <li><Link to="/blog" className="hover:text-accent">Blog</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-accent">
            Contacto
          </p>
          <ul className="space-y-3 text-sm text-primary-foreground/80">
            <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-accent" /><span>Av. Winston Churchill, Santo Domingo, RD</span></li>
            <li className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 text-accent" /><span>+1 (809) 555-0123</span></li>
            <li className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 text-accent" /><span>info@academiaceapsi.do</span></li>
          </ul>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-accent">
            Síguenos
          </p>
          <div className="flex gap-3">
            <a href="#" aria-label="Facebook" className="rounded-full bg-primary-foreground/10 p-2 hover:bg-accent hover:text-accent-foreground">
              <Facebook className="h-4 w-4" />
            </a>
            <a href="#" aria-label="Instagram" className="rounded-full bg-primary-foreground/10 p-2 hover:bg-accent hover:text-accent-foreground">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="#" aria-label="YouTube" className="rounded-full bg-primary-foreground/10 p-2 hover:bg-accent hover:text-accent-foreground">
              <Youtube className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10">
        <div className="container mx-auto px-4 py-5 text-center text-xs text-primary-foreground/70">
          © {new Date().getFullYear()} Academia Ceapsi RD. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
