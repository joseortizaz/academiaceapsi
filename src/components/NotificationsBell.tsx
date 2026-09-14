import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Notif = {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  mensaje: string | null;
  enlace: string | null;
  leida: boolean;
  created_at: string;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Los enlaces de notificación pueden traer query string
  // (ej: /estudiante/evaluaciones?assessmentId=...), que <Link to> no acepta.
  const goTo = (enlace: string) => {
    const href = enlace.startsWith("/") ? enlace : `/${enlace}`;
    try {
      router.navigate({ href } as never);
    } catch {
      window.location.href = href;
    }
  };

  const { data: notifs = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
          if (payload.eventType === "INSERT") {
            const n = payload.new as Notif;
            toast(n.titulo, { description: n.mensaje ?? undefined });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  const unread = notifs.filter((n) => !n.leida).length;

  const markAll = async () => {
    if (!user?.id) return;
    const { error } = await (supabase as any)
      .from("notifications").update({ leida: true })
      .eq("user_id", user.id).eq("leida", false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  const markOne = async (id: string) => {
    await (supabase as any).from("notifications").update({ leida: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", user!.id] });
  };

  const remove = async (id: string) => {
    await (supabase as any).from("notifications").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", user!.id] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-[20px] justify-center px-1 text-[10px]">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <p className="text-sm font-semibold">Notificaciones</p>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={markAll}>
              <CheckCheck className="mr-1 h-4 w-4" /> Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifs.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">Sin notificaciones.</p>
          )}
          {notifs.map((n) => {
            const body = (
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm", !n.leida && "font-semibold")}>{n.titulo}</p>
                {n.mensaje && <p className="line-clamp-2 text-xs text-muted-foreground">{n.mensaje}</p>}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            );
            return (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-2 border-b p-3 transition-colors hover:bg-muted/50",
                  !n.leida && "bg-primary/5"
                )}
              >
                {n.enlace ? (
                  <Link to={n.enlace as never} className="flex-1" onClick={() => { markOne(n.id); setOpen(false); }}>
                    {body}
                  </Link>
                ) : (
                  <button className="flex-1 text-left" onClick={() => markOne(n.id)}>{body}</button>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(n.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
