import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Cuenta diplomados y cursos publicados (estado = 'publicado'). */
export function useProgramCounts() {
  return useQuery({
    queryKey: ["program-counts-publicados"],
    queryFn: async () => {
      const count = async (tipo: string) => {
        const { count, error } = await supabase
          .from("programs")
          .select("id", { count: "exact", head: true })
          .eq("estado", "publicado")
          .eq("tipo", tipo);
        if (error) throw error;
        return count ?? 0;
      };
      const [diplomados, cursos] = await Promise.all([count("diplomado"), count("curso")]);
      return { diplomados, cursos };
    },
  });
}
