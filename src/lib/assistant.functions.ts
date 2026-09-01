import { createServerFn } from "@tanstack/react-start";
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

const MAX_TURNS = 12;
const MODEL = "google/gemini-3.7-flash";

const HELP_DOC = `
คู่มือการใช้งานระบบสินเชื่อ "ธารทรัพย์" (สรุปสำหรับตอบคำถามผู้ใช้)

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

/** ผู้ช่วย AI: ตอบคำถามวิธีใช้งาน และวิเคราะห์ข้อมูลแบบอ่านอย่างเดียวตามสิทธิ์ผู้ใช้ */
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AskInput) => {
    const messages = (input?.messages ?? [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_TURNS)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (messages.length === 0) throw new Error("กรุณาพิมพ์คำถาม");
    return { messages, branchId: input?.branchId ?? null };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("ยังไม่ได้เปิดใช้งาน AI สำหรับโปรเจกต์นี้");

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
    const homeBranch = (profile as unknown as { branches?: { id: string; code: string; name: string; is_hq: boolean } | null })
      ?.branches ?? null;
    const isHQ = roles.includes("admin") || !!homeBranch?.is_hq;
    // ผู้ใช้สาขาถูกบังคับให้อยู่ในสาขาตนเองเสมอ ไม่ให้ระบุสาขาอื่นผ่านคำถาม
    const scopeBranchId = isHQ ? data.branchId : (homeBranch?.id ?? null);

    const today = new Date().toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;
    const br = scopeBranchId;

    const countContracts = async (status: string) => {
      let q = supabase.from("contracts").select("id", { count: "exact", head: true }).eq("status", status);
      if (br) q = q.eq("branch_id", br);
      return (await q).count ?? 0;
    };

    const countCustomers = async () => {
      let q = supabase.from("customers").select("id", { count: "exact", head: true });
      if (br) q = q.eq("branch_id", br);
      return (await q).count ?? 0;
    };

    const countPendingApprovals = async () => {
      let q = supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
      if (br) q = q.eq("branch_id", br);
      return (await q).count ?? 0;
    };

    const countCollections = async () => {
      let q = supabase
        .from("collection_activities")
        .select("id", { count: "exact", head: true })
        .gte("acted_at", monthStart);
      if (br) q = q.eq("branch_id", br);
      return (await q).count ?? 0;
    };

    const fetchContracts = async () => {
      let q = supabase.from("contracts").select("outstanding, status");
      if (br) q = q.eq("branch_id", br);
      return (await q).data ?? [];
    };

    const fetchOverdueInstallments = async () => {
      let q = supabase
        .from("installments")
        .select("total_amount, paid_amount")
        .lt("due_date", today)
        .neq("status", "paid");
      if (br) q = q.eq("branch_id", br);
      return (await q).data ?? [];
    };

    const fetchPayments = async () => {
      let q = supabase.from("payments").select("amount").gte("paid_at", monthStart).eq("voided", false);
      if (br) q = q.eq("branch_id", br);
      return (await q).data ?? [];
    };

    const fetchCash = async () => {
      let q = supabase
        .from("cash_entries")
        .select("direction, total_amount")
        .gte("entry_date", monthStart)
        .eq("voided", false);
      if (br) q = q.eq("branch_id", br);
      return (await q).data ?? [];
    };

    const [
      branchList,
      customerCount,
      activeContracts,
      overdueContracts,
      closedContracts,
      pendingApprovals,
      contractRows,
      overdueList,
      paymentRows,
      cashRows,
      recentCollections,
    ] = await Promise.all([
      supabase.from("branches").select("id, name").eq("active", true).order("code"),
      countCustomers(),
      countContracts("active"),
      countContracts("overdue"),
      countContracts("closed"),
      countPendingApprovals(),
      fetchContracts(),
      fetchOverdueInstallments(),
      fetchPayments(),
      fetchCash(),
      countCollections(),
    ]);


    const baht = (satang: number) => Math.round(satang / 100).toLocaleString("th-TH");
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

    const contracts = outstandingRows.data ?? [];
    const outstandingTotal = sum(contracts.filter((c) => c.status !== "closed").map((c) => c.outstanding ?? 0));
    const overdueList = overdueInstallments.data ?? [];
    const overdueAmount = sum(overdueList.map((i) => Math.max((i.total_amount ?? 0) - (i.paid_amount ?? 0), 0)));
    const income = sum((cashThisMonth.data ?? []).filter((c) => c.direction === "income").map((c) => c.total_amount ?? 0));
    const expense = sum((cashThisMonth.data ?? []).filter((c) => c.direction === "expense").map((c) => c.total_amount ?? 0));
    const paidThisMonth = sum((paymentsThisMonth.data ?? []).map((p) => p.amount ?? 0));

    const scopeName = scopeBranchId
      ? ((branchList.data ?? []).find((b) => b.id === scopeBranchId)?.name ?? "สาขาที่เลือก")
      : isHQ
        ? "ทุกสาขา (รวมทั้งบริษัท)"
        : (homeBranch?.name ?? "-");

    const snapshot = `
