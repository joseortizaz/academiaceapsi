import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUserProfile } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const fetchProfile = useServerFn(getCurrentUserProfile);
  const qc = useQueryClient();
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setHasSession(!!data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
      qc.invalidateQueries({ queryKey: ["auth", "profile"] });
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [qc]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["auth", "profile"],
    queryFn: async () => {
      // Re-check session right before the call — avoids calling the
      // protected serverFn with no/expired bearer token, which would
      // surface as a runtime error overlay in dev.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) return null;
      try {
        return await fetchProfile();
      } catch {
        return null;
      }
    },
    enabled: hasSession === true,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: data?.profile ?? null,
    roles: data?.roles ?? [],
    primaryRole: data?.primaryRole ?? null,
    isLoading: hasSession === null || (hasSession && isLoading),
    isAuthenticated: !!data?.profile && !error,
    hasRole: (role: string) => data?.roles.includes(role as never) ?? false,
  };
}
