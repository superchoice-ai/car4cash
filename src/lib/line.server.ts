import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const LINE_SECRET_KEYS = {
  channelAccessToken: "LINE_CHANNEL_ACCESS_TOKEN",
  channelSecret: "LINE_CHANNEL_SECRET",
  loginChannelId: "LINE_LOGIN_CHANNEL_ID",
  loginChannelSecret: "LINE_LOGIN_CHANNEL_SECRET",
  loginRedirectUri: "LINE_LOGIN_REDIRECT_URI",
} as const;

/** อ่านคีย์จากตาราง integration_secrets ก่อน ถ้าไม่มีค่อย fallback ไปที่ environment */
export async function getIntegrationSecret(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("integration_secrets").select("value").eq("key", key).maybeSingle();
  const v = (data?.value ?? "").trim();
  if (v) return v;
  const env = process.env[key];
  return env && env.trim() ? env.trim() : null;
}

/**
 * Callback URL ที่ต้องตรงกับที่ลงทะเบียนใน LINE Developers Console แบบเป๊ะ ๆ
 * ถ้าตั้งค่า LINE_LOGIN_REDIRECT_URI ไว้ จะใช้ค่านั้นเสมอ (ไม่ต้องลงทะเบียนทุกโดเมน)
 */
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

/** ส่งข้อความผ่าน LINE Messaging API (push) ไปยัง userId/groupId ที่กำหนด */
export async function pushLineMessage(to: string[], text: string): Promise<LinePushResult> {
  const token = await getIntegrationSecret(LINE_SECRET_KEYS.channelAccessToken);
  if (!token) return { ok: false, sent: 0, failed: to.length, errors: ["ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN"] };
  if (!to.length) return { ok: false, sent: 0, failed: 0, errors: ["ยังไม่ได้ระบุผู้รับ (LINE user ID / group ID)"] };

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const target of to) {
    try {
      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: target, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
      });
      if (res.ok) {
        sent++;
      } else {
        failed++;
        errors.push(`${target}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      }
    } catch (e) {
      failed++;
      errors.push(`${target}: ${(e as Error).message}`);
    }
  }

  return { ok: failed === 0, sent, failed, errors };
}

/** อ่านรายชื่อผู้รับ LINE จาก system_settings (key = line_notify) */
export async function getLineRecipients(): Promise<{ enabled: boolean; to: string[] }> {
  const { data } = await supabaseAdmin.from("system_settings").select("value").eq("key", "line_notify").maybeSingle();
  const cfg = (data?.value ?? {}) as { to?: string[]; enabled?: boolean };
  return { enabled: cfg.enabled !== false, to: cfg.to ?? [] };
}
