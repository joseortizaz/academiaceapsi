import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_certificates",
  title: "Mis certificados",
  description:
    "Lista los certificados emitidos al usuario autenticado, con número, fecha, estado y código de verificación.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("certificates")
      .select("id, numero_certificado, fecha_emision, estado, programa_id, verification_code")
      .eq("user_id", ctx.getUserId())
      .order("fecha_emision", { ascending: false });
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const ids = (data ?? []).map((c) => c.programa_id);
    let programas: Array<{ id: string; titulo: string; tipo: string }> = [];
    if (ids.length > 0) {
      const { data: progs } = await supabase
        .from("programs")
        .select("id, titulo, tipo")
        .in("id", ids);
      programas = (progs as typeof programas) ?? [];
    }
    const rows = (data ?? []).map((c) => ({
      ...c,
      programa: programas.find((p) => p.id === c.programa_id) ?? null,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { certificados: rows },
    };
  },
});
