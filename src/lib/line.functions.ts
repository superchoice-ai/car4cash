import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** ทดสอบส่งข้อความ LINE จริง (เฉพาะผู้ดูแลระบบ) */
export const sendLineTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to?: string; text?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("เฉพาะผู้ดูแลระบบเท่านั้น");

    const { pushLineMessage, getLineRecipients } = await import("./line.server");
    const targets = data.to?.trim() ? [data.to.trim()] : (await getLineRecipients()).to;
    const text = data.text?.trim() || "ทดสอบการแจ้งเตือนจากระบบธารทรัพย์ ✅";
    return pushLineMessage(targets, text);
  });
