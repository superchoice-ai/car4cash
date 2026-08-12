import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Server/event policy: read the current DB value once at event start.
 * Do not reuse browser cache or a 30-minute UI cache for transactions/events.
 */
export async function getSystemSettingFresh<T>(key: string, fallback: T): Promise<T> {
  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return (data?.value ?? fallback) as T;
}
