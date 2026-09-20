import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { CheckCircle2, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/solicitud-curso")({
  head: () => ({
    meta: [
      { title: "Solicitar Curso o Diplomado — Ceapsi" },
      {
        name: "description",
        content:
          "Completa la solicitud para nuestros cursos y diplomados. Un asesor se pondrá en contacto contigo a la brevedad.",
      },
      { property: "og:title", content: "Solicitar Curso o Diplomado — Ceapsi" },
      {
        property: "og:description",
        content: "Un asesor se pondrá en contacto contigo.",
      },
    ],
  }),
  component: SolicitudCurso,
});

const PROVINCIAS_RD = [
  "Azua", "Baoruco", "Barahona", "Dajabón", "Distrito Nacional", "Duarte",
  "El Seibo", "Elías Piña", "Espaillat", "Hato Mayor", "Hermanas Mirabal",
  "Independencia", "La Altagracia", "La Romana", "La Vega", "María Trinidad Sánchez",
  "Monseñor Nouel", "Monte Cristi", "Monte Plata", "Pedernales", "Peravia",
  "Puerto Plata", "Samaná", "San Cristóbal", "San José de Ocoa", "San Juan",
  "San Pedro de Macorís", "Sánchez Ramírez", "Santiago", "Santiago Rodríguez",
  "Santo Domingo", "Valverde",
];

const NIVELES_ESTUDIO = [
  "Bachiller",
  "Técnico Superior",
  "Estudiante Universitario",
  "Grado / Licenciatura",
  "Especialidad",
  "Maestría",
  "Doctorado",
];

const CODIGOS_PAIS = [
  { code: "+1", label: "+1 (RD)" },
  { code: "+1-us", label: "+1 (USA)" },
  { code: "+34", label: "+34 (ESP)" },
  { code: "+52", label: "+52 (MEX)" },
  { code: "+57", label: "+57 (COL)" },
  { code: "+58", label: "+58 (VEN)" },
  { code: "+51", label: "+51 (PER)" },
  { code: "+54", label: "+54 (ARG)" },
];

const DEFAULT_PROGRAMAS: Record<"curso" | "diplomado", string[]> = {
  curso: [
    "Curso de Marketing Digital",
    "Curso de Excel Avanzado para Negocios",
    "Curso de Introducción a la Programación Web",
    "Curso de Gestión de Proyectos con Scrum",
  ],
  diplomado: [
    "Diplomado en Ciencia de Datos y Analítica",
    "Diplomado en Gestión Empresarial",
    "Diplomado en Ciberseguridad",
    "Diplomado en Recursos Humanos",
    "Diplomado Intervención Psicológica Infanto-Juvenil",
    "Diplomado Intervención en Trastornos del Neurodesarrollo",
    "Diplomado en Planificación Estratégica para Psicólogos y Orientadores",
    "Diplomado en Diagnóstico y Formulación Clínica según el DSM-V-TR",
    "Diplomado en Psicología Clínica Aplicada: evaluación e intervención en Contextos de Salud",
    "Diplomado Atención al Cliente y Ventas con Enfoque Psicológico",
    "Diplomado Liderazgo y Gestión Humana",
  ],
};

const schema = z.object({
  nombre_completo: z.string().trim().min(3, "Ingresa nombre y apellidos").max(120),
  email: z.string().trim().email("Correo inválido").max(160),
  codigo_pais: z.string().min(1),
  telefono: z
    .string()
    .trim()
    .min(7, "Teléfono demasiado corto")
    .max(20)
    .regex(/^[0-9()+\-\s]+$/, "Solo números y guiones"),
  tipo_documento: z.enum(["cedula", "pasaporte"]),
  numero_documento: z
    .string()
    .trim()
    .min(5, "Documento inválido")
    .max(30)
    .regex(/^[A-Za-z0-9-]+$/, "Solo letras, números y guiones"),
  nivel_estudios: z.string().min(1, "Selecciona un nivel"),
  provincia: z.string().min(1, "Selecciona una provincia"),
  tipo_formacion: z.enum(["curso", "diplomado"]),
  programa: z.string().min(1, "Selecciona un programa"),
  modalidad: z.enum(["presencial", "online_vivo", "online_asincronico"], {
    errorMap: () => ({ message: "Selecciona una modalidad" }),
  }),
});

