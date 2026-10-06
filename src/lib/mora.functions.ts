import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("No autorizado: se requiere rol admin.");
}

/** Admin: configuración, alumnos con su estado de mora, acuerdos y últimos avisos. */
export const adminGetMora = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const [cfg, estados, acuerdos, avisos, ultimaCorrida] = await Promise.all([
      db.from("mora_config").select("*").eq("id", true).maybeSingle(),
      db.from("mora_estado").select("*").order("dias_mora", { ascending: false }),
      db
        .from("mora_acuerdos")
        .select("*")
        .is("cerrado_at", null)
        .order("hasta", { ascending: true }),
      db
        .from("mora_avisos")
        .select("user_id, tipo, fecha, canales, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      db
        .from("balance_activo_webhook_logs")
        .select("created_at, processed, error, payload")
        .eq("event", "mora_diaria")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (estados.error) throw new Error(estados.error.message);

    const ids = Array.from(
      new Set<string>([
        ...((estados.data ?? []) as any[]).map((e) => e.user_id),
        ...((acuerdos.data ?? []) as any[]).map((a) => a.user_id),
      ]),
    );
    const perfiles = new Map<string, any>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await db
        .from("profiles")
        .select("id, nombre, apellido, telefono")
        .in("id", ids.slice(i, i + 200));
      for (const p of data ?? []) perfiles.set(p.id, p);
    }
    const correos = new Map<string, string>();
    await Promise.all(
      ids.map(async (id) => {
        const { data } = await db.auth.admin.getUserById(id);
        if (data?.user?.email) correos.set(id, data.user.email);
      }),
    );
    const ultimoAviso = new Map<string, any>();
    for (const a of (avisos.data ?? []) as any[]) {
      if (!ultimoAviso.has(a.user_id)) ultimoAviso.set(a.user_id, a);
    }

    const persona = (id: string) => {
      const p = perfiles.get(id);
      return {
        nombre: [p?.nombre, p?.apellido].filter(Boolean).join(" ").trim() || "(sin nombre)",
        telefono: p?.telefono ?? null,
        email: correos.get(id) ?? null,
      };
    };

    return {
      config: cfg.data ?? null,
      ultimaCorrida: ultimaCorrida.data ?? null,
      alumnos: ((estados.data ?? []) as any[]).map((e) => ({
        ...e,
        ...persona(e.user_id),
        ultimo_aviso: ultimoAviso.get(e.user_id) ?? null,
      })),
      acuerdos: ((acuerdos.data ?? []) as any[]).map((a) => ({ ...a, ...persona(a.user_id) })),
    };
  });

/** Admin: guarda los interruptores y el contacto que aparece en los avisos. */
export const adminSaveMoraConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        avisos_activos: z.boolean(),
        restriccion_activa: z.boolean(),
        contacto_direccion: z.string().trim().min(3).max(200),
        medios_pago: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Con la sesión del admin, para que la auditoría registre quién lo cambió.
    const { error } = await (context.supabase as any)
      .from("mora_config")
      .update({
        avisos_activos: data.avisos_activos,
        restriccion_activa: data.restriccion_activa,
        contacto_direccion: data.contacto_direccion,
        medios_pago: data.medios_pago || null,
        updated_by: context.userId,
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    // Encender o apagar la restricción tiene efecto inmediato.
    const { evaluarMora } = await import("@/lib/mora.server");
    const filas = await evaluarMora();
    return { ok: true, restringidos: filas.filter((f) => f.restringido).length };
  });

/** Admin: registra un acuerdo de pago (pausa avisos y devuelve el acceso hasta `hasta`). */
export const adminCrearAcuerdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        nota: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any).from("mora_acuerdos").insert({
      user_id: data.userId,
      hasta: data.hasta,
      nota: data.nota || null,
      creado_por: context.userId,
    });
    if (error) throw new Error(error.message);
    const { evaluarMora } = await import("@/lib/mora.server");
    await evaluarMora(data.userId);
    return { ok: true };
  });

/** Admin: cierra un acuerdo antes de tiempo. */
export const adminCerrarAcuerdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await (context.supabase as any)
      .from("mora_acuerdos")
      .update({ cerrado_at: new Date().toISOString(), cerrado_por: context.userId })
      .eq("id", data.id)
      .select("user_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row?.user_id) {
      const { evaluarMora } = await import("@/lib/mora.server");
      await evaluarMora(row.user_id);
    }
    return { ok: true };
  });

/** Admin: recalcula el estado de todos ahora (no envía avisos). */
export const adminEvaluarMora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { evaluarMora } = await import("@/lib/mora.server");
    const filas = await evaluarMora();
    return { evaluados: filas.length, restringidos: filas.filter((f) => f.restringido).length };
  });
