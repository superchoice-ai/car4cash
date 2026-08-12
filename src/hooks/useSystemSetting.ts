import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CONFIG_REFRESH_MS = 30 * 60 * 1000;

export function useSystemSetting<T>(key: string, fallback: T) {
  const query = useQuery({
    queryKey: ["system-setting", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value,updated_at")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return {
        value: (data?.value ?? fallback) as T,
        updated_at: data?.updated_at ?? null,
      };
    },
    staleTime: CONFIG_REFRESH_MS,
    refetchInterval: CONFIG_REFRESH_MS,
    refetchOnMount: "always" as const,
    refetchOnWindowFocus: "always" as const,
  });

  return {
    ...query,
    value: query.data?.value ?? fallback,
    updatedAt: query.data?.updated_at ?? null,
    refresh: query.refetch,
  };
}
