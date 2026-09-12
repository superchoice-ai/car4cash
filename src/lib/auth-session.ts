import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const SESSION_RETRY_DELAYS_MS = [0, 150, 350, 750, 1_250] as const;

const sleep = (delayMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, delayMs));

export async function waitForAuthenticatedSession(): Promise<{
  session: Session | null;
  error: Error | null;
}> {
  let lastError: Error | null = null;

  for (const delayMs of SESSION_RETRY_DELAYS_MS) {
    if (delayMs > 0) await sleep(delayMs);
    const { data, error } = await supabase.auth.getSession();
    if (error) lastError = error;
    if (data.session?.access_token) {
      return { session: data.session, error: null };
    }
  }

  return { session: null, error: lastError };
}
