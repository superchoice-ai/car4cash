import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AskInput {
  messages: AssistantMessage[];
  /** สาขาที่ผู้ใช้กำลังดูอยู่ (null = ทุกสาขาที่มีสิทธิ์) */
  branchId?: string | null;
}

const MAX_TURNS = 12;
const MAX_TOOL_ROUNDS = 6;
const MODEL = "google/gemini-3.7-flash";

const HELP_DOC = `
คู่มือการใช้งานระบบสินเชื่อ "SuperChoice AI" (สรุปสำหรับตอบคำถามผู้ใช้)

เมนูและหน้าจอหลัก
- แดชบอร์ด (/dashboard): ภาพรวมยอดปล่อยสินเชื่อ ลูกหนี้คงค้าง สัญญาค้างชำระ และรายรับรายจ่ายของขอบเขตสาขาที่เลือก
- ลูกค้า (/customers): ค้นหา/เพิ่ม/แก้ไขข้อมูลลูกค้า ดูประวัติสัญญาและการชำระรายบุคคล การแก้ไขหรือปรับสถานะเป็น "ไม่ใช้งาน" ต้องยื่นคำขออนุมัติ
- คำขอสินเชื่อ (/applications): สร้างคำขอ ระบุวงเงิน ดอกเบี้ย จำนวนงวด ผู้ค้ำประกัน แล้วส่งขออนุมัติ เมื่ออนุมัติจึงทำสัญญาและสร้างตารางงวดผ่อน
- สัญญา (/contracts): ดูรายละเอียดสัญญา ตารางงวด ยอดคงเหลือ พิมพ์สัญญา/หนังสือสัญญา การยกเลิกสัญญาทำได้เฉพาะสัญญาที่ยังไม่เคยรับชำระ และต้องผ่านการอนุมัติ
- รับชำระ (/payments): ออกใบเสร็จ ระบบตัดชำระงวดแบบ FIFO และบันทึกเข้าสมุดเงินสดให้อัตโนมัติ การยกเลิกใบเสร็จ (void) ทำได้เฉพาะใบเสร็จล่าสุดของสัญญาภายในวันเดียวกัน และต้องผ่านการอนุมัติ
- ติดตามหนี้ (/collections): บันทึกผลการติดตาม ช่องทางติดต่อ วันนัดชำระ และงานติดตามครั้งถัดไป
- การเงิน (/finance, /finance/expenses): สมุดเงินสดรายรับ-รายจ่าย แยกหมวด และการยกเลิกรายการรายจ่ายต้องขออนุมัติ
- คำขออนุมัติ (/approvals): ผู้อนุมัติ/ผู้จัดการ/แอดมิน พิจารณาอนุมัติหรือไม่อนุมัติ ระบบจะดำเนินการเปลี่ยนแปลงข้อมูลจริงในฐานข้อมูลแบบทรานแซกชันเดียวเมื่ออนุมัติเท่านั้น
- รายงาน (/reports): รายงานลูกหนี้ ค้างชำระ รับชำระ รายรับรายจ่าย และรายงานข้อมูลระบบเดิม (legacy)
- แจ้งเตือน (/notifications), สถานะระบบ (/status), ตั้งค่า (/settings, /settings/import)

กติกาสำคัญ
- ตัวกรองสาขาอยู่มุมบนของทุกหน้า ผู้ใช้สำนักงานใหญ่/แอดมินเลือกดูได้ทุกสาขาหรือรวมทั้งบริษัท ผู้ใช้สาขาเห็นเฉพาะสาขาตนเอง
- สิทธิ์: แอดมิน = ทั้งระบบและตั้งค่า, ผู้จัดการ = อนุมัติและดูข้อมูลในขอบเขต, ผู้อนุมัติ = พิจารณาคำขอ, พนักงาน = บันทึกงานประจำวัน, ผู้ดูข้อมูล = อ่านอย่างเดียว
- การแก้ไข/ยกเลิกข้อมูลสำคัญทุกอย่างต้องผ่านคำขออนุมัติ ไม่มีการแก้ไขตรงโดยข้ามระบบอนุมัติ
- เมื่อสัญญามีการชำระแล้วอย่างน้อย 1 งวด วงเงิน ดอกเบี้ย และจำนวนงวดจะถูกล็อก แก้ไขไม่ได้
- จำนวนเงินในระบบเก็บเป็นสตางค์ แต่แสดงผลเป็นบาททุกครั้ง
`.trim();

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface GatewayResponse {
  choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
}

