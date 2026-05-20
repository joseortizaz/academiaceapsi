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
      { auth: { autoRefreshToken: false, persistSession: false } }
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
    }) => input
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
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

    if (error) throw new Error(error.message);
    return {
      access_token: authData.session?.access_token,
      refresh_token: authData.session?.refresh_token,
      user: authData.user,
    };
  });
