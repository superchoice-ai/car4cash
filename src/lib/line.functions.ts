import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireManager(context: any) {
  const { data, error } = await context.supabase.rpc("is_manager");
  if (error) throw error;
  if (!data) throw new Error("เฉพาะผู้ดูแลระบบหรือผู้จัดการเท่านั้น");
}

/**
 * ทดสอบส่ง LINE จริงจากหน้าตั้งค่า
 * - ใช้ token ล่าสุดจาก integration_secrets
 * - ถ้าไม่กรอกผู้รับ จะใช้ system_settings.line_notify.to ล่าสุด
 * - ถ้ากรอกหลาย ID รองรับ comma / space / newline เหมือน config หลัก
 */
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
      source: explicitTargets.length ? ("manual" as const) : ("system_settings" as const),
      enabled: config?.enabled ?? true,
      targetCount: targets.length,
    };
  });

/**
 * บันทึกผู้รับ LINE แบบ server-side หลังตรวจสิทธิ์
 * อ่านค่า line_notify ล่าสุดก่อน merge เพื่อไม่ overwrite field อื่นจาก concurrent update
 */
export const saveLineRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to: string; enabled?: boolean }) => input)
  .handler(async ({ data, context }) => {
    await requireManager(context);

    const { normalizeLineTargets } = await import("./line.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const targets = normalizeLineTargets(data.to);

    const { data: current, error: readError } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", "line_notify")
      .maybeSingle();
    if (readError) throw readError;

    const currentValue = (current?.value ?? {}) as Record<string, unknown>;
    const value = {
      ...currentValue,
      enabled: data.enabled ?? true,
      to: targets,
    };

    const { error: writeError } = await supabaseAdmin
      .from("system_settings")
      .upsert({ key: "line_notify", value: value as any }, { onConflict: "key" });
    if (writeError) throw writeError;

    return { ok: true, enabled: value.enabled, to: targets };
  });
