import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCurrentUserProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

    if (profileError) throw profileError;
    if (rolesError) throw rolesError;

    const roleList = (roles ?? []).map((r) => r.role);
    const primaryRole = roleList.includes("admin")
      ? "admin"
      : roleList.includes("docente")
        ? "docente"
        : "estudiante";

    return {
      profile: profile ?? null,
      roles: roleList,
      primaryRole,
    };
  });

export const signInWithEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => input)
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) throw new Error(error.message);
    return {
      access_token: authData.session?.access_token,
      refresh_token: authData.session?.refresh_token,
      user: authData.user,
    };
  });

export const signUpWithEmail = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      email: string;
      password: string;
      nombre: string;
      apellido: string;
      telefono?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          nombre: data.nombre,
          apellido: data.apellido,
          telefono: data.telefono,
        },
      },
    });

    if (error) {
      if (/already|registered|exists/i.test(error.message)) throw new Error(EMAIL_YA_REGISTRADO);
      throw new Error(error.message);
    }
    // Correo existente con confirmación activa: Supabase devuelve un usuario sin identidades.
    if (authData.user && (authData.user.identities?.length ?? 0) === 0) {
      throw new Error(EMAIL_YA_REGISTRADO);
    }
    return {
      access_token: authData.session?.access_token,
      refresh_token: authData.session?.refresh_token,
      user: authData.user,
    };
  });

export const EMAIL_YA_REGISTRADO = "Ya existe una cuenta registrada con ese correo electrónico.";

/**
 * Comprueba si un correo ya tiene cuenta antes de registrarlo.
 * Supabase Auth, con confirmación de correo activa, responde "éxito" al
 * registrar un correo existente, así que la comprobación se hace aquí.
 * Devuelve `null` si no se pudo comprobar (p. ej. migración sin aplicar);
 * en ese caso el formulario sigue y se apoya en la respuesta de signUp.
 */
export const verificarEmailRegistrado = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => {
    const email = String(input?.email ?? "")
      .trim()
      .toLowerCase();
    if (!email || email.length > 320 || !email.includes("@")) {
      throw new Error("Correo electrónico no válido");
    }
    return { email };
  })
  .handler(async ({ data }): Promise<{ registrado: boolean | null }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existe, error } = await supabaseAdmin.rpc("email_registrado", {
        p_email: data.email,
      });
      if (error) {
        console.error("[registro] email_registrado falló:", error.message);
        return { registrado: null };
      }
      return { registrado: existe === true };
    } catch (err) {
      console.error("[registro] email_registrado falló:", err);
      return { registrado: null };
    }
  });
