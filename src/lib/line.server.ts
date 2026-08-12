import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const LINE_SECRET_KEYS = {
  channelAccessToken: "LINE_CHANNEL_ACCESS_TOKEN",
  channelSecret: "LINE_CHANNEL_SECRET",
  loginChannelId: "LINE_LOGIN_CHANNEL_ID",
  loginChannelSecret: "LINE_LOGIN_CHANNEL_SECRET",
  loginRedirectUri: "LINE_LOGIN_REDIRECT_URI",
  notifyRecipients: "LINE_NOTIFY_RECIPIENTS",
} as const;

/**
 * Server events always read the current value from DB first.
 * Environment is fallback only when the DB key has no value.
 */
export async function getIntegrationSecret(key: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("integration_secrets")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;

  const v = (data?.value ?? "").trim();
  if (v) return v;

  const env = process.env[key];
  return env && env.trim() ? env.trim() : null;
}

export async function getLineRedirectUri(origin: string): Promise<string> {
  const fixed = await getIntegrationSecret(LINE_SECRET_KEYS.loginRedirectUri);
  return (fixed || `${origin}/api/public/auth/line/callback`).trim();
}

export interface LinePushResult {
  ok: boolean;
  sent: number;
  failed: number;
  errors: string[];
}

export type LineNotifyConfig = {
  enabled: boolean;
  to: string[];
};

export function normalizeLineTargets(input?: string | string[] | null): string[] {
  const values = Array.isArray(input) ? input : [input ?? ""];
  return Array.from(
    new Set(
      values
        .flatMap((value) => String(value).split(/[,\s]+/))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

/**
 * อ่านผู้รับ LINE ล่าสุดจาก integration_secrets ก่อนเสมอ
 * system_settings.line_notify.to เป็น fallback สำหรับข้อมูล legacy เท่านั้น
 */
export async function getLineRecipients(): Promise<LineNotifyConfig> {
  const [secretRecipients, settingResult] = await Promise.all([
    getIntegrationSecret(LINE_SECRET_KEYS.notifyRecipients),
    supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", "line_notify")
      .maybeSingle(),
  ]);

  if (settingResult.error) throw settingResult.error;
  const cfg = (settingResult.data?.value ?? {}) as {
    to?: string[] | string;
    enabled?: boolean;
  };
  const confidentialTargets = normalizeLineTargets(secretRecipients);

  return {
    enabled: cfg.enabled !== false,
    to: confidentialTargets.length ? confidentialTargets : normalizeLineTargets(cfg.to),
  };
}

/** ส่งข้อความผ่าน LINE Messaging API โดยอ่าน access token ล่าสุดจาก DB ทุกครั้ง */
export async function pushLineMessage(to: string[] | string, text: string): Promise<LinePushResult> {
  const targets = normalizeLineTargets(to);
  const token = await getIntegrationSecret(LINE_SECRET_KEYS.channelAccessToken);

  if (!token) {
    return { ok: false, sent: 0, failed: targets.length, errors: ["ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN"] };
  }
  if (!targets.length) {
    return { ok: false, sent: 0, failed: 0, errors: ["ยังไม่ได้ระบุผู้รับ (LINE user ID / group ID)"] };
  }

  const message = text.trim().slice(0, 4900);
  if (!message) {
    return { ok: false, sent: 0, failed: targets.length, errors: ["ข้อความ LINE ว่าง"] };
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const target of targets) {
    try {
      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to: target, messages: [{ type: "text", text: message }] }),
      });

      if (res.ok) sent++;
      else {
        failed++;
        errors.push(`${target}: ${res.status} ${(await res.text()).slice(0, 300)}`);
      }
    } catch (e) {
      failed++;
      errors.push(`${target}: ${(e as Error).message}`);
    }
  }

  return { ok: failed === 0, sent, failed, errors };
}