export interface RunAssistantParams {
  /** client ที่ทำงานในฐานะผู้ใช้ (RLS) */
  supabase: SupabaseClient<Database>;
  userId: string;
  claims: Record<string, unknown>;
  /** access token ของผู้ใช้ (ส่งต่อให้ MCP tools เท่านั้น ไม่บันทึก/ไม่ส่งกลับ) */
  token: string;
  messages: AssistantMessage[];
  branchId?: string | null;
}

export interface RunAssistantResult {
  answer: string;
  scopeName: string;
  roles: string[];
  toolsUsed: string[];
}

/** ตรวจและตัดแต่งข้อความสนทนาให้อยู่ในขอบเขตที่กำหนด (ใช้ร่วมกันทั้งหน้า /assistant และ LINE endpoint) */
export function sanitizeMessages(input: unknown): AssistantMessage[] {
  const raw = Array.isArray(input) ? (input as { role?: unknown; content?: unknown }[]) : [];
  const messages = raw
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role as "user" | "assistant", content: (m.content as string).slice(0, 4000) }));
  if (messages.length === 0) throw new Error("กรุณาพิมพ์คำถาม");
  return messages;
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/** สร้าง Supabase client ที่ทำงานในฐานะผู้ใช้ (RLS) จาก access token ที่ตรวจแล้ว */
export function createUserScopedClient(token: string): SupabaseClient<Database> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** ถอด payload ของ JWT (ไม่ตรวจลายเซ็น — ใช้กับ token ที่ Supabase ออกให้และตรวจแล้วเท่านั้น) */
export function decodeJwtClaims(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  if (!part) return {};
  try {
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * แกนกลางผู้ช่วย AI: ใช้ร่วมกันระหว่างหน้า /assistant และ Internal LINE Assistant endpoint
 * อ่านข้อมูลผ่าน MCP tools ชุดเดียวกันในฐานะผู้ใช้ (RLS) แบบอ่านอย่างเดียว
 */
export async function runAssistant(params: RunAssistantParams): Promise<RunAssistantResult> {
  const { supabase, userId, claims, token } = params;
  const data = { messages: params.messages, branchId: params.branchId ?? null };

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("ยังไม่ได้เปิดใช้งาน AI สำหรับโปรเจกต์นี้");

  // Server-only modules: loaded inside the handler so they never reach the client bundle.
  const [{ READ_ONLY_TOOLS }, { ToolContext }, { z }] = await Promise.all([
    import("@/lib/mcp/registry"),
    import("@lovable.dev/mcp-js"),
    import("zod"),
  ]);

  // ---- ตัวตนและสิทธิ์ (อ่านผ่าน RLS ในฐานะผู้ใช้คนนั้นเท่านั้น) ----
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, branch_id, branches:branch_id(id, code, name, is_hq)")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const roles = (roleRows ?? []).map((r) => r.role as string);
  const homeBranch =
    (profile as unknown as { branches?: { id: string; code: string; name: string; is_hq: boolean } | null })?.branches ??
    null;
  const isHQ = roles.includes("admin") || !!homeBranch?.is_hq;
  // ผู้ใช้สาขาถูกบังคับให้อยู่ในสาขาตนเองเสมอ (RLS บังคับอยู่แล้ว ชั้นนี้กันการถามข้ามสาขาซ้ำอีกชั้น)
  const scopeBranchId = isHQ ? data.branchId : (homeBranch?.id ?? null);

  // ---- สร้าง ToolContext จาก bearer token ของผู้ใช้ (ผ่านการตรวจแล้วโดยผู้เรียก) ----
  if (!token) throw new Error("Unauthorized");
  const supabaseUrl = process.env["SUPABASE_URL"] ?? "";
  const ctx = new ToolContext({
    type: "oauth",
    principal: {
      claims,
      issuer: `${supabaseUrl}/auth/v1`,
      resource: "in-app-assistant",
      acceptedAudiences: ["authenticated"],
      scopes: [],
      sub: userId,
      ...(typeof claims["email"] === "string" ? { email: claims["email"] as string } : {}),
      clientId: "in-app-assistant",
    },
    bearer: { token },
  });

  // ---- แปลง tool definitions เป็น OpenAI-style function schema ----
  const toolByName = new Map(READ_ONLY_TOOLS.map((t) => [t.name, t]));
  const toolDefs = READ_ONLY_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: z.toJSONSchema(z.object(t.inputSchema ?? {}), { io: "input" }),
    },
  }));

  const runTool = async (call: ToolCall): Promise<string> => {
    const tool = toolByName.get(call.function.name);
    if (!tool) return JSON.stringify({ error: `unknown tool ${call.function.name}` });
    let args: Record<string, unknown> = {};
    try {
      args = call.function.arguments ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : {};
    } catch {
      return JSON.stringify({ error: "invalid JSON arguments" });
    }
    // บังคับขอบเขตสาขา: ผู้ใช้สาขาใช้ได้เฉพาะสาขาตนเอง / ผู้ใช้ HQ ใช้สาขาที่เลือกอยู่เมื่อไม่ได้ระบุ
    if (tool.inputSchema && "branch_id" in tool.inputSchema) {
      if (!isHQ && homeBranch?.id) args["branch_id"] = homeBranch.id;
      else if (isHQ && scopeBranchId && !args["branch_id"]) args["branch_id"] = scopeBranchId;
    }
    const parsed = z.object(tool.inputSchema ?? {}).safeParse(args);
    if (!parsed.success) return JSON.stringify({ error: "invalid arguments", issues: parsed.error.issues });
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await tool.handler(parsed.data as any, ctx);
      const text = (result.content ?? [])
        .map((c) => (c.type === "text" ? c.text : `[${c.type}]`))
        .join("\n");
      return (result.isError ? `ERROR: ${text}` : text).slice(0, 60_000);
    } catch (e) {
      return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
    }
  };

  const scopeName = scopeBranchId
    ? ((await supabase.from("branches").select("name").eq("id", scopeBranchId).maybeSingle()).data?.name ??
      "สาขาที่เลือก")
    : isHQ
      ? "ทุกสาขา (รวมทั้งบริษัท)"
      : (homeBranch?.name ?? "-");
  const today = new Date().toISOString().slice(0, 10);

  const system = `คุณคือ "ผู้ช่วย AI SuperChoice AI" ผู้ช่วยภายในของระบบสินเชื่อรถแลกเงิน ตอบเป็นภาษาไทยสุภาพ กระชับ ตรงประเด็น ใช้ bullet/ตารางเมื่อเหมาะสม

หน้าที่:
1) อธิบายวิธีใช้งานระบบ ฟังก์ชันแต่ละเมนู และขั้นตอนงาน ตามสิทธิ์ของผู้ใช้คนที่ถาม
2) ตอบคำถามเชิงข้อมูล/วิเคราะห์โดย "เรียกใช้เครื่องมือ" (tools) ที่ให้ไว้เสมอ ห้ามเดาตัวเลข — เครื่องมือทุกตัวอ่านข้อมูลผ่านสิทธิ์ของผู้ใช้คนนี้ (RLS) จึงเห็นได้เท่าที่เขามีสิทธิ์
 - ภาพรวม: portfolio_summary / รายสาขา: list_branches
 - ลูกค้า: search_customers / สัญญา: list_contracts, get_contract
 - ค้างชำระ: list_overdue_installments / ใบเสร็จ: list_payments / สมุดเงินสด: list_cash_entries / คำขออนุมัติ: list_pending_approvals
 - จำนวนเงินจากเครื่องมือเป็น "บาท" แล้ว แสดงผลด้วยเครื่องหมายคั่นหลักพัน

ข้อจำกัดเด็ดขาด:
- คุณเป็นผู้ช่วยแบบอ่านข้อมูลเท่านั้น ไม่สามารถสร้าง แก้ไข ลบ อนุมัติ หรือเปลี่ยนแปลงข้อมูลใด ๆ ได้ ถ้าผู้ใช้ขอให้ทำ ให้บอกขั้นตอนที่เขาต้องไปทำเองในหน้าจอที่เกี่ยวข้อง
- ห้ามเปิดเผยข้อมูลของสาขาอื่นนอกขอบเขตที่ระบุ และห้ามให้ข้อมูลส่วนบุคคล เช่น เลขบัตรประชาชนเต็ม
- ถ้าเครื่องมือคืนค่าว่างหรือ error แปลว่าผู้ใช้ไม่มีสิทธิ์เห็นหรือไม่มีข้อมูล ให้แจ้งตามนั้น ห้ามคาดเดา
- ถ้าผู้ใช้ถามงานที่เกินสิทธิ์ของเขา ให้แจ้งว่าต้องให้ผู้มีสิทธิ์ (เช่น ผู้จัดการ/ผู้อนุมัติ/แอดมิน) ดำเนินการ

${HELP_DOC}

บริบทผู้ใช้:
- ชื่อ: ${profile?.full_name || profile?.email || "-"}
- สิทธิ์: ${roles.join(", ") || "ไม่ระบุ"}${isHQ ? " (ระดับสำนักงานใหญ่ เห็นได้ทุกสาขา)" : " (เห็นเฉพาะสาขาตนเอง)"}
- สาขาต้นสังกัด: ${homeBranch?.name ?? "-"}${homeBranch ? ` (id ${homeBranch.id})` : ""}
- ขอบเขตข้อมูลที่กำลังดู: ${scopeName}${scopeBranchId ? ` (branch_id ${scopeBranchId})` : ""}
- วันที่วันนี้: ${today}`;

  const messages: ChatMessage[] = [{ role: "system", content: system }, ...data.messages];
  const toolsUsed: string[] = [];

  const callGateway = async (body: unknown): Promise<GatewayResponse> => {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[assistant] gateway error", res.status, detail.slice(0, 500));
      if (res.status === 429) throw new Error("มีการใช้งานผู้ช่วย AI ถี่เกินไป กรุณาลองใหม่อีกครั้ง");
      if (res.status === 402) throw new Error("เครดิต AI ของพื้นที่ทำงานหมด กรุณาเติมเครดิต");
      throw new Error("ผู้ช่วย AI ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่");
    }
    return (await res.json()) as GatewayResponse;
  };

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const lastRound = round === MAX_TOOL_ROUNDS;
    const json = await callGateway({
      model: MODEL,
      messages,
      ...(lastRound ? {} : { tools: toolDefs, tool_choice: "auto" }),
    });
    const msg = json.choices?.[0]?.message;
    const calls = msg?.tool_calls ?? [];
    if (!msg || calls.length === 0) {
      const answer = msg?.content?.trim();
      if (!answer) throw new Error("ผู้ช่วย AI ไม่ได้ตอบกลับ กรุณาลองใหม่");
      return { answer, scopeName, roles, toolsUsed };
    }
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
    const results = await Promise.all(calls.map(runTool));
    calls.forEach((call, i) => {
      toolsUsed.push(call.function.name);
      messages.push({ role: "tool", tool_call_id: call.id, content: results[i] ?? "" });
    });
  }
  throw new Error("ผู้ช่วย AI ไม่ได้ตอบกลับ กรุณาลองใหม่");
}
