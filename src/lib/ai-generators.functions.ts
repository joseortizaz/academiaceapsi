import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
// unpdf se importa dinámicamente dentro del handler: su bundle (pdfjs) es enorme
// y rompe el análisis estático del plugin de build si entra al grafo de importación.

async function assertAdminOrDocente(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string);
  if (!roles.includes("admin") && !roles.includes("docente")) {
    throw new Error("No autorizado: se requiere rol admin o docente.");
  }
}

function assertSafePdfUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL de PDF inválida");
  }
  if (url.protocol !== "https:") {
    throw new Error("Solo se permiten URLs HTTPS");
  }
  const host = url.hostname.toLowerCase();
  const supabaseHost = (process.env.SUPABASE_URL ?? "").replace(/^https?:\/\//, "").split("/")[0];
  const allowedSuffixes = [
    ".supabase.co",
    ".supabase.in",
  ];
  const isSupabase = supabaseHost && host === supabaseHost;
  const isAllowed = isSupabase || allowedSuffixes.some((s) => host.endsWith(s));
  if (!isAllowed) {
    throw new Error("Dominio de URL no permitido");
  }
  // Bloquear hosts internos por seguridad
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.startsWith("169.254.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error("Host interno bloqueado");
  }
}


const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

async function callLovableAI(messages: unknown[], opts?: { responseFormat?: "json_object"; model?: string }) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");

  const body: Record<string, unknown> = {
    model: opts?.model ?? DEFAULT_MODEL,
    messages,
  };
  if (opts?.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) throw new Error("Límite de uso de IA alcanzado. Inténtalo en unos minutos.");
  if (res.status === 402) throw new Error("Créditos de IA agotados. Agrega créditos en Lovable Cloud.");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Error de IA: ${res.status} ${t}`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Respuesta vacía de la IA");
  return content;
}

function safeJsonParse(text: string) {
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("La IA no devolvió JSON válido");
  }
}

// =====================================================================
// 1) GENERAR PREGUNTAS DE EXAMEN A PARTIR DE UN PDF
// =====================================================================
export const generateQuizFromPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    pdfUrl: string;
    cantidad?: number;
    tipo?: "opcion_multiple" | "verdadero_falso" | "mixto";
    idioma?: string;
    nivel?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdminOrDocente(context.userId);
    assertSafePdfUrl(data.pdfUrl);

    const cantidad = Math.min(Math.max(data.cantidad ?? 5, 1), 20);
    const tipo = data.tipo ?? "mixto";
    const idioma = data.idioma ?? "español";
    const nivel = data.nivel ?? "intermedio";

    // Descargar PDF
    const pdfRes = await fetch(data.pdfUrl, { redirect: "error" });
    if (!pdfRes.ok) throw new Error("No se pudo descargar el PDF");
    const buf = new Uint8Array(await pdfRes.arrayBuffer());
    if (buf.byteLength > 15 * 1024 * 1024) throw new Error("El PDF supera el tamaño máximo (15 MB).");

    // El modelo (Gemini) lee el PDF directamente: se envía como archivo adjunto en base64.
    const pdfBase64 = Buffer.from(buf).toString("base64");

    const tipoInstruccion =
      tipo === "opcion_multiple" ? "Todas las preguntas deben ser de opción múltiple con 4 opciones."
      : tipo === "verdadero_falso" ? "Todas las preguntas deben ser de verdadero/falso."
      : "Mezcla preguntas de opción múltiple (con 4 opciones) y verdadero/falso.";

    const system = `Eres un experto pedagogo. Generas evaluaciones académicas en ${idioma} de nivel ${nivel}. Devuelves SIEMPRE JSON válido sin texto adicional.`;

    const user = `A partir del siguiente material de un curso, genera ${cantidad} preguntas de evaluación.
${tipoInstruccion}

Devuelve EXACTAMENTE este JSON:
{
  "preguntas": [
    {
      "enunciado": "string",
      "tipo": "opcion_multiple" | "verdadero_falso",
      "opciones": ["opcion1","opcion2","opcion3","opcion4"] | null,
      "respuesta_correcta": "string exacta de una de las opciones, o 'verdadero'/'falso'",
      "puntaje": 1
    }
  ]
}

Reglas:
- "opciones" es un arreglo de 4 strings para opción múltiple, o null para verdadero/falso.
- "respuesta_correcta" debe coincidir EXACTAMENTE con una opción (o "verdadero"/"falso").
- Las preguntas deben ser claras, sin ambigüedad y basadas en el material.

MATERIAL:
"""
${cleaned}
"""`;

    const content = await callLovableAI(
      [{ role: "system", content: system }, { role: "user", content: user }],
      { responseFormat: "json_object" },
    );

    const parsed = safeJsonParse(content);
    if (!parsed?.preguntas || !Array.isArray(parsed.preguntas)) {
      throw new Error("Formato de respuesta inesperado");
    }
    return { preguntas: parsed.preguntas };
  });

// =====================================================================
// 2) GENERAR CONTENIDO DE LECCIÓN DESDE LA WEB (Firecrawl + IA)
// =====================================================================
export const generateLessonFromWeb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    tema: string;
    objetivos?: string;
    idioma?: string;
    nivel?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdminOrDocente(context.userId);
    const fcKey = process.env.FIRECRAWL_API_KEY;
    const idioma = data.idioma ?? "español";
    const nivel = data.nivel ?? "intermedio";

    let fuentes: { url: string; title?: string; snippet?: string; markdown?: string }[] = [];

    if (fcKey) {
      // Buscar fuentes con Firecrawl
      const sr = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${fcKey}` },
        body: JSON.stringify({
          query: data.tema,
          limit: 5,
          scrapeOptions: { formats: ["markdown"] },
        }),
      });
      if (sr.ok) {
        const sd = await sr.json();
        const results = sd?.data?.web ?? sd?.data ?? [];
        fuentes = results.slice(0, 5).map((r: { url?: string; title?: string; description?: string; markdown?: string }) => ({
          url: r.url ?? "",
          title: r.title,
          snippet: r.description,
          markdown: (r.markdown ?? "").slice(0, 3000),
        }));
      }
    }

    const fuentesText = fuentes.length
      ? fuentes.map((f, i) => `[${i + 1}] ${f.title ?? f.url}\nURL: ${f.url}\n${f.markdown ?? f.snippet ?? ""}`).join("\n\n---\n\n")
      : "(Sin fuentes web disponibles. Genera el contenido a partir de tu conocimiento general.)";

    const system = `Eres un docente experto que diseña material educativo en ${idioma} de nivel ${nivel}. Devuelves SIEMPRE JSON válido.`;

    const user = `Genera una lección académica completa sobre el tema: "${data.tema}".
${data.objetivos ? `Objetivos de aprendizaje: ${data.objetivos}` : ""}

Usa el siguiente material de referencia (cita las fuentes con [n]):
${fuentesText}

Devuelve EXACTAMENTE este JSON:
{
  "titulo": "string",
  "introduccion": "string (1-2 párrafos)",
  "contenido_markdown": "string en Markdown con secciones, listas y ejemplos. Incluye citas [1], [2] cuando uses información de las fuentes.",
  "puntos_clave": ["string","string","string"],
  "fuentes": [{"n": 1, "titulo": "string", "url": "string"}]
}`;

    const content = await callLovableAI(
      [{ role: "system", content: system }, { role: "user", content: user }],
      { responseFormat: "json_object", model: "google/gemini-2.5-pro" },
    );

    const parsed = safeJsonParse(content);
    return {
      ...parsed,
      _firecrawl_disponible: !!fcKey,
      _fuentes_encontradas: fuentes.length,
    };
  });
