import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

interface AskInput {
  messages: AssistantMessage[];
  /** สาขาที่ผู้ใช้กำลังดูอยู่ (null = ทุกสาขาที่มีสิทธิ์) */
  branchId?: string | null;
}

/**
 * ผู้ช่วย AI (หน้า /assistant): ตอบคำถามวิธีใช้งาน และเรียกใช้เครื่องมืออ่านข้อมูลชุดเดียวกับ MCP ตามสิทธิ์ผู้ใช้
 * แกนกลางอยู่ใน assistant.server.ts และใช้ร่วมกับ Internal LINE Assistant endpoint
 */
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AskInput) => input)
  .handler(async ({ data, context }) => {
    const { isAiModeEnabled } = await import("@/lib/ai-modes.server");
    if (!(await isAiModeEnabled("assistant"))) {
      throw new Error("ผู้ช่วย AI ถูกปิดใช้งานโดยผู้ดูแลระบบ");
    }

    const { supabase, userId, claims } = context;
    const { runAssistant, sanitizeMessages } = await import("@/lib/assistant.server");

    const messages = sanitizeMessages(data?.messages);
    const authHeader = getRequest().headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Unauthorized");

    return runAssistant({
      channel: "assistant",
      supabase,
      userId,
      claims: claims as Record<string, unknown>,
      token,
      messages,
      branchId: data?.branchId ?? null,
    });
  });
