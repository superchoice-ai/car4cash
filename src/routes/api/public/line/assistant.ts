import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Internal LINE Assistant endpoint (เรียกจาก n8n เท่านั้น)
 *
 * n8n → POST /api/public/line/assistant
 *   headers: x-car4cash-secret: <LINE_N8N_CAR4CASH_SECRET>   (หรือ Authorization: Bearer <secret>)
 *   body: { lineUserId: "Uxxxx", text: "คำถาม", messages?: [...ประวัติ], branchId?: uuid|null }
 *
 * ขั้นตอน: ตรวจ shared secret → map LINE userId → auth user (profiles.line_user_id)
 *   → ตรวจ active → ออก access token ชั่วคราวของผู้ใช้คนนั้น → รันผู้ช่วย AI ผ่าน RLS/สิทธิ์/สาขาของผู้ใช้
 *   → คืน answer + toolsUsed  (อ่านอย่างเดียว ไม่แก้ไขข้อมูลใด ๆ)
 */

export const LINE_N8N_SECRET_KEY = "LINE_N8N_CAR4CASH_SECRET";

const BodySchema = z.object({
  lineUserId: z.string().trim().min(5).max(64).optional(),
  line_user_id: z.string().trim().min(5).max(64).optional(),
  text: z.string().trim().min(1).max(4000).optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(12)
    .optional(),
  branchId: z.string().uuid().nullable().optional(),
  /** ส่งกลับให้ n8n ตามเดิม เพื่อใช้กับ LINE Reply API */
  replyToken: z.string().max(200).optional(),
});

type ErrorCode =
  | "bad_request"
  | "secret_not_configured"
  | "unauthorized"
  | "user_not_found"
  | "user_inactive"
  | "no_permission"
  | "assistant_failed"
  | "internal_error";

function fail(status: number, code: ErrorCode, message: string, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: false, code, message, ...extra }, { status });
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const Route = createFileRoute("/api/public/line/assistant")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ok: true,
          service: "car4cash-line-assistant",
          method: "POST",
          auth: "x-car4cash-secret header (shared secret from n8n)",
        }),
      POST: async ({ request }) => {
        const startedAt = Date.now();
        try {
          // ---- 1) ตรวจ shared secret จาก n8n ----
          const { getIntegrationSecret } = await import("@/lib/line.server");
          const expected = await getIntegrationSecret(LINE_N8N_SECRET_KEY);
          if (!expected) return fail(503, "secret_not_configured", "ยังไม่ได้ตั้งค่า LINE_N8N_CAR4CASH_SECRET ในระบบ");

          const provided =
            request.headers.get("x-car4cash-secret") ??
            request.headers.get("x-n8n-secret") ??
            (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
          if (!provided || !safeEqual(provided, expected)) return fail(401, "unauthorized", "shared secret ไม่ถูกต้อง");

          // ---- 2) ตรวจ body ----
          const parsed = BodySchema.safeParse(await request.json().catch(() => null));
          if (!parsed.success) return fail(400, "bad_request", "รูปแบบข้อมูลไม่ถูกต้อง", { issues: parsed.error.issues });
          const body = parsed.data;
          const lineUserId = body.lineUserId ?? body.line_user_id;
          if (!lineUserId) return fail(400, "bad_request", "ต้องระบุ lineUserId");
          const history = body.messages ?? [];
          const messages = body.text ? [...history, { role: "user" as const, content: body.text }] : history;
          if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
            return fail(400, "bad_request", "ต้องระบุ text หรือ messages ที่ลงท้ายด้วยข้อความของผู้ใช้");
          }

          // ---- 3) Map LINE userId → auth user ----
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("id, email, full_name, active")
            .eq("line_user_id", lineUserId)
            .maybeSingle();
          if (profileError) throw profileError;
          if (!profile) {
            return fail(404, "user_not_found", "ไม่พบผู้ใช้ที่ผูกกับบัญชี LINE นี้ กรุณาเข้าสู่ระบบด้วย LINE ในเว็บก่อน 1 ครั้ง", {
              lineUserId,
            });
          }
          if (!profile.active) return fail(403, "user_inactive", "บัญชีผู้ใช้นี้ถูกปิดใช้งาน", { userId: profile.id });

          const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
          if (authErr || !authUser.user?.email) return fail(404, "user_not_found", "ไม่พบบัญชีผู้ใช้ในระบบยืนยันตัวตน");

          // ---- 4) ออก access token ชั่วคราวของผู้ใช้ (magic link → verify) เพื่อให้ RLS ทำงานในฐานะผู้ใช้จริง ----
          const { createUserScopedClient, decodeJwtClaims, runAssistant, sanitizeMessages } = await import(
            "@/lib/assistant.server"
          );
          const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email: authUser.user.email });
          const tokenHash = link.data?.properties?.hashed_token;
          if (link.error || !tokenHash) return fail(500, "internal_error", "ไม่สามารถออกสิทธิ์ชั่วคราวให้ผู้ใช้ได้");

          const anonClient = createUserScopedClient("");
          const verified = await anonClient.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
          const token = verified.data.session?.access_token;
          if (verified.error || !token) return fail(500, "internal_error", "ยืนยันสิทธิ์ชั่วคราวของผู้ใช้ไม่สำเร็จ");

          try {
            // ---- 5) รันผู้ช่วย AI ในฐานะผู้ใช้ (ตรวจ role/สาขา + MCP tools ผ่าน RLS) ----
            const supabase = createUserScopedClient(token);
            const claims = decodeJwtClaims(token);
            const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", profile.id);
            if (!roleRows || roleRows.length === 0) return fail(403, "no_permission", "ผู้ใช้ยังไม่ได้รับสิทธิ์ใช้งานระบบ");

            const result = await runAssistant({
              supabase,
              userId: profile.id,
              claims,
              token,
              messages: sanitizeMessages(messages),
              branchId: body.branchId ?? null,
            });

            return Response.json({
              ok: true,
              lineUserId,
              replyToken: body.replyToken ?? null,
              user: { id: profile.id, name: profile.full_name, roles: result.roles, scope: result.scopeName },
              answer: result.answer,
              toolsUsed: result.toolsUsed,
              durationMs: Date.now() - startedAt,
            });
          } finally {
            // ปิด session ชั่วคราวทันที ไม่ให้ค้างในระบบ
            await supabaseAdmin.auth.admin.signOut(token, "local").catch(() => undefined);
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("[line-assistant] error", message);
          const isAssistant = /AI|ผู้ช่วย|เครดิต/.test(message);
          return fail(isAssistant ? 502 : 500, isAssistant ? "assistant_failed" : "internal_error", message);
        }
      },
    },
  },
});
