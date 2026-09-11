import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  AI_MODES_SETTING_KEY,
  DEFAULT_AI_MODES,
  normalizeAiModes,
  type AiModeKey,
  type AiModes,
} from "@/lib/ai-modes";

/**
 * Read fresh for every server request so an Admin toggle takes effect without
 * relying on the browser's 30-minute configuration cache.
 */
export async function getAiModesFresh(): Promise<AiModes> {
  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", AI_MODES_SETTING_KEY)
    .maybeSingle();
  if (error) throw error;
  return normalizeAiModes(data?.value ?? DEFAULT_AI_MODES);
}

export async function isAiModeEnabled(mode: AiModeKey): Promise<boolean> {
  const settings = await getAiModesFresh();
  return settings[mode];
}
