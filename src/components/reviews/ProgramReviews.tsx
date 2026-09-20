import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StarRating, StarRatingInput } from "@/components/reviews/StarRating";

export type RatingStats = {
  programa_id: string;
  promedio: number | null;
  total: number | null;
  c1: number | null;
  c2: number | null;
  c3: number | null;
  c4: number | null;
  c5: number | null;
};

type PublicReview = {
  id: string;
  autor: string;
  rating: number;
  comentario: string | null;
  created_at: string;
};

const PAGE = 10;

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric" });

export function useProgramRatingStats(programaId?: string) {
  return useQuery({
    queryKey: ["reviews", "stats", programaId],
    enabled: !!programaId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("program_rating_stats")
        .select("*")
        .eq("programa_id", programaId!)
        .maybeSingle();
      if (error) throw error;
      return (data as RatingStats | null) ?? null;
    },
  });
}

/** Formulario reutilizable para que el alumno valore el programa. */
export function ReviewForm({
  programaId,
  slug,
  compact,
}: {
  programaId: string;
  slug?: string;
  compact?: boolean;
}) {
  const { user, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState("");
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState(false);

  const { data: elegible } = useQuery({
    queryKey: ["reviews", "can", programaId, user?.id],
    enabled: !!user?.id && !!programaId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("can_review_program", {
        _user_id: user!.id,
        _programa_id: programaId,
      });
      if (error) throw error;
      return !!data;
    },
  });

  const { data: inscrito } = useQuery({
    queryKey: ["reviews", "enrolled", programaId, user?.id],
    enabled: !!user?.id && !!programaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id")
        .eq("programa_id", programaId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: mia } = useQuery({
    queryKey: ["reviews", "mine", programaId, user?.id],
    enabled: !!user?.id && !!programaId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("program_reviews")
        .select("*")
        .eq("programa_id", programaId)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string; rating: number; comentario: string | null;
        estado: string; motivo_rechazo: string | null;
      } | null;
    },
  });

  useEffect(() => {
    if (mia) {
      setRating(mia.rating);
      setComentario(mia.comentario ?? "");
    }
  }, [mia]);

  if (authLoading) return null;

  if (!user) {
    return (
      <p className="text-sm text-muted-foreground">
        Inicia sesión si eres alumno de este programa para dejar tu valoración.{" "}
        <Link
          to="/acceder"
          search={{ redirect: slug ? `/programas/${slug}` : undefined }}
          className="font-medium text-primary underline"
        >
          Iniciar sesión
        </Link>
      </p>
    );
  }

  if (!inscrito) return null;

  if (!elegible && !mia) {
    return (
      <p className="text-sm text-muted-foreground">
        Podrás valorar este programa cuando alcances el 35 % de avance o lo completes.
      </p>
    );
  }

  const enviar = async () => {
    if (rating < 1) {
      toast.error("Selecciona de 1 a 5 estrellas.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase.from as any)("program_reviews").upsert(
        {
          programa_id: programaId,
          user_id: user.id,
          rating,
          comentario: comentario.trim() ? comentario.trim().slice(0, 1000) : null,
          estado: "pendiente",
        },
        { onConflict: "programa_id,user_id" },
      );
      if (error) throw error;
      toast.success("¡Gracias! Tu valoración será visible cuando sea aprobada.");
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["reviews"] });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo enviar tu valoración");
    } finally {
      setSaving(false);
    }
  };

  const insignia =
    mia?.estado === "aprobado" ? (
      <Badge className="bg-emerald-100 text-emerald-800">Publicada</Badge>
    ) : mia?.estado === "rechazado" ? (
      <Badge variant="destructive">Rechazada</Badge>
    ) : mia ? (
      <Badge variant="outline">En revisión</Badge>
    ) : null;

  if (mia && !editando) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <StarRating value={mia.rating} />
          {insignia}
        </div>
        {mia.comentario && <p className="whitespace-pre-line text-sm">{mia.comentario}</p>}
        {mia.estado === "rechazado" && mia.motivo_rechazo && (
          <p className="text-sm text-destructive">Motivo: {mia.motivo_rechazo}</p>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
          Editar mi valoración
        </Button>
        <p className="text-xs text-muted-foreground">Si la editas, volverá a revisión.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!compact && <h3 className="font-semibold">Deja tu valoración</h3>}
      <StarRatingInput value={rating} onChange={setRating} size={compact ? 26 : 30} disabled={saving} />
      <Textarea
        rows={compact ? 3 : 4}
        maxLength={1000}
        placeholder="Comparte tu experiencia (opcional)"
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{comentario.length}/1000</span>
        <div className="flex gap-2">
          {editando && (
            <Button variant="ghost" size="sm" onClick={() => setEditando(false)} disabled={saving}>
              Cancelar
            </Button>
          )}
          <Button onClick={enviar} disabled={saving}>
            {saving ? "Enviando…" : "Enviar valoración"}
          </Button>
        </div>
      </div>
      {mia && (
        <p className="text-xs text-muted-foreground">Si la editas, volverá a revisión.</p>
      )}
    </div>
  );
}

export function ProgramReviews({
  programaId,
  programaTitulo,
  slug,
}: {
  programaId: string;
  programaTitulo?: string;
  slug?: string;
}) {
  const [limit, setLimit] = useState(PAGE);
  const { data: stats } = useProgramRatingStats(programaId);

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", "list", programaId, limit],
    enabled: !!programaId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_program_reviews", {
        _programa_id: programaId,
        _limit: limit,
        _offset: 0,
      });
      if (error) throw error;
      return (data as PublicReview[]) ?? [];
    },
  });

  const total = stats?.total ?? 0;
  const promedio = Number(stats?.promedio ?? 0);
  const dist = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: Number((stats as any)?.[`c${n}`] ?? 0),
  }));

  return (
    <div id="valoraciones">
      <h2 className="text-2xl font-bold">Valoraciones</h2>
      {programaTitulo && <span className="sr-only">{programaTitulo}</span>}

      {total === 0 ? (
        <p className="mt-3 text-muted-foreground">Este programa aún no tiene valoraciones.</p>
      ) : (
        <div className="mt-4 grid gap-6 rounded-lg border bg-card p-5 sm:grid-cols-[auto_1fr]">
          <div className="text-center">
            <div className="text-4xl font-bold">{promedio.toFixed(1)}</div>
            <StarRating value={promedio} className="mt-1" />
            <p className="mt-1 text-sm text-muted-foreground">
              {total} {total === 1 ? "valoración" : "valoraciones"}
            </p>
          </div>
          <div className="space-y-1.5 self-center">
            {dist.map(({ n, count }) => (
              <div key={n} className="flex items-center gap-2 text-sm">
                <span className="w-10 shrink-0 text-muted-foreground">{n} ★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${total ? (count / total) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-6 text-right text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <ul className="mt-6 space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold">{r.autor || "Alumno"}</span>
                <StarRating value={r.rating} size={16} />
                <span className="text-xs text-muted-foreground">{fecha(r.created_at)}</span>
              </div>
              {r.comentario && (
                <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">{r.comentario}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {total > reviews.length && (
        <Button variant="outline" className="mt-4" onClick={() => setLimit((l) => l + PAGE)}>
          Ver más
        </Button>
      )}

      <div className="mt-8 rounded-lg border bg-muted/30 p-5">
        <ReviewForm programaId={programaId} slug={slug} />
      </div>
    </div>
  );
}
