import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireManager(context: any) {
  const { data, error } = await context.supabase.rpc("is_manager");
  if (error) throw error;
  if (!data) throw new Error("เฉพาะผู้ดูแลระบบหรือผู้จัดการเท่านั้น");
}

function maskRecipient(value: string) {
  const v = value.trim();
  if (v.length <= 4) return "•".repeat(v.length);
  return `${"•".repeat(Math.min(v.length - 4, 24))}${v.slice(-4)}`;
}

/** ทดสอบส่ง LINE จริง โดยแยก recipient override ออกจากข้อความอย่างชัดเจน */
export const sendLineTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to?: string; text?: string }) => input)
  .handler(async ({ data, context }) => {
    await requireManager(context);

    const { getLineRecipients, normalizeLineTargets, pushLineMessage } = await import("./line.server");
    const explicitTargets = normalizeLineTargets(data.to);
    const config = explicitTargets.length ? null : await getLineRecipients();
    const targets = explicitTargets.length ? explicitTargets : (config?.to ?? []);
    const text = data.text?.trim() || "ทดสอบการแจ้งเตือนจากระบบธารทรัพย์ ✅";

    const result = await pushLineMessage(targets, text);
    return {
      ...result,
      source: explicitTargets.length ? ("manual" as const) : ("integration_secrets" as const),
      enabled: config?.enabled ?? true,
      targetCount: targets.length,
    };
  });

/**
 * บันทึกผู้รับ LINE เป็น confidential integration secret
 * ไม่คืน raw recipient กลับไป browser และไม่เก็บ plain recipient ใน system_settings
 */
export const saveLineRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to: string; enabled?: boolean }) => input)
  .handler(async ({ data, context }) => {
    await requireManager(context);

    const { LINE_SECRET_KEYS, normalizeLineTargets } = await import("./line.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const targets = normalizeLineTargets(data.to);
    if (!targets.length) throw new Error("กรุณาระบุ LINE user ID / group ID อย่างน้อย 1 ราย");

    const raw = targets.join(",");
    const { error: secretError } = await supabaseAdmin
      .from("integration_secrets")
      .upsert({
        key: LINE_SECRET_KEYS.notifyRecipients,
        label: "LINE Notify – Recipients",
        category: "line_oa",
        value: raw,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
    if (secretError) throw secretError;

    const { data: current, error: readError } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", "line_notify")
      .maybeSingle();
    if (readError) throw readError;

    const currentValue = (current?.value ?? {}) as Record<string, unknown>;
    delete currentValue.to;
    const value = {
      ...currentValue,
      enabled: data.enabled ?? true,
      recipients_source: "integration_secrets",
    };

    const { error: writeError } = await supabaseAdmin
      .from("system_settings")
      .upsert({ key: "line_notify", value: value as any, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (writeError) throw writeError;

    return {
      ok: true,
      enabled: value.enabled,
      count: targets.length,
      masked: targets.map(maskRecipient),
    };
  });
