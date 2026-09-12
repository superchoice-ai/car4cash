import { supabase } from "@/integrations/supabase/client";
import { waitForAuthenticatedSession } from "@/lib/auth-session";

const ACTIVE_RETRY_DELAYS_MS = [0, 250, 750] as const;

const sleep = (delayMs: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));

function toError(value: unknown, fallback: string): Error {
  if (value instanceof Error) return value;
  if (value && typeof value === "object" && "message" in value) {
    const message = String((value as { message?: unknown }).message ?? fallback);
    return new Error(message);
  }
  return new Error(fallback);
}

export type ActiveUserCheck =
  | { status: "active"; error: null }
  | { status: "inactive"; error: null }
  | { status: "unavailable"; error: Error };

export async function checkCurrentUserActive(): Promise<ActiveUserCheck> {
  const sessionResult = await waitForAuthenticatedSession();
  if (!sessionResult.session) {
    return {
      status: "unavailable",
      error:
        sessionResult.error ??
        new Error("Login session is not ready. Please try again."),
    };
  }

  let lastError: unknown = null;

  for (const delayMs of ACTIVE_RETRY_DELAYS_MS) {
    if (delayMs > 0) await sleep(delayMs);

    const { data, error } = await supabase.rpc("is_current_user_active");
    if (!error) {
      return data === true
        ? { status: "active", error: null }
        : { status: "inactive", error: null };
    }
    lastError = error;
  }

  return {
    status: "unavailable",
    error: toError(lastError, "Unable to verify whether this account is active"),
  };
}

