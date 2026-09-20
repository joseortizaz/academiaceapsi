import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichText } from "@/components/RichText";
import {
  Clock, Calendar, Users, GraduationCap, CheckCircle2, BookOpen, Video, Link2, MessageCircle,
} from "lucide-react";
import { SITE_URL, programaUrl, plainExcerpt } from "@/lib/site";

export const Route = createFileRoute("/programas/$slug")({
  validateSearch: (search: Record<string, unknown>): Record<string, unknown> & { inscribir?: 1 } => ({
    ...search,
    inscribir: search.inscribir === 1 || search.inscribir === "1" ? 1 : undefined,
  }),
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("programs")
      .select("*")
      .eq("slug", params.slug)
      .maybeSingle();
    return { programa: data ?? null };
  },
  head: ({ params, loaderData }) => {
    const url = programaUrl(params.slug);
    const p = loaderData?.programa;
    if (!p) {
      return {
        meta: [
          { title: "Programa no encontrado | Academia Ceapsi RD" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${p.titulo} | Academia Ceapsi RD`;
    const description = p.resumen?.trim() || plainExcerpt(p.descripcion) ||
      "Programa de formación de la Academia Ceapsi RD.";
    const image = p.imagen_url || `${SITE_URL}/favicon.ico`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: DetallePrograma,
});



function DetallePrograma() {
  const { slug } = Route.useParams();
  const { inscribir } = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const enrollmentRedirect = `/programas/${slug}?inscribir=1`;

  const qc = useQueryClient();
  const [inscOpen, setInscOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    nombre_completo: "",
    documento_identidad: "",
    email_contacto: "",
    telefono_contacto: "",
    area_profesional: "",
  });


  const { programa: programaInicial } = Route.useLoaderData();

  const { data: programa, isLoading } = useQuery({
    queryKey: ["public", "programa", slug],
    initialData: programaInicial ?? undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const shareUrl = programaUrl(slug);
  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };
  const compartirWhatsApp = () => {
    const texto = `${programa?.titulo ?? "Programa"} — ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  };


  type ModuloCatalog = { id: string; titulo: string; descripcion: string | null; orden: number; duracion_minutos: number | null; es_en_vivo: boolean | null; fecha_sesion: string | null; modulo_id: string | null };
  const { data: modulos = [] } = useQuery<ModuloCatalog[]>({
    queryKey: ["public", "modulos", programa?.id],
    enabled: !!programa?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("program_modules_catalog")
        .select("id,titulo,descripcion,orden,duracion_minutos,es_en_vivo,fecha_sesion,modulo_id")
        .eq("programa_id", programa!.id)
        .order("orden");
      if (error) throw error;
      return data ?? [];
    },
  });

  type CourseModule = { id: string; titulo: string; descripcion: string | null; orden: number };
  const { data: courseModules = [] } = useQuery<CourseModule[]>({
    queryKey: ["public", "course_modules", programa?.id],
    enabled: !!programa?.id && programa?.tipo === "diplomado",
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("course_modules")
        .select("id,titulo,descripcion,orden")
        .eq("programa_id", programa!.id)
        .order("orden");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: docente } = useQuery({
    queryKey: ["public", "docente", programa?.docente_id],
    enabled: !!programa?.docente_id,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("teachers_public")
        .select("nombre,apellido,titulo,especialidad,avatar_url,biografia")
        .eq("id", programa!.docente_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: existing } = useQuery({
    queryKey: ["enrollment", programa?.id, user?.id],
    enabled: !!programa?.id && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id,estado")
        .eq("programa_id", programa!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (inscribir !== 1 || !programa || existing) {
      return;
    }
    if (authLoading) {
      return;
    }
    if (!isAuthenticated || !user) {
      navigate({
        to: "/acceder",
        search: { redirect: enrollmentRedirect },
      });
      return;
    }
    setInscOpen(true);
    navigate({
      to: "/programas/$slug",
      params: { slug },
      search: {},
      replace: true,
    });
  }, [authLoading, existing, inscribir, isAuthenticated, navigate, programa, slug, user]);

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Cargando…</div>
      </PublicLayout>
    );
  }

  if (!programa) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Programa no encontrado</h1>
          <Button asChild className="mt-4"><Link to="/programas">Ver catálogo</Link></Button>
        </div>
      </PublicLayout>
    );
  }

  const precio = programa.precio_descuento ?? programa.precio;

  const inscribirse = async () => {
    if (authLoading) {
      return;
    }
    if (!isAuthenticated || !user) {
      navigate({
        to: "/acceder",
        search: { redirect: enrollmentRedirect },
      });
      return;
    }
    setInscOpen(true);
  };


  const confirmarInscripcion = async () => {
    if (!user) return;
    const nombre = form.nombre_completo.trim();
    const documento = form.documento_identidad.replace(/[-\s]/g, "");
    const email = form.email_contacto.trim();
    const telefono = form.telefono_contacto.trim();
    const area = form.area_profesional.trim();

    if (!nombre || !documento || !email || !telefono || !area) {
      toast.error("Por favor completa todos los campos del formulario.");
      return;
    }
    if (!/^[0-9A-Z]{6,20}$/i.test(documento)) {
      toast.error("Documento inválido. Ingresa cédula o pasaporte sin guiones.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Correo electrónico inválido.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: enrErr } = await supabase
        .from("enrollments")
        .insert({
          user_id: user.id,
          programa_id: programa.id,
          estado: "pendiente",
          nombre_completo: nombre,
          documento_identidad: documento,
          email_contacto: email,
          telefono_contacto: telefono,
          area_profesional: area,
        });
      if (enrErr) throw enrErr;

      toast.success(
        "Solicitud de inscripción enviada. Un administrador la confirmará tras verificar el pago.",
      );
      setInscOpen(false);
      qc.invalidateQueries({ queryKey: ["enrollment", programa.id] });
      navigate({ to: "/mis-cursos" });
    } catch (e: any) {
      toast.error(e.message ?? "Error al inscribirse");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <PublicLayout>
      <section className="border-b bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto grid gap-8 px-4 py-12 lg:grid-cols-[2fr_1fr]">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge variant="outline" className="capitalize">{programa.tipo}</Badge>
              <Badge variant="secondary" className="capitalize">{programa.modalidad}</Badge>
              {programa.certificado_incluido && <Badge>Certificado incluido</Badge>}
            </div>
            <h1 className="text-3xl font-bold md:text-4xl">{programa.titulo}</h1>
            {programa.resumen && (
              <p className="mt-3 text-lg text-muted-foreground">{programa.resumen}</p>
            )}
            <div className="mt-6 flex flex-wrap gap-5 text-sm text-muted-foreground">
              {programa.duracion_horas && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> {programa.duracion_horas} horas
                </span>
              )}
              {programa.duracion_semanas && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" /> {programa.duracion_semanas} semanas
                </span>
              )}
              {programa.fecha_inicio && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Inicio {new Date(programa.fecha_inicio).toLocaleDateString("es-DO")}
                </span>
              )}
              {programa.max_estudiantes && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> Cupo {programa.max_estudiantes}
                </span>
              )}
            </div>
          </div>
          <aside className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="overflow-hidden rounded-lg bg-muted">
              {programa.imagen_url ? (
                <img src={programa.imagen_url} alt={programa.titulo} className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video items-center justify-center text-primary/30">
                  <GraduationCap className="h-16 w-16" />
                </div>
              )}
            </div>
            <div className="mt-4">
              {programa.precio_descuento ? (
                <div>
                  <span className="text-3xl font-bold text-primary">
                    RD$ {Number(programa.precio_descuento).toLocaleString("es-DO")}
                  </span>
                  <span className="ml-2 text-sm text-muted-foreground line-through">
                    RD$ {Number(programa.precio).toLocaleString("es-DO")}
                  </span>
                </div>
              ) : (
                <span className="text-3xl font-bold text-primary">
                  {Number(programa.precio) > 0
                    ? `RD$ ${Number(programa.precio).toLocaleString("es-DO")}`
                    : "Gratis"}
                </span>
              )}
            </div>
            {existing ? (
              <Button asChild className="mt-4 w-full">
                <Link to="/mis-cursos/$slug" params={{ slug: programa.slug }}>Ir al curso</Link>
              </Button>
            ) : (
              <Button className="mt-4 w-full" onClick={inscribirse} disabled={authLoading}>
                {authLoading
                  ? "Cargando…"
                  : isAuthenticated
                    ? "Inscribirme ahora"
                    : "Acceder para inscribirme"}
              </Button>
            )}
            {programa.syllabus_url && (
              <Button asChild variant="outline" className="mt-2 w-full">
                <a href={programa.syllabus_url} target="_blank" rel="noopener noreferrer">
                  Descargar syllabus
                </a>
              </Button>
            )}
          </aside>
        </div>
      </section>

      <section className="container mx-auto grid gap-10 px-4 py-12 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-10">
          <div>
            <h2 className="text-2xl font-bold">Descripción del programa</h2>
            <RichText html={programa.descripcion} className="mt-3 text-foreground/90" />
          </div>

          {(programa as any).objetivos && (
            <div>
              <h2 className="text-2xl font-bold">Objetivos</h2>
              <RichText html={(programa as any).objetivos} className="mt-3 text-foreground/90" />
            </div>
          )}

          {(programa as any).publico_meta && (
            <div>
              <h2 className="text-2xl font-bold">Público meta</h2>
              <RichText html={(programa as any).publico_meta} className="mt-3 text-foreground/90" />
            </div>
          )}

          {(programa as any).resultados_esperados && (
            <div>
              <h2 className="text-2xl font-bold">Resultados esperados</h2>
              <RichText html={(programa as any).resultados_esperados} className="mt-3 text-foreground/90" />
            </div>
          )}

          {modulos.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold">Contenido del programa</h2>
              {programa.tipo === "diplomado" && courseModules.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {courseModules.map((cm, idx) => {
                    const leccionesMod = modulos.filter((m) => m.modulo_id === cm.id);
                    return (
                      <div key={cm.id} className="rounded-lg border bg-card">
                        <div className="border-b bg-muted/40 px-4 py-3">
                          <h3 className="font-bold">
                            Módulo {idx + 1}: {cm.titulo}
                          </h3>
                          {cm.descripcion && (
                            <p className="mt-1 text-sm text-muted-foreground">{cm.descripcion}</p>
                          )}
                        </div>
                        {leccionesMod.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-muted-foreground">Próximamente</p>
                        ) : (
                          <ol className="divide-y">
                            {leccionesMod.map((m, i) => (
                              <li key={m.id} className="flex items-start gap-3 p-4">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                  {i + 1}
                                </span>
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-semibold">{m.titulo}</h4>
                                    {m.es_en_vivo && (
                                      <Badge variant="outline" className="gap-1">
                                        <Video className="h-3 w-3" /> En vivo
                                      </Badge>
                                    )}
                                    {m.duracion_minutos && (
                                      <span className="text-xs text-muted-foreground">
                                        {m.duracion_minutos} min
                                      </span>
                                    )}
                                  </div>
                                  {m.descripcion && (
                                    <p className="mt-1 text-sm text-muted-foreground">{m.descripcion}</p>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ol className="mt-4 divide-y rounded-lg border bg-card">
                  {modulos.map((m, i) => (
                    <li key={m.id} className="flex items-start gap-3 p-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{m.titulo}</h3>
                          {m.es_en_vivo && (
                            <Badge variant="outline" className="gap-1">
                              <Video className="h-3 w-3" /> En vivo
                            </Badge>
                          )}
                          {m.duracion_minutos && (
                            <span className="text-xs text-muted-foreground">
                              {m.duracion_minutos} min
                            </span>
                          )}
                        </div>
                        {m.descripcion && (
                          <p className="mt-1 text-sm text-muted-foreground">{m.descripcion}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          {docente && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-bold">Docente</h3>
              <div className="mt-3 flex items-start gap-3">
                {docente.avatar_url ? (
                  <img src={docente.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <BookOpen />
                  </div>
                )}
                <div>
                  <p className="font-semibold">{docente.nombre} {docente.apellido}</p>
                  {docente.titulo && <p className="text-xs text-muted-foreground">{docente.titulo}</p>}
                  {docente.especialidad && (
                    <p className="text-xs text-muted-foreground">{docente.especialidad}</p>
                  )}
                </div>
              </div>
              {docente.biografia && (
                <p className="mt-3 text-sm text-muted-foreground">{docente.biografia}</p>
              )}
            </div>
          )}

          {programa.horario && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="flex items-center gap-2 font-bold">
                <Calendar className="h-4 w-4 text-primary" /> Horario
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{programa.horario}</p>
            </div>
          )}

          {programa.certificado_incluido && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Certificación
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Al completar el 100% del programa recibirás tu certificado digital de la Academia Ceapsi RD.
              </p>
            </div>
          )}
        </aside>
      </section>

      <Dialog open={inscOpen} onOpenChange={setInscOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitud de inscripción</DialogTitle>
            <DialogDescription>
              Completa tus datos. Tu solicitud quedará en estado <strong>Pendiente</strong> hasta que un
              administrador confirme tu inscripción tras verificar el pago.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre completo *</Label>
              <Input
                id="nombre"
                value={form.nombre_completo}
                onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
                maxLength={120}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="documento">Cédula o pasaporte * (sin guiones)</Label>
              <Input
                id="documento"
                value={form.documento_identidad}
                onChange={(e) =>
                  setForm({
                    ...form,
                    documento_identidad: e.target.value.replace(/[-\s]/g, "").toUpperCase(),
                  })
                }
                placeholder="00112345678"
                maxLength={20}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Correo electrónico *</Label>
              <Input
                id="email"
                type="email"
                value={form.email_contacto}
                onChange={(e) => setForm({ ...form, email_contacto: e.target.value })}
                maxLength={120}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="telefono">Número de contacto *</Label>
              <Input
                id="telefono"
                type="tel"
                value={form.telefono_contacto}
                onChange={(e) => setForm({ ...form, telefono_contacto: e.target.value })}
                placeholder="809-000-0000"
                maxLength={30}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="area">Área profesional o de estudio *</Label>
              <Input
                id="area"
                value={form.area_profesional}
                onChange={(e) => setForm({ ...form, area_profesional: e.target.value })}
                placeholder="Ej. Psicología clínica, Educación, Estudiante de medicina"
                maxLength={120}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInscOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarInscripcion} disabled={submitting}>
              {submitting ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PublicLayout>
  );
}