type FormState = z.infer<typeof schema>;

const INITIAL: FormState = {
  nombre_completo: "",
  email: "",
  codigo_pais: "+1",
  telefono: "",
  tipo_documento: "cedula",
  numero_documento: "",
  nivel_estudios: "",
  provincia: "",
  tipo_formacion: "curso",
  programa: "",
  modalidad: "" as unknown as FormState["modalidad"],
};

function SolicitudCurso() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [programas, setProgramas] = useState<Record<"curso" | "diplomado", string[]>>(DEFAULT_PROGRAMAS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("course_request_options")
        .select("tipo,nombre,activo,orden")
        .eq("activo", true)
        .order("orden", { ascending: true });
      if (cancelled || error || !data || data.length === 0) return;
      const grouped: Record<"curso" | "diplomado", string[]> = { curso: [], diplomado: [] };
      for (const row of data) {
        const t = row.tipo as "curso" | "diplomado";
        if (t === "curso" || t === "diplomado") grouped[t].push(row.nombre);
      }
      if (grouped.curso.length === 0) grouped.curso = DEFAULT_PROGRAMAS.curso;
      if (grouped.diplomado.length === 0) grouped.diplomado = DEFAULT_PROGRAMAS.diplomado;
      setProgramas(grouped);
    })();
    return () => { cancelled = true; };
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => {
      if (key === "tipo_formacion" && value !== prev.tipo_formacion) {
        return { ...prev, [key]: value, programa: "" };
      }
      return { ...prev, [key]: value };
    });
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privacyAccepted) {
      toast.error("Debes aceptar el Aviso de Privacidad.");
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Revisa los campos del formulario");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/course-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("No pudimos enviar tu solicitud", {
          description: json?.error ?? "Intenta nuevamente en unos momentos.",
        });
        setSubmitting(false);
        return;
      }
      toast.success("¡Solicitud enviada con éxito!", {
        description: json?.emailSent
          ? "Te enviamos un correo de confirmación."
          : undefined,
      });
      setSuccess(true);
      setForm(INITIAL);
      setPrivacyAccepted(false);
    } catch (err) {
      toast.error("Error de conexión", {
        description: err instanceof Error ? err.message : "Intenta nuevamente.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <section className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-foreground/10">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Solicitar Curso / Diplomado
            </h1>
            <p className="mt-3 text-base text-primary-foreground/80 md:text-lg">
              Un asesor se pondrá en contacto contigo
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 md:py-14">
        <div className="mx-auto max-w-3xl">
          {success ? (
            <Card className="border-border">
              <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
                <CheckCircle2 className="h-14 w-14 text-primary" />
                <h2 className="text-2xl font-bold text-foreground">
                  ¡Gracias por tu solicitud!
                </h2>
                <p className="max-w-md text-muted-foreground">
                  Hemos recibido tu información correctamente. Un asesor académico se
                  pondrá en contacto contigo en menos de 24 horas hábiles.
                </p>
                <Button onClick={() => setSuccess(false)} className="mt-2">
                  Enviar otra solicitud
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border">
              <CardContent className="p-6 md:p-8">
                <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
                  <Field label="Nombre y Apellidos" required error={errors.nombre_completo} className="sm:col-span-2">
                    <Input
                      value={form.nombre_completo}
                      onChange={(e) => update("nombre_completo", e.target.value)}
                      placeholder="Ej. María García López"
                      maxLength={120}
                    />
                  </Field>

                  <Field label="Correo Electrónico" required error={errors.email} className="sm:col-span-2">
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="correo@ejemplo.com"
                      maxLength={160}
                    />
                  </Field>

                  <Field label="Número de Contacto" required error={errors.telefono} className="sm:col-span-2">
                    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2">
                      <Select value={form.codigo_pais} onValueChange={(v) => update("codigo_pais", v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CODIGOS_PAIS.map((c) => (
                            <SelectItem key={c.label} value={c.code}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={form.telefono}
                        onChange={(e) => update("telefono", e.target.value)}
                        placeholder="809-000-0000"
                        maxLength={20}
                      />
                    </div>
                  </Field>

                  <Field label="Cédula o Pasaporte" required error={errors.numero_documento} className="sm:col-span-2">
                    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2">
                      <Select
                        value={form.tipo_documento}
                        onValueChange={(v) => update("tipo_documento", v as FormState["tipo_documento"])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cedula">Cédula</SelectItem>
                          <SelectItem value="pasaporte">Pasaporte</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={form.numero_documento}
                        onChange={(e) => update("numero_documento", e.target.value)}
                        placeholder="Ej. 00100123456"
                        maxLength={30}
                      />
                    </div>
                  </Field>

                  <Field label="Nivel de Estudios" required error={errors.nivel_estudios}>
                    <Select value={form.nivel_estudios} onValueChange={(v) => update("nivel_estudios", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un nivel" />
                      </SelectTrigger>
                      <SelectContent>
                        {NIVELES_ESTUDIO.map((n) => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Provincia de Residencia" required error={errors.provincia}>
                    <Select value={form.provincia} onValueChange={(v) => update("provincia", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una provincia" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVINCIAS_RD.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <div className="flex items-start gap-2 sm:col-span-2">
                    <Checkbox
                      id="privacidad-solicitud"
                      checked={privacyAccepted}
                      onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                      required
                    />
                    <Label htmlFor="privacidad-solicitud" className="text-xs font-normal leading-relaxed text-muted-foreground">
                      Acepto el{" "}<Link to="/privacidad" target="_blank" className="font-medium text-primary underline underline-offset-2">Aviso de Privacidad</Link>{" "}
                      y el tratamiento de mis datos para responder mi solicitud.
                    </Label>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="my-2 border-t border-border" />
                    <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Oferta Académica
                    </h3>
                  </div>

                  <Field label="Tipo de Formación" required className="sm:col-span-2">
                    <RadioGroup
                      value={form.tipo_formacion}
                      onValueChange={(v) => update("tipo_formacion", v as FormState["tipo_formacion"])}
                      className="grid grid-cols-2 gap-3"
                    >
                      {(["curso", "diplomado"] as const).map((opt) => (
                        <label
                          key={opt}
                          className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors ${
                            form.tipo_formacion === opt
                              ? "border-primary bg-primary/5"
                              : "border-input hover:bg-accent/40"
                          }`}
                        >
                          <RadioGroupItem value={opt} />
                          <span className="text-sm font-medium capitalize text-foreground">
                            {opt}
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </Field>

                  <Field label="Selección de Programa" required error={errors.programa} className="sm:col-span-2">
                    <Select
                      value={form.programa}
                      onValueChange={(v) => update("programa", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Selecciona un ${form.tipo_formacion}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {programas[form.tipo_formacion].map((p: string) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Modalidad de tu Interés" required error={errors.modalidad} className="sm:col-span-2">
                    <RadioGroup
                      value={form.modalidad}
                      onValueChange={(v) => update("modalidad", v as FormState["modalidad"])}
                      className="grid gap-3 sm:grid-cols-3"
                    >
                      {([
                        { value: "presencial", label: "Presencial", desc: "Clases en el aula" },
                        { value: "online_vivo", label: "Online en vivo", desc: "Clases virtuales sincrónicas" },
                        { value: "online_asincronico", label: "Online asincrónico", desc: "A tu propio ritmo" },
                      ] as const).map((opt) => (
                        <label
                          key={opt.value}
                          className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors ${
                            form.modalidad === opt.value
                              ? "border-primary bg-primary/5"
                              : "border-input hover:bg-accent/40"
                          }`}
                        >
                          <RadioGroupItem value={opt.value} className="mt-0.5" />
                          <span className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{opt.label}</span>
                            <span className="text-xs text-muted-foreground">{opt.desc}</span>
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </Field>


                  <div className="sm:col-span-2">
                    <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                      {submitting ? "Enviando..." : "Enviar Solicitud"}
                    </Button>
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                      Los campos marcados con <span className="text-destructive">*</span> son obligatorios.
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

function Field({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
