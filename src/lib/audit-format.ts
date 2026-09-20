export type AuditEvent = {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_nombre: string | null;
  actor_email: string | null;
  actor_rol: string;
  categoria: string;
  accion: string;
  entidad: string | null;
  entidad_id: string | null;
  entidad_etiqueta: string | null;
  programa_id: string | null;
  sujeto_id: string | null;
  cambios: Record<string, { antes?: unknown; despues?: unknown }> | null;
  detalle: Record<string, unknown> | null;
  sensible: boolean;
  ip: string | null;
  user_agent: string | null;
};

export const ENTIDADES: Record<string, string> = {
  enrollments: "inscripción",
  payments: "pago",
  certificates: "certificado",
  assessments: "evaluación",
  assessment_submissions: "entrega de evaluación",
  user_roles: "rol de usuario",
  profiles: "perfil",
  programs: "programa",
  program_modules: "lección",
  course_modules: "módulo",
  program_cohorts: "grupo",
  cohort_enrollments: "asignación a grupo",
  teachers: "docente",
  program_reviews: "valoración",
  testimonials: "testimonio",
  announcements: "anuncio",
  blog_posts: "artículo del blog",
  events: "evento",
  hero_slides: "diapositiva de portada",
  coupons: "cupón",
  zoom_licenses: "licencia de Zoom",
  program_access_links: "enlace de acceso",
  zoom_meetings: "clase en vivo",
  lesson_comments: "comentario",
  community_posts: "publicación de la comunidad",
  usuario: "cuenta",
  audit_log: "registro de auditoría",
  ia: "generación con IA",
};

export const CAMPOS: Record<string, string> = {
  precio: "precio",
  precio_descuento: "precio con descuento",
  estado: "estado",
  titulo: "título",
  descripcion: "descripción",
  nombre: "nombre",
  apellido: "apellido",
  telefono: "teléfono",
  is_active: "cuenta activa",
  role: "rol",
  monto: "monto",
  metodo: "método de pago",
  puntaje_obtenido: "puntaje",
  porcentaje: "porcentaje",
  feedback: "retroalimentación",
  publicado: "publicado",
  destacado: "destacado",
  fecha_inicio: "fecha de inicio",
  fecha_fin: "fecha de fin",
  start_at: "fecha y hora",
  duration_min: "duración (min)",
  rating: "estrellas",
  comentario: "comentario",
  activo: "activo",
  visible: "visible",
  orden: "orden",
};

export const ROLES: Record<string, string> = {
  admin: "Administrador",
  docente: "Docente",
  estudiante: "Alumno",
  sistema: "Sistema",
};

export const CATEGORIAS: Record<string, string> = {
  datos: "Datos",
  acceso: "Accesos",
  admin: "Administrativas",
  actividad: "Actividad",
};

export function nombreCampo(k: string) {
  return CAMPOS[k] ?? k.replace(/_/g, " ");
}

export function nombreEntidad(e: string | null) {
  if (!e) return "registro";
  return ENTIDADES[e] ?? e;
}

export function valorLegible(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  const s = String(v);
  return s.length === 0 ? "—" : s;
}

