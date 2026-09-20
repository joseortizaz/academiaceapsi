import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

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
  Clock, Calendar, Users, GraduationCap, CheckCircle2, Video, Link2, MessageCircle,
} from "lucide-react";
import { SITE_URL, programaUrl, plainExcerpt } from "@/lib/site";
import { ProgramReviews } from "@/components/reviews/ProgramReviews";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  TeacherProfileDialog, fullName as docenteNombre, initials as docenteIniciales, type Teacher,
} from "@/components/site/TeacherProfileDialog";

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
    let stats: { promedio: number | null; total: number | null } | null = null;
    if (data?.id) {
      const { data: s } = await (supabase.from as any)("program_rating_stats")
        .select("promedio,total")
        .eq("programa_id", data.id)
        .maybeSingle();
      stats = (s as any) ?? null;
    }
    return { programa: data ?? null, stats };
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
    const total = Number(loaderData?.stats?.total ?? 0);
    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Course",
      name: p.titulo,
      description,
      provider: {
        "@type": "Organization",
        name: "Academia Ceapsi RD",
        sameAs: SITE_URL,
      },
    };
    if (total > 0) {
      jsonLd.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: Number(loaderData?.stats?.promedio ?? 0),
        reviewCount: total,
        bestRating: 5,
        worstRating: 1,
      };
    }
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
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(jsonLd) },
      ],
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


  type ModuloCatalog = { id: string; titulo: string; descripcion: string | null; orden: number; duracion_minutos: number | null; es_en_vivo: boolean | null; fecha_sesion: string | null; modulo_id: string | null; docente_id: string | null };
  const { data: modulos = [] } = useQuery<ModuloCatalog[]>({
    queryKey: ["public", "modulos", programa?.id],
    enabled: !!programa?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("program_modules_catalog")
        .select("id,titulo,descripcion,orden,duracion_minutos,es_en_vivo,fecha_sesion,modulo_id,docente_id")
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

  const docenteIds = useMemo(() => {
    const s = new Set<string>();
    if (programa?.docente_id) s.add(programa.docente_id);
    for (const m of modulos) if (m.docente_id) s.add(m.docente_id);
    return Array.from(s).sort();
  }, [programa?.docente_id, modulos]);

  const { data: docentesRaw = [] } = useQuery<any[]>({
    queryKey: ["public", "programa-docentes", docenteIds],
    enabled: docenteIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("teachers_public")
        .select("id,nombre,apellido,titulo,especialidad,biografia,avatar_url,linkedin_url,orden")
        .in("id", docenteIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const conteoLecciones = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of modulos) if (m.docente_id) c[m.docente_id] = (c[m.docente_id] ?? 0) + 1;
    return c;
  }, [modulos]);

  const docentes = useMemo(() => {
    const principal = programa?.docente_id ?? null;
    return [...docentesRaw].sort((a, b) => {
      const pa = a.id === principal ? 0 : 1;
      const pb = b.id === principal ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const ca = conteoLecciones[a.id] ?? 0;
      const cb = conteoLecciones[b.id] ?? 0;
      if (ca !== cb) return cb - ca;
      const oa = a.orden ?? 0;
      const ob = b.orden ?? 0;
      if (oa !== ob) return oa - ob;
      return `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`);
    }) as (Teacher & { orden: number | null })[];
  }, [docentesRaw, programa?.docente_id, conteoLecciones]);

  const docentePorId = useMemo(
    () => new Map(docentes.map((d) => [d.id, d])),
    [docentes],
  );

  const [perfil, setPerfil] = useState<Teacher | null>(null);
  const [verTodosDocentes, setVerTodosDocentes] = useState(false);

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

  const tituloModulo = (modulo_id: string | null) =>
    modulo_id ? (courseModules.find((c) => c.id === modulo_id)?.titulo ?? null) : null;

  const leccionesDe = (docenteId: string) =>
    modulos
      .filter((m) => m.docente_id === docenteId)
      .map((m) => ({
        titulo: m.titulo,
        modulo: programa.tipo === "diplomado" ? tituloModulo(m.modulo_id) : null,
      }));

  const botonDocente = (d: Teacher, extraClass = "") => (
    <button
      type="button"
      onClick={() => setPerfil(d)}
      className={`text-left font-medium text-foreground hover:text-primary hover:underline ${extraClass}`}
    >
      {docenteNombre(d)}
    </button>
  );

  const lineaDocenteLeccion = (id: string | null) => {
    const d = id ? docentePorId.get(id) : undefined;
    if (!d) return null;
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        Docente: {botonDocente(d, "text-xs")}
      </p>
    );
  };

  const docentesVisibles = verTodosDocentes ? docentes : docentes.slice(0, 5);


  return (
    <PublicLayout>
      <section className="relative border-b">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/5 to-background"
        />
        <div className="relative container mx-auto grid gap-8 px-4 py-12 lg:grid-cols-[2fr_1fr] lg:items-start">
          <div className="contents lg:col-start-1 lg:block lg:space-y-8">
            <div className="order-1">
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
                    const docentesMod = Array.from(
                      new Set(leccionesMod.map((m) => m.docente_id).filter(Boolean) as string[]),
                    )
                      .map((id) => docentePorId.get(id))
                      .filter(Boolean) as Teacher[];
                    return (
                      <div key={cm.id} className="rounded-lg border bg-card">
                        <div className="border-b bg-muted/40 px-4 py-3">
                          <h3 className="font-bold">
                            Módulo {idx + 1}: {cm.titulo}
                          </h3>
                          {cm.descripcion && (
                            <p className="mt-1 text-sm text-muted-foreground">{cm.descripcion}</p>
                          )}
                          {docentesMod.length > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Docentes del módulo:{" "}
                              {docentesMod.map((d, i) => (
                                <span key={d.id}>
                                  {i > 0 && ", "}
                                  {botonDocente(d, "text-xs")}
                                </span>
                              ))}
                            </p>
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
                                  {lineaDocenteLeccion(m.docente_id)}
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
                        {lineaDocenteLeccion(m.docente_id)}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <ProgramReviews
            programaId={programa.id}
            programaTitulo={programa.titulo}
            slug={programa.slug}
          />
        </div>

        <aside className="space-y-6">
          {docentes.length > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-bold">{docentes.length > 1 ? "Docentes" : "Docente"}</h3>
              <div className="mt-3 space-y-4">
                {docentesVisibles.map((d) => {
                  const esPrincipal = d.id === programa.docente_id;
                  const n = conteoLecciones[d.id] ?? 0;
                  return (
                    <div key={d.id} className="flex items-start gap-3">
                      <Avatar className="h-12 w-12">
                        {d.avatar_url && <AvatarImage src={d.avatar_url} alt={docenteNombre(d)} />}
                        <AvatarFallback className="bg-primary text-sm text-primary-foreground">
                          {docenteIniciales(d)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setPerfil(d)}
                          className="text-left font-semibold text-foreground hover:text-primary hover:underline"
                        >
                          {docenteNombre(d)}
                        </button>
                        {d.especialidad && (
                          <p className="text-xs text-muted-foreground">{d.especialidad}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {esPrincipal && (
                            <Badge variant="secondary" className="text-[11px]">Docente principal</Badge>
                          )}
                          {n > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {n} {n === 1 ? "lección" : "lecciones"} en este programa
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {docentes.length > 5 && !verTodosDocentes && (
                <Button
                  variant="link"
                  className="mt-2 h-auto p-0 text-sm text-primary"
                  onClick={() => setVerTodosDocentes(true)}
                >
                  Ver los {docentes.length} docentes
                </Button>
              )}
              {docentes.length === 1 && docentes[0].biografia && (
                <p className="mt-3 text-sm text-muted-foreground">{docentes[0].biografia}</p>
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
            <p className="text-xs leading-relaxed text-muted-foreground">
              Usaremos estos datos para gestionar tu inscripción conforme a nuestro{" "}
              <Link to="/privacidad" target="_blank" className="font-medium text-primary underline underline-offset-2">
                Aviso de Privacidad
              </Link>.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInscOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarInscripcion} disabled={submitting}>
              {submitting ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TeacherProfileDialog
        teacher={perfil}
        onClose={() => setPerfil(null)}
        lecciones={perfil ? leccionesDe(perfil.id) : undefined}
        mostrarVerTodos
      />

    </PublicLayout>
  );
}
