import { supabase } from "@/integrations/supabase/client";

export type AccionActividad =
  | "ver_leccion"
  | "descargar_material"
  | "descargar_certificado"
  | "ver_grabacion"
  | "abrir_evaluacion";

/** Evita repetir la misma llamada durante la sesión de página. */
const yaRegistrado = new Set<string>();

/**
 * Registra una actividad declarada por el navegador.
 * "Fire and forget": nunca bloquea la interfaz ni muestra errores.
 */
export function registrarActividad(input: {
  accion: AccionActividad;
  entidad?: string | null;
  entidadId?: string | null;
  etiqueta?: string | null;
  programaId?: string | null;
  detalle?: Record<string, unknown> | null;
}): void {
  const clave = `${input.accion}:${input.entidadId ?? ""}`;
  if (yaRegistrado.has(clave)) return;
  yaRegistrado.add(clave);

  void (supabase.rpc as any)("log_activity", {
    _accion: input.accion,
    _entidad: input.entidad ?? null,
    _entidad_id: input.entidadId ?? null,
    _etiqueta: input.etiqueta ?? null,
    _programa_id: input.programaId ?? null,
    _detalle: input.detalle ?? null,
  }).then(
    () => {},
    () => {},
  );
}
