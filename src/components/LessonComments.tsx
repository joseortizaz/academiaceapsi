import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageCircle, Reply, Trash2, GraduationCap, Send } from "lucide-react";

type Comment = {
  id: string;
  modulo_id: string;
  programa_id: string;
  user_id: string;
  parent_id: string | null;
  contenido: string;
  es_respuesta_docente: boolean;
  created_at: string;
};

type Profile = { id: string; nombre: string | null; apellido: string | null; avatar_url: string | null };

interface Props {
  moduloId: string;
  programaId: string;
  docenteId?: string | null;
}

export function LessonComments({ moduloId, programaId, docenteId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const queryKey = ["lesson-comments", moduloId];

  const { data: comments = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_comments")
        .select("*")
        .eq("modulo_id", moduloId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
  });

  const userIds = useMemo(
    () => Array.from(new Set(comments.map((c) => c.user_id))),
    [comments],
  );

  const { data: profilesMap = new Map<string, Profile>() } = useQuery({
    queryKey: ["lesson-comments-profiles", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("profiles_public")
        .select("id,nombre,apellido,avatar_url")
        .in("id", userIds);
      return new Map((data ?? []).map((p: any) => [p.id, p as Profile]));
    },
  });

  // Realtime: refresh on insert/delete/update
  useEffect(() => {
    const channel = supabase
      .channel(`lesson-comments-${moduloId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lesson_comments", filter: `modulo_id=eq.${moduloId}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [moduloId, qc]);

  const isDocente = !!user?.id && docenteId === user.id;

  const submit = async (contenido: string, parentId: string | null) => {
    if (!user?.id || !contenido.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("lesson_comments").insert({
        modulo_id: moduloId,
        programa_id: programaId,
        user_id: user.id,
        parent_id: parentId,
        contenido: contenido.trim(),
        es_respuesta_docente: isDocente && !!parentId,
      });
      if (error) throw error;
      toast.success(parentId ? "Respuesta enviada" : "Comentario publicado");
      if (parentId) { setReplyText(""); setReplyTo(null); } else setNewComment("");
      qc.invalidateQueries({ queryKey });
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo enviar");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("lesson_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    qc.invalidateQueries({ queryKey });
  };

  const top = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  const renderAuthor = (uid: string) => {
    const p = profilesMap.get(uid);
    const name = `${p?.nombre ?? ""} ${p?.apellido ?? ""}`.trim() || "Usuario";
    const initials = name.split(" ").map((x) => x[0]).slice(0, 2).join("");
    return { name, initials, avatar: p?.avatar_url ?? undefined };
  };

  return (
    <section className="mt-8 border-t pt-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <MessageCircle className="h-5 w-5" />
        Preguntas y comentarios <span className="text-sm text-muted-foreground">({comments.length})</span>
      </h2>

      {user && (
        <div className="mb-6 rounded-lg border bg-card p-3">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escribe una pregunta o comentario sobre esta lección…"
            rows={3}
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={() => submit(newComment, null)} disabled={submitting || !newComment.trim()}>
              <Send className="mr-1 h-4 w-4" /> Publicar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {top.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no hay comentarios. ¡Sé el primero en preguntar!</p>
        )}
        {top.map((c) => {
          const a = renderAuthor(c.user_id);
          const isAuthor = c.user_id === user?.id;
          const isTeacher = c.user_id === docenteId;
          return (
            <article key={c.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9">
                  {a.avatar && <AvatarImage src={a.avatar} />}
                  <AvatarFallback className="text-xs">{a.initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{a.name}</span>
                    {isTeacher && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <GraduationCap className="h-3 w-3" /> Docente
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("es-DO")}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.contenido}</p>
                  <div className="mt-2 flex items-center gap-3">
                    {user && (
                      <button
                        onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(""); }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Reply className="h-3 w-3" /> Responder
                      </button>
                    )}
                    {isAuthor && (
                      <button onClick={() => remove(c.id)} className="flex items-center gap-1 text-xs text-destructive hover:underline">
                        <Trash2 className="h-3 w-3" /> Eliminar
                      </button>
                    )}
                  </div>

                  {replyTo === c.id && (
                    <div className="mt-3">
                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Escribe tu respuesta…"
                        rows={2}
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>Cancelar</Button>
                        <Button size="sm" onClick={() => submit(replyText, c.id)} disabled={submitting || !replyText.trim()}>
                          <Send className="mr-1 h-3 w-3" /> Responder
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Replies */}
                  <div className="mt-4 space-y-3 border-l-2 pl-4">
                    {repliesOf(c.id).map((r) => {
                      const ra = renderAuthor(r.user_id);
                      const rIsAuthor = r.user_id === user?.id;
                      const rIsTeacher = r.user_id === docenteId || r.es_respuesta_docente;
                      return (
                        <div key={r.id} className="flex items-start gap-2">
                          <Avatar className="h-7 w-7">
                            {ra.avatar && <AvatarImage src={ra.avatar} />}
                            <AvatarFallback className="text-[10px]">{ra.initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium">{ra.name}</span>
                              {rIsTeacher && (
                                <Badge variant="secondary" className="gap-1 text-[10px]">
                                  <GraduationCap className="h-3 w-3" /> Docente
                                </Badge>
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(r.created_at).toLocaleString("es-DO")}
                              </span>
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap text-sm">{r.contenido}</p>
                            {rIsAuthor && (
                              <button onClick={() => remove(r.id)} className="mt-1 flex items-center gap-1 text-[10px] text-destructive hover:underline">
                                <Trash2 className="h-3 w-3" /> Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
