import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUserProfile } from "@/lib/auth.functions";

export function useAuth() {
  const fetchProfile = useServerFn(getCurrentUserProfile);

  const { data, isLoading, error } = useQuery({
    queryKey: ["auth", "profile"],
    queryFn: fetchProfile,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: data?.profile ?? null,
    roles: data?.roles ?? [],
    primaryRole: data?.primaryRole ?? null,
    isLoading,
    isAuthenticated: !!data?.profile && !error,
    hasRole: (role: string) => data?.roles.includes(role as never) ?? false,
  };
}
