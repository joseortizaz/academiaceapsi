import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_courses",
  title: "Mis cursos matriculados",
  description:
    "Lista los programas (cursos y diplomados) en los que el usuario autenticado está inscrito, con su fecha de inscripción.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: enrolls, error } = await supabase
      .from("enrollments")
      .select("id, programa_id, fecha_inscripcion, estado")
      .eq("user_id", ctx.getUserId())
      .order("fecha_inscripcion", { ascending: false });
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const ids = (enrolls ?? []).map((e) => e.programa_id);
    let programas: Array<{ id: string; titulo: string; slug: string; tipo: string; modalidad: string }> = [];
    if (ids.length > 0) {
      const { data } = await supabase
        .from("programs")
        .select("id, titulo, slug, tipo, modalidad")
        .in("id", ids);
      programas = (data as typeof programas) ?? [];
    }
    const rows = (enrolls ?? []).map((e) => {
      const p = programas.find((x) => x.id === e.programa_id);
      return {
        enrollment_id: e.id,
        estado: e.estado,
        fecha_inscripcion: e.fecha_inscripcion,
        programa: p
          ? { id: p.id, titulo: p.titulo, slug: p.slug, tipo: p.tipo, modalidad: p.modalidad }
          : null,
      };
    });
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { cursos: rows },
    };
  },
});
