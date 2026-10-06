/**
 * Motor de mora. La lógica de cálculo vive en la función SQL `mora_evaluar`
 * (migración 0012); aquí se ejecuta y, si los avisos están activados, se envían
 * por correo y por la campana del portal.
 */
import { SITE_URL } from "@/lib/site";
import { hoyRD, textoAviso, type DatosAvisoMora, type TipoAvisoMora } from "@/lib/mora-textos";

export type MoraEstadoRow = {
  user_id: string;
  etapa: string;
  dias_mora: number;
  cuotas_vencidas: number;
  monto_vencido: number;
  cuota_antigua_ref: string | null;
  cuota_antigua_venc: string | null;
  cuota_antigua_saldo: number | null;
  proxima_ref: string | null;
  proxima_venc: string | null;
  proxima_saldo: number | null;
  deberia_restringir: boolean;
  restringido: boolean;
  restringido_desde: string | null;
  acuerdo_id: string | null;
  datos_sync_at: string | null;
  datos_frescos: boolean;
  aviso_hoy: TipoAvisoMora | null;
  aviso_ref: string | null;
  previo_ref: string | null;
  evaluado_at: string;
};

export type MoraConfig = {
  avisos_activos: boolean;
  restriccion_activa: boolean;
  contacto_direccion: string;
  medios_pago: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function leerConfigMora(): Promise<MoraConfig> {
  const db = await admin();
  const { data } = await db.from("mora_config").select("*").eq("id", true).maybeSingle();
  return {
    avisos_activos: !!data?.avisos_activos,
    restriccion_activa: !!data?.restriccion_activa,
    contacto_direccion: data?.contacto_direccion ?? "admin@ceapsird.com",
    medios_pago: data?.medios_pago ?? null,
  };
}

/** Recalcula el estado de mora (de un alumno o de todos). No envía nada. */
export async function evaluarMora(userId?: string): Promise<MoraEstadoRow[]> {
  const db = await admin();
  const { data, error } = await db.rpc("mora_evaluar", userId ? { _user: userId } : {});
  if (error) throw new Error(`mora_evaluar: ${error.message}`);
  return (data ?? []) as MoraEstadoRow[];
}

/** Igual que evaluarMora, pero nunca lanza (para llamarla tras sincronizar). */
export async function evaluarMoraSilencioso(userId: string): Promise<void> {
  try {
    await evaluarMora(userId);
  } catch (e) {
    console.error("[mora] evaluación tras sincronizar falló", e);
  }
}

type Resumen = {
  evaluados: number;
  etapas: Record<string, number>;
  restringidos: number;
  sin_datos_frescos: number;
  avisos_activos: boolean;
  restriccion_activa: boolean;
  avisos_pendientes: Record<string, number>;
  enviados: number;
  errores: Array<{ userId: string; tipo: string; motivo: string }>;
};

/**
 * Corrida diaria (8:00 a. m. hora RD): evalúa a todos y, si los avisos están
 * activados, envía como máximo un mensaje por alumno (el más serio; si además
 * vence pronto la próxima cuota, el mensaje la menciona).
 */
export async function ejecutarMoraDiaria(): Promise<Resumen> {
  const db = await admin();
  const cfg = await leerConfigMora();
  const filas = await evaluarMora();

  const resumen: Resumen = {
    evaluados: filas.length,
    etapas: {},
    restringidos: 0,
    sin_datos_frescos: 0,
    avisos_activos: cfg.avisos_activos,
    restriccion_activa: cfg.restriccion_activa,
    avisos_pendientes: {},
    enviados: 0,
    errores: [],
  };

  for (const f of filas) {
    resumen.etapas[f.etapa] = (resumen.etapas[f.etapa] ?? 0) + 1;
    if (f.restringido) resumen.restringidos++;
    if (!f.datos_frescos && f.etapa !== "al_dia") resumen.sin_datos_frescos++;
    const tipo = f.aviso_hoy ?? (f.previo_ref ? "previo" : null);
    if (tipo) resumen.avisos_pendientes[tipo] = (resumen.avisos_pendientes[tipo] ?? 0) + 1;
  }

  if (cfg.avisos_activos) {
    const pendientes = filas.filter((f) => f.aviso_hoy || f.previo_ref);
    for (const f of pendientes) {
      try {
        const ok = await enviarAvisoDelDia(f, cfg);
        if (ok) resumen.enviados++;
      } catch (e) {
        resumen.errores.push({
          userId: f.user_id,
          tipo: f.aviso_hoy ?? "previo",
          motivo: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  if (resumen.sin_datos_frescos > 0) await alertarDatosViejos(resumen.sin_datos_frescos);

  await db.from("balance_activo_webhook_logs").insert({
    event: "mora_diaria",
    signature_valid: true,
    processed: resumen.errores.length === 0,
    error: resumen.errores.length ? `${resumen.errores.length} fallos` : null,
    payload: resumen,
  });

  return resumen;
}

async function enviarAvisoDelDia(f: MoraEstadoRow, cfg: MoraConfig): Promise<boolean> {
  const db = await admin();
  const { sendTransactionalEmail } = await import("@/lib/email/send-transactional.server");

  // El aviso grave manda; el recordatorio previo se incluye en él si coincide.
  const tipo: TipoAvisoMora = f.aviso_hoy ?? "previo";
  const esPrevio = tipo === "previo";
  const ref = esPrevio ? f.previo_ref! : f.aviso_ref!;
  const monto = Number(esPrevio ? f.proxima_saldo : f.cuota_antigua_saldo) || 0;
  const vencimiento = (esPrevio ? f.proxima_venc : f.cuota_antigua_venc) ?? "";
  if (!ref || !vencimiento) return false;

  const [{ data: perfil }, { data: authUser }] = await Promise.all([
    db.from("profiles").select("nombre, apellido").eq("id", f.user_id).maybeSingle(),
    db.auth.admin.getUserById(f.user_id),
  ]);
  const email: string | undefined = authUser?.user?.email ?? undefined;
  const nombre = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ").trim();

  const datos: DatosAvisoMora = {
    nombre,
    monto,
    vencimiento,
    saldoVencido: Number(f.monto_vencido) || 0,
    contacto: cfg.contacto_direccion,
    hoy: hoyRD(),
    proxima:
      !esPrevio && f.previo_ref && f.proxima_venc
        ? { monto: Number(f.proxima_saldo) || 0, vencimiento: f.proxima_venc }
        : null,
  };
  const texto = textoAviso(tipo, datos);
  const canales: string[] = [];

  // 1. Campana del portal
  const { error: nErr } = await db.from("notifications").insert({
    user_id: f.user_id,
    tipo: "mora",
    titulo: texto.asunto,
    mensaje: texto.corto,
    enlace: "/estudiante/facturacion",
  });
  if (!nErr) canales.push("portal");

  // 2. Correo
  if (email) {
    const r = await sendTransactionalEmail({
      templateName: "mora-aviso",
      recipientEmail: email,
      templateData: { tipo, ...datos, enlace: `${SITE_URL}/estudiante/facturacion` },
      idempotencyKey: `mora:${f.user_id}:${tipo}:${ref}`,
    });
    if (r.ok) canales.push("correo");
  }

  if (canales.length === 0) throw new Error("No se pudo enviar por ningún canal");

  // 3. Registro (evita repetir el mismo aviso para la misma cuota)
  const registros = [{ user_id: f.user_id, tipo, ref, canales }];
  if (!esPrevio && f.previo_ref) {
    registros.push({ user_id: f.user_id, tipo: "previo", ref: f.previo_ref, canales });
  }
  const { error: rErr } = await db
    .from("mora_avisos")
    .upsert(registros, { onConflict: "user_id,tipo,ref", ignoreDuplicates: true });
  if (rErr) throw new Error(`Registro de aviso: ${rErr.message}`);
  return true;
}

/** Avisa a los administradores (una vez al día) si hay alumnos sin datos recientes. */
async function alertarDatosViejos(cantidad: number): Promise<void> {
  const db = await admin();
  const { data: admins } = await db.from("user_roles").select("user_id").eq("role", "admin");
  const desde = new Date(Date.now() - 20 * 3600_000).toISOString();
  for (const a of (admins ?? []) as Array<{ user_id: string }>) {
    const { count } = await db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", a.user_id)
      .eq("tipo", "mora_alerta")
      .gte("created_at", desde);
    if (count) continue;
    await db.from("notifications").insert({
      user_id: a.user_id,
      tipo: "mora_alerta",
      titulo: "Mora: datos de Balance Activo sin actualizar",
      mensaje: `${cantidad} alumno(s) con deuda no tienen datos de Balance Activo de las últimas 24 horas. Hoy no se les envían avisos ni se les restringe.`,
      enlace: "/admin/mora",
    });
  }
}