function corto(v: unknown, max = 60) {
  const s = valorLegible(v).replace(/\s+/g, " ");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export type Contexto = {
  nombres?: Map<string, string>;
  programas?: Map<string, string>;
};

export function describirEvento(ev: AuditEvent, ctx: Contexto = {}): string {
  const actor = ev.actor_nombre || ev.actor_email || "Sistema";
  const sujeto = (ev.sujeto_id && ctx.nombres?.get(ev.sujeto_id)) || ev.entidad_etiqueta || "un usuario";
  const etiqueta = ev.entidad_etiqueta ? `"${ev.entidad_etiqueta}"` : "";
  const ent = nombreEntidad(ev.entidad);
  const cambios = ev.cambios ?? {};
  const claves = Object.keys(cambios);

  if (ev.categoria === "acceso") {
    if (ev.accion === "login") return `${actor} inició sesión`;
    if (ev.accion === "cambio_password") return `${actor} cambió su contraseña provisional`;
    if (ev.accion === "registro") {
      const via = (ev.detalle?.["via"] as string) ?? "autoregistro";
      return `${actor} se registró (${via === "administrador" ? "por administrador" : "autoregistro"})`;
    }
  }

  switch (ev.accion) {
    case "crear_alumno":
      return `${actor} creó la cuenta del alumno ${ev.entidad_etiqueta ?? sujeto}`;
    case "restablecer_password":
      return `${actor} restableció la contraseña de ${ev.entidad_etiqueta ?? sujeto}`;
    case "eliminar_cuenta": {
      const correo = ev.detalle?.["correo"] as string | undefined;
      return `${actor} eliminó la cuenta de ${ev.entidad_etiqueta ?? sujeto}${correo ? ` (${correo})` : ""}`;
    }
    case "crear_clase_vivo":
      return `${actor} programó la clase en vivo ${etiqueta}`.trim();
    case "reprogramar_clase_vivo":
      return `${actor} reprogramó la clase en vivo ${etiqueta}`.trim();
    case "cancelar_clase_vivo":
      return `${actor} canceló la clase en vivo ${etiqueta}`.trim();
    case "asignar_licencia_zoom":
      return `${actor} asignó una licencia de Zoom${ev.entidad_etiqueta ? ` (${ev.entidad_etiqueta})` : ""}`;
    case "generar_contenido_ia":
      return `${actor} usó la generación con IA${ev.detalle?.["tipo"] ? ` (${ev.detalle["tipo"]})` : ""}`;
    case "exportar_auditoria":
      return `${actor} exportó el registro de auditoría (${ev.detalle?.["filas"] ?? 0} filas)`;
    default:
      break;
  }

  if (ev.entidad === "user_roles") {
    const rol = (cambios["role"]?.despues ?? cambios["role"]?.antes ?? ev.entidad_etiqueta) as string;
    const nombre = (ev.sujeto_id && ctx.nombres?.get(ev.sujeto_id)) || "un usuario";
    if (ev.accion === "insert") return `${actor} otorgó el rol ${rol} a ${nombre}`;
    if (ev.accion === "delete") return `${actor} quitó el rol ${rol} a ${nombre}`;
  }

  if (ev.entidad === "profiles" && cambios["is_active"]) {
    const activo = cambios["is_active"].despues === true;
    return `${actor} ${activo ? "reactivó" : "suspendió"} la cuenta de ${sujeto}`;
  }

  if (ev.entidad === "enrollments" && ev.accion === "update" && cambios["estado"] && claves.length === 1) {
    const c = cambios["estado"];
    return `${actor} cambió el estado de la inscripción de ${sujeto}: ${corto(c.antes)} → ${corto(c.despues)}`;
  }

  if (ev.entidad === "assessment_submissions" && ev.accion === "update" && (cambios["puntaje_obtenido"] || cambios["porcentaje"])) {
    const c = cambios["puntaje_obtenido"] ?? cambios["porcentaje"];
    return `${actor} cambió la calificación de ${sujeto} en ${etiqueta || "una evaluación"}: ${corto(c.antes)} → ${corto(c.despues)}`;
  }

  if (ev.accion === "insert") {
    return `${actor} creó ${articulo(ent)} ${ent}${etiqueta ? ` ${etiqueta}` : ""}`.trim();
  }
  if (ev.accion === "delete") {
    return `${actor} eliminó ${articulo(ent)} ${ent}${etiqueta ? ` ${etiqueta}` : ""}`.trim();
  }

  const detalles = claves.slice(0, 3).map((k) => `${nombreCampo(k)} ${corto(cambios[k].antes)} → ${corto(cambios[k].despues)}`);
  const extra = claves.length > 3 ? ` y ${claves.length - 3} cambios más` : "";
  return `${actor} modificó ${articulo(ent)} ${ent}${etiqueta ? ` ${etiqueta}` : ""}${
    detalles.length ? `: ${detalles.join("; ")}` : ""
  }${extra}`;
}

const FEMENINAS = new Set([
  "inscripción",
  "evaluación",
  "entrega de evaluación",
  "lección",
  "valoración",
  "diapositiva de portada",
  "licencia de Zoom",
  "clase en vivo",
  "publicación de la comunidad",
  "asignación a grupo",
  "cuenta",
]);

function articulo(ent: string) {
  return FEMENINAS.has(ent) ? "la" : "el";
}
