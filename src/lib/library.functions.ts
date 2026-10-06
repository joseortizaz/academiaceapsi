import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LIBRARY_FILES_BUCKET, downloadFileName } from "@/lib/library";

/** Duración del enlace firmado: suficiente para empezar la descarga, demasiado corto para compartirlo. */
const SIGNED_URL_SECONDS = 300;

/**
 * Devuelve un enlace temporal al PDF de un documento publicado de la Biblioteca Virtual.
 * Solo para usuarios con sesión iniciada (cualquier rol).
 *
 * - modo "descargar": el enlace fuerza la descarga con un nombre legible, suma 1 al
 *   contador y registra `descargar_libro` en la auditoría.
 * - modo "leer": enlace para mostrar el PDF en el visor; registra `ver_libro`.
 */
export const getLibraryDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      documentId: z.string().uuid(),
      modo: z.enum(["descargar", "leer"]).default("descargar"),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("./audit.server");
    const { assertAccountActive } = await import("./account-status.server");
    await assertAccountActive(context.userId);

    const { data: doc, error } = await supabaseAdmin
      .from("library_documents")
      .select("id, titulo, file_path, estado")
      .eq("id", data.documentId)
      .eq("estado", "publicado")
      .maybeSingle();
    if (error) throw new Error("No se pudo consultar el documento.");
    if (!doc || !doc.file_path) throw new Error("Documento no disponible.");

    const descargar = data.modo === "descargar";
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(LIBRARY_FILES_BUCKET)
      .createSignedUrl(
        doc.file_path,
        SIGNED_URL_SECONDS,
        descargar ? { download: downloadFileName(doc.titulo) } : undefined,
      );
    if (signError || !signed?.signedUrl) throw new Error("No se pudo preparar el archivo.");

    if (descargar) {
      const { error: rpcError } = await supabaseAdmin.rpc("library_increment_downloads", {
        _id: doc.id,
      });
      if (rpcError) console.error("library_increment_downloads falló:", rpcError.message);
    }

    await logAudit({
      actorId: context.userId,
      categoria: "actividad",
      accion: descargar ? "descargar_libro" : "ver_libro",
      entidad: "library_documents",
      entidadId: doc.id,
      entidadEtiqueta: doc.titulo,
      sujetoId: context.userId,
      dedupeMinutes: descargar ? 10 : 60,
    });

    return { url: signed.signedUrl, expiresIn: SIGNED_URL_SECONDS };
  });
