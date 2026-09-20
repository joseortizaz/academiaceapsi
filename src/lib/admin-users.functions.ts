import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("userId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.userId === userId) {
      throw new Error("No puedes eliminar tu propia cuenta");
    }

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("No autorizado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Leer identidad ANTES de eliminar, para poder registrarla en la auditoría.
    const { data: perfilPrevio } = await supabaseAdmin
      .from("profiles")
      .select("nombre,apellido")
      .eq("id", data.userId)
      .maybeSingle();
    const { data: authPrevio } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const nombrePrevio =
      `${perfilPrevio?.nombre ?? ""} ${perfilPrevio?.apellido ?? ""}`.trim() || null;
    const correoPrevio = authPrevio?.user?.email ?? null;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    // Limpieza defensiva por si no hay cascada
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorId: userId,
      accion: "eliminar_cuenta",
      entidad: "usuario",
      entidadId: data.userId,
      entidadEtiqueta: nombrePrevio ?? correoPrevio,
      sujetoId: data.userId,
      detalle: { correo: correoPrevio },
      sensible: true,
    });

    return { success: true };
  });

// ───────────────────────── Helpers ─────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarPassword(password: unknown, email?: string): string {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres");
  }
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) {
    throw new Error("La contraseña no puede ser igual al correo");
  }
  return password;
}

function normalizarEmail(email: unknown): string {
  const value = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(value)) throw new Error("Correo electrónico inválido");
  return value;
}

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("No autorizado");
}

// ───────────────────── Crear cuenta de alumno ─────────────────────

export const createStudentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      nombre: string;
      apellido: string;
      email: string;
      telefono?: string;
      password: string;
      programaId?: string;
    }) => {
      const nombre = (input?.nombre ?? "").trim();
      const apellido = (input?.apellido ?? "").trim();
      if (!nombre) throw new Error("El nombre es obligatorio");
      if (!apellido) throw new Error("El apellido es obligatorio");
      const email = normalizarEmail(input?.email);
      const password = validarPassword(input?.password, email);
      return {
        nombre,
        apellido,
        email,
        telefono: (input?.telefono ?? "").trim() || undefined,
        password,
        programaId: (input?.programaId ?? "").trim() || undefined,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nombre: data.nombre,
        apellido: data.apellido,
        telefono: data.telefono ?? null,
      },
      app_metadata: { must_change_password: true },
    });

    if (error || !created?.user) {
      const message = error?.message ?? "No se pudo crear la cuenta";
      if (/already/i.test(message) || /registered/i.test(message) || /exists/i.test(message)) {
        throw new Error("Ya existe una cuenta con ese correo");
      }
      throw new Error(message);
    }

    const newUserId = created.user.id;
    let enrollmentError: string | undefined;

    if (data.programaId) {
      const { error: enrErr } = await supabaseAdmin.from("enrollments").insert({
        user_id: newUserId,
        programa_id: data.programaId,
        estado: "activo",
        progreso_porcentaje: 0,
        nombre_completo: `${data.nombre} ${data.apellido}`,
        email_contacto: data.email,
        telefono_contacto: data.telefono ?? null,
      });
      if (enrErr) enrollmentError = enrErr.message;
    }

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorId: context.userId,
      accion: "crear_alumno",
      entidad: "usuario",
      entidadId: newUserId,
      entidadEtiqueta: `${data.nombre} ${data.apellido}`,
      sujetoId: newUserId,
      programaId: data.programaId ?? null,
      detalle: { correo: data.email, programaId: data.programaId, enrollmentError },
    });

    return { userId: newUserId, enrollmentError };
  });

// ───────────────── Restablecer contraseña (admin) ─────────────────

export const resetStudentPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) => {
    if (!input?.userId) throw new Error("userId requerido");
    return { userId: input.userId, password: validarPassword(input?.password) };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    if (data.userId === context.userId) {
      throw new Error("No puedes restablecer tu propia contraseña desde aquí");
    }

    const { data: targetIsAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: data.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (targetIsAdmin) {
      throw new Error("No se puede restablecer la contraseña de una cuenta administradora");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: getError } = await supabaseAdmin.auth.admin.getUserById(
      data.userId,
    );
    if (getError || !existing?.user) throw new Error("No se encontró la cuenta");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
      app_metadata: { ...(existing.user.app_metadata ?? {}), must_change_password: true },
    });
    if (error) throw new Error(error.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorId: context.userId,
      accion: "restablecer_password",
      entidad: "usuario",
      entidadId: data.userId,
      entidadEtiqueta: existing.user.email ?? null,
      sujetoId: data.userId,
      sensible: true,
    });

    return { success: true };
  });

// ───────────────── Info de autenticación (admin) ─────────────────

export const getUsersAuthInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const usuarios: {
      id: string;
      email: string | null;
      must_change_password: boolean;
      last_sign_in_at: string | null;
    }[] = [];

    let page = 1;
    for (;;) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      const batch = data?.users ?? [];
      for (const u of batch) {
        usuarios.push({
          id: u.id,
          email: u.email ?? null,
          must_change_password: (u.app_metadata as any)?.must_change_password === true,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
      if (batch.length < 1000) break;
      page += 1;
    }

    return usuarios;
  });

// ───────────── Cambio de contraseña provisional (propio) ─────────────

export const changeProvisionalPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { newPassword: string }) => ({
    newPassword: typeof input?.newPassword === "string" ? input.newPassword : "",
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: getError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (getError || !existing?.user) throw new Error("No se encontró la cuenta");

    if ((existing.user.app_metadata as any)?.must_change_password !== true) {
      throw new Error("No tienes un cambio de contraseña pendiente");
    }

    validarPassword(data.newPassword, existing.user.email ?? undefined);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.newPassword,
      app_metadata: { ...(existing.user.app_metadata ?? {}), must_change_password: false },
    });
    if (error) throw new Error(error.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      actorId: context.userId,
      categoria: "acceso",
      accion: "cambio_password",
      entidad: "usuario",
      entidadId: context.userId,
      entidadEtiqueta: existing.user.email ?? null,
      sujetoId: context.userId,
      detalle: { motivo: "provisional" },
    });

    return { success: true };
  });