ผู้ใช้: ${profile?.full_name || profile?.email || "-"}
สิทธิ์: ${roles.join(", ") || "ไม่ระบุ"}${isHQ ? " (ระดับสำนักงานใหญ่ เห็นได้ทุกสาขา)" : " (เห็นเฉพาะสาขาตนเอง)"}
สาขาต้นสังกัด: ${homeBranch?.name ?? "-"}
ขอบเขตข้อมูลที่กำลังดู: ${scopeName}
วันที่วันนี้: ${today}

ตัวเลขสรุป (นับเฉพาะข้อมูลที่ผู้ใช้มีสิทธิ์เห็น)
- ลูกค้าทั้งหมด: ${customerCount.toLocaleString("th-TH")} ราย
- สัญญา: ปกติ ${activeContracts} / ค้างชำระ ${overdueContracts} / ปิดบัญชี ${closedContracts}
- ยอดลูกหนี้คงค้าง (สัญญาที่ยังไม่ปิด): ${baht(outstandingTotal)} บาท
- งวดที่เกินกำหนดยังไม่ชำระครบ: ${overdueList.length} งวด รวมค้าง ${baht(overdueAmount)} บาท
- รับชำระเดือนนี้ (ตั้งแต่ ${monthStart}): ${baht(paidThisMonth)} บาท
- สมุดเงินสดเดือนนี้: รายรับ ${baht(income)} บาท / รายจ่าย ${baht(expense)} บาท / คงเหลือสุทธิ ${baht(income - expense)} บาท
- งานติดตามหนี้เดือนนี้: ${recentCollections} รายการ
- คำขออนุมัติที่รออยู่: ${pendingApprovals} รายการ
`.trim();

    const system = `คุณคือ "ผู้ช่วย AI ธารทรัพย์" ผู้ช่วยภายในของระบบสินเชื่อรถแลกเงิน ตอบเป็นภาษาไทยสุภาพ กระชับ ตรงประเด็น ใช้ bullet เมื่อเหมาะสม

หน้าที่:
1) อธิบายวิธีใช้งานระบบ ฟังก์ชันแต่ละเมนู และขั้นตอนงาน ตามสิทธิ์ของผู้ใช้คนที่ถาม
2) วิเคราะห์/สรุปข้อมูลจากตัวเลขสรุปที่ให้มาเท่านั้น

ข้อจำกัดเด็ดขาด:
- คุณเป็นผู้ช่วยแบบอ่านข้อมูลเท่านั้น ไม่สามารถสร้าง แก้ไข ลบ อนุมัติ หรือเปลี่ยนแปลงข้อมูลใด ๆ ได้ ถ้าผู้ใช้ขอให้ทำ ให้บอกขั้นตอนที่เขาต้องไปทำเองในหน้าจอที่เกี่ยวข้อง
- ห้ามเดาหรือแต่งตัวเลข ถ้าไม่มีข้อมูลในสรุป ให้บอกว่าดูได้จากหน้าจอ/รายงานใด
- ห้ามเปิดเผยข้อมูลของสาขาอื่นนอกขอบเขตที่ระบุ และห้ามให้ข้อมูลส่วนบุคคล เช่น เลขบัตรประชาชนเต็ม
- ถ้าผู้ใช้ถามงานที่เกินสิทธิ์ของเขา ให้แจ้งว่าต้องให้ผู้มีสิทธิ์ (เช่น ผู้จัดการ/ผู้อนุมัติ/แอดมิน) ดำเนินการ

${HELP_DOC}

ข้อมูลบริบทของผู้ใช้และตัวเลขล่าสุด:
${snapshot}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[assistant] gateway error", res.status, detail.slice(0, 500));
      if (res.status === 429) throw new Error("มีการใช้งานผู้ช่วย AI ถี่เกินไป กรุณาลองใหม่อีกครั้ง");
      if (res.status === 402) throw new Error("เครดิต AI ของพื้นที่ทำงานหมด กรุณาเติมเครดิต");
      throw new Error("ผู้ช่วย AI ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่");
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const answer = json.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("ผู้ช่วย AI ไม่ได้ตอบกลับ กรุณาลองใหม่");

    return { answer, scopeName, roles };
  });
