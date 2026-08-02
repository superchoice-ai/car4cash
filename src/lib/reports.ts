import { supabase } from "@/integrations/supabase/client";
import { formatMoney, formatThaiDate, todayISO } from "@/lib/format";
import { CASH_CATEGORIES, CASH_CATEGORY_LABEL, type CashCategory } from "@/lib/cashbook";
import { CONTRACT_STATUS_LABEL, COLLECTION_CHANNEL_LABEL } from "@/lib/labels";

export type ParamKind = "range" | "keyword" | "none";

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  money?: boolean;
}

export interface ReportParams {
  from: string;
  to: string;
  keyword: string;
}

export interface ReportResult {
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  /** คีย์คอลัมน์ที่ต้องรวมยอดท้ายรายงาน */
  totalKeys?: string[];
  note?: string;
}

export interface ReportDef {
  id: string;
  title: string;
  group: string;
  param: ParamKind;
  description?: string;
}

export const REPORTS: ReportDef[] = [
  { id: "personal", title: "รายงานเฉพาะบุคคล", group: "ลูกค้า", param: "keyword", description: "ค้นหาด้วยรหัส ชื่อ หรือทะเบียนรถ" },
  { id: "income-daily", title: "สรุปรายรับประจำวัน / เดือน", group: "รายรับ-รายจ่าย", param: "range" },
  { id: "expense-daily", title: "สรุปรายจ่ายประจำวัน / เดือน", group: "รายรับ-รายจ่าย", param: "range" },
  { id: "ledger-summary", title: "สรุปยอดบัญชีแยกประเภท", group: "รายรับ-รายจ่าย", param: "range" },
  { id: "investment", title: "บัญชีเงินลงทุน − คืนเงินกู้", group: "รายรับ-รายจ่าย", param: "range" },
  { id: "income-insurance", title: "รายได้ค่าประกัน", group: "รายรับ-รายจ่าย", param: "range" },
  { id: "income-registration", title: "รายได้ค่าทะเบียน", group: "รายรับ-รายจ่าย", param: "range" },
  { id: "income-inter-branch", title: "รายรับต่างสาขา", group: "รายรับ-รายจ่าย", param: "range" },
  { id: "income-other", title: "รายรับอื่นๆ", group: "รายรับ-รายจ่าย", param: "range" },
  { id: "closed-customers", title: "ลูกค้าปิดบัญชี", group: "ลูกหนี้", param: "none" },
  { id: "debtors", title: "บัญชีลูกหนี้", group: "ลูกหนี้", param: "none" },
  { id: "debtors-all", title: "บัญชียอดคงเหลือลูกหนี้ — ลูกหนี้ทั้งหมด", group: "ลูกหนี้", param: "none" },
  { id: "debtors-outstanding", title: "บัญชียอดคงเหลือลูกหนี้ — ลูกหนี้คงเหลือ", group: "ลูกหนี้", param: "none" },
  { id: "overdue-1-2", title: "บัญชีลูกหนี้ค้างชำระ 1–2 เดือน", group: "ค้างชำระ", param: "none" },
  { id: "overdue-2-3", title: "บัญชีลูกหนี้ค้างชำระ 2–3 เดือน", group: "ค้างชำระ", param: "none" },
  { id: "overdue-3plus", title: "บัญชีลูกหนี้ค้างชำระเกิน 3 เดือน", group: "ค้างชำระ", param: "none" },
  { id: "envelope-1-2", title: "จ่าหน้าซองจดหมาย — ค้างชำระ 1–2 เดือน", group: "ค้างชำระ", param: "none" },
  { id: "envelope-2-3", title: "จ่าหน้าซองจดหมาย — ค้างชำระ 2–3 เดือน", group: "ค้างชำระ", param: "none" },
  { id: "follow-up-cover", title: "ใบปะหน้าติดตาม", group: "ติดตามหนี้", param: "none" },
  { id: "follow-up-fee", title: "รายงานค่าติดตามหนี้", group: "ติดตามหนี้", param: "range" },
  { id: "follow-up-log", title: "รายงานบันทึกการติดตาม", group: "ติดตามหนี้", param: "range" },
  { id: "blacklist", title: "รายชื่อลูกค้าที่ไม่ต้องการ", group: "ลูกค้า", param: "none" },
];

export const getReport = (id: string): ReportDef | undefined => REPORTS.find((r) => r.id === id);

const CONTRACT_COLUMNS: ReportColumn[] = [
  { key: "code", label: "เลขที่สัญญา" },
  { key: "customer", label: "ชื่อ-สกุล" },
  { key: "plate", label: "ทะเบียนรถ" },
  { key: "phone", label: "โทรศัพท์" },
  { key: "principal", label: "วงเงิน", align: "right", money: true },
  { key: "installment", label: "ค่างวด", align: "right", money: true },
  { key: "outstanding", label: "คงเหลือ", align: "right", money: true },
  { key: "status", label: "สถานะ" },
];

interface ContractJoin {
  id: string;
  code: string;
  principal: number;
  installment_amount: number;
  outstanding: number;
  status: string;
  start_date: string;
  customers: { full_name: string; phone: string | null; address: string | null; code: string } | null;
  vehicles: { plate_no: string | null } | null;
}

async function fetchContracts(statuses?: string[]) {
  let q = supabase
    .from("contracts")
    .select(
      "id, code, principal, installment_amount, outstanding, status, start_date, customers:customer_id(code, full_name, phone, address), vehicles:vehicle_id(plate_no)",
    )
    .order("code")
    .limit(1000);
  if (statuses) q = q.in("status", statuses);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ContractJoin[];
}

const contractRow = (c: ContractJoin) => ({
  code: c.code,
  customer: c.customers?.full_name ?? "-",
  plate: c.vehicles?.plate_no ?? "-",
  phone: c.customers?.phone ?? "-",
  principal: Number(c.principal),
  installment: Number(c.installment_amount),
  outstanding: Number(c.outstanding),
  status: CONTRACT_STATUS_LABEL[c.status] ?? c.status,
});

/** จำนวนเดือนที่ค้างชำระโดยประมาณ จากงวดที่เกินกำหนดและยังไม่ปิด */
async function overdueBuckets() {
  const today = todayISO();
  const { data, error } = await supabase
    .from("installments")
    .select("contract_id, due_date, total_amount, paid_amount, status")
    .lt("due_date", today)
    .neq("status", "paid")
    .limit(5000);
  if (error) throw error;
  const map = new Map<string, { count: number; amount: number; oldest: string }>();
  for (const i of data ?? []) {
    const prev = map.get(i.contract_id) ?? { count: 0, amount: 0, oldest: i.due_date };
    prev.count += 1;
    prev.amount += Number(i.total_amount) - Number(i.paid_amount);
    if (i.due_date < prev.oldest) prev.oldest = i.due_date;
    map.set(i.contract_id, prev);
  }
  return map;
}

async function overdueReport(min: number, max: number, envelope: boolean): Promise<ReportResult> {
  const [contracts, buckets] = await Promise.all([fetchContracts(["active", "overdue"]), overdueBuckets()]);
  const picked = contracts.filter((c) => {
    const b = buckets.get(c.id);
    if (!b) return false;
    return b.count >= min && b.count < max;
  });

  if (envelope) {
    return {
      columns: [
        { key: "customer", label: "เรียน" },
        { key: "address", label: "ที่อยู่" },
        { key: "code", label: "เลขที่สัญญา" },
        { key: "overdue", label: "ยอดค้าง", align: "right", money: true },
      ],
      rows: picked.map((c) => ({
        customer: c.customers?.full_name ?? "-",
        address: c.customers?.address ?? "-",
        code: c.code,
        overdue: buckets.get(c.id)?.amount ?? 0,
      })),
      totalKeys: ["overdue"],
    };
  }

  return {
    columns: [
      ...CONTRACT_COLUMNS.slice(0, 4),
      { key: "months", label: "งวดค้าง", align: "right" },
      { key: "oldest", label: "ค้างตั้งแต่" },
      { key: "overdue", label: "ยอดค้างชำระ", align: "right", money: true },
      { key: "outstanding", label: "คงเหลือทั้งสัญญา", align: "right", money: true },
    ],
    rows: picked.map((c) => {
      const b = buckets.get(c.id)!;
      return {
        code: c.code,
        customer: c.customers?.full_name ?? "-",
        plate: c.vehicles?.plate_no ?? "-",
        phone: c.customers?.phone ?? "-",
        months: b.count,
        oldest: formatThaiDate(b.oldest),
        overdue: b.amount,
        outstanding: Number(c.outstanding),
      };
    }),
    totalKeys: ["overdue", "outstanding"],
  };
}

interface CashEntryJoin {
  id: string;
  doc_no: string;
  entry_date: string;
  party_name: string;
  direction: "income" | "expense";
  total_amount: number;
  cash_entry_lines: { category: CashCategory; amount: number }[];
}

async function fetchCashEntries(direction: "income" | "expense", p: ReportParams) {
  const { data, error } = await supabase
    .from("cash_entries")
    .select("id, doc_no, entry_date, party_name, direction, total_amount, cash_entry_lines(category, amount)")
    .eq("direction", direction)
    .eq("voided", false)
    .gte("entry_date", p.from)
    .lte("entry_date", p.to)
    .order("entry_date")
    .order("doc_no")
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as unknown as CashEntryJoin[];
}

const lineAmount = (e: CashEntryJoin, cat: CashCategory) =>
  e.cash_entry_lines.filter((l) => l.category === cat).reduce((s, l) => s + Number(l.amount), 0);

async function categoryIncomeReport(cat: CashCategory, p: ReportParams): Promise<ReportResult> {
  const entries = await fetchCashEntries("income", p);
  const rows = entries
    .map((e) => ({
      doc_no: e.doc_no,
      entry_date: formatThaiDate(e.entry_date),
      party: e.party_name || "-",
      amount: lineAmount(e, cat),
    }))
    .filter((r) => r.amount > 0);
  return {
    columns: [
      { key: "doc_no", label: "เลขที่ใบเสร็จ" },
      { key: "entry_date", label: "วันที่" },
      { key: "party", label: "ชื่อ-สกุล" },
      { key: "amount", label: CASH_CATEGORY_LABEL[cat], align: "right", money: true },
    ],
    rows,
    totalKeys: ["amount"],
  };
}

export async function runReport(id: string, p: ReportParams): Promise<ReportResult> {
  switch (id) {
    case "personal": {
      const contracts = await fetchContracts();
      const kw = p.keyword.trim().toLowerCase();
      const picked = kw
        ? contracts.filter(
            (c) =>
              c.code.toLowerCase().includes(kw) ||
              (c.customers?.full_name ?? "").toLowerCase().includes(kw) ||
              (c.customers?.code ?? "").toLowerCase().includes(kw) ||
              (c.vehicles?.plate_no ?? "").toLowerCase().includes(kw),
          )
        : [];
      return {
        columns: CONTRACT_COLUMNS,
        rows: picked.map(contractRow),
        totalKeys: ["principal", "outstanding"],
        note: kw ? undefined : "กรุณากรอกคำค้นหาเพื่อแสดงรายงาน",
      };
    }

    case "income-daily": {
      const entries = await fetchCashEntries("income", p);
      const cats: CashCategory[] = ["principal", "interest", "penalty", "insurance", "registration", "follow_up", "other"];
      return {
        columns: [
          { key: "doc_no", label: "เลขที่ใบเสร็จ" },
          { key: "entry_date", label: "วันที่" },
          { key: "party", label: "ชื่อ-สกุล" },
          ...cats.map((c) => ({ key: c, label: CASH_CATEGORY_LABEL[c], align: "right" as const, money: true })),
          { key: "total", label: "รวม", align: "right", money: true },
        ],
        rows: entries.map((e) => ({
          doc_no: e.doc_no,
          entry_date: formatThaiDate(e.entry_date),
          party: e.party_name || "-",
          ...Object.fromEntries(cats.map((c) => [c, lineAmount(e, c)])),
          total: Number(e.total_amount),
        })),
        totalKeys: [...cats, "total"],
      };
    }

    case "expense-daily": {
      const entries = await fetchCashEntries("expense", p);
      const cats: CashCategory[] = ["salary", "insurance", "registration", "follow_up", "office", "interest", "loan_repay", "inter_branch", "other"];
      return {
        columns: [
          { key: "doc_no", label: "เลขที่ใบสำคัญ" },
          { key: "entry_date", label: "วันที่" },
          { key: "party", label: "ชื่อ-สกุล" },
          ...cats.map((c) => ({ key: c, label: CASH_CATEGORY_LABEL[c], align: "right" as const, money: true })),
          { key: "total", label: "รวม", align: "right", money: true },
        ],
        rows: entries.map((e) => ({
          doc_no: e.doc_no,
          entry_date: formatThaiDate(e.entry_date),
          party: e.party_name || "-",
          ...Object.fromEntries(cats.map((c) => [c, lineAmount(e, c)])),
          total: Number(e.total_amount),
        })),
        totalKeys: [...cats, "total"],
      };
    }

    case "ledger-summary": {
      const [inc, exp] = await Promise.all([fetchCashEntries("income", p), fetchCashEntries("expense", p)]);
      const rows = CASH_CATEGORIES.map((c) => {
        const income = inc.reduce((s, e) => s + lineAmount(e, c.key), 0);
        const expense = exp.reduce((s, e) => s + lineAmount(e, c.key), 0);
        return { category: c.label, income, expense, net: income - expense };
      }).filter((r) => r.income > 0 || r.expense > 0);
      return {
        columns: [
          { key: "category", label: "หมวดบัญชี" },
          { key: "income", label: "รายรับ", align: "right", money: true },
          { key: "expense", label: "รายจ่าย", align: "right", money: true },
          { key: "net", label: "สุทธิ", align: "right", money: true },
        ],
        rows,
        totalKeys: ["income", "expense", "net"],
      };
    }

    case "investment": {
      const exp = await fetchCashEntries("expense", p);
      const rows = exp
        .map((e) => ({
          doc_no: e.doc_no,
          entry_date: formatThaiDate(e.entry_date),
          party: e.party_name || "-",
          loan_repay: lineAmount(e, "loan_repay"),
          interest: lineAmount(e, "interest"),
        }))
        .filter((r) => r.loan_repay > 0 || r.interest > 0);
      return {
        columns: [
          { key: "doc_no", label: "เลขที่ใบสำคัญ" },
          { key: "entry_date", label: "วันที่" },
          { key: "party", label: "ผู้ให้กู้ / ผู้ลงทุน" },
          { key: "loan_repay", label: "คืนเงินกู้", align: "right", money: true },
          { key: "interest", label: "ดอกเบี้ยจ่าย", align: "right", money: true },
        ],
        rows,
        totalKeys: ["loan_repay", "interest"],
      };
    }

    case "income-insurance":
      return categoryIncomeReport("insurance", p);
    case "income-registration":
      return categoryIncomeReport("registration", p);
    case "income-inter-branch":
      return categoryIncomeReport("inter_branch", p);
    case "income-other":
      return categoryIncomeReport("other", p);
    case "follow-up-fee":
      return categoryIncomeReport("follow_up", p);

    case "closed-customers": {
      const contracts = await fetchContracts(["closed"]);
      return { columns: CONTRACT_COLUMNS, rows: contracts.map(contractRow), totalKeys: ["principal"] };
    }

    case "debtors":
    case "debtors-all": {
      const contracts = await fetchContracts();
      return { columns: CONTRACT_COLUMNS, rows: contracts.map(contractRow), totalKeys: ["principal", "outstanding"] };
    }

    case "debtors-outstanding": {
      const contracts = await fetchContracts(["active", "overdue"]);
      return {
        columns: CONTRACT_COLUMNS,
        rows: contracts.filter((c) => Number(c.outstanding) > 0).map(contractRow),
        totalKeys: ["principal", "outstanding"],
      };
    }

    case "overdue-1-2":
      return overdueReport(1, 3, false);
    case "overdue-2-3":
      return overdueReport(3, 4, false);
    case "overdue-3plus":
      return overdueReport(4, Infinity, false);
    case "envelope-1-2":
      return overdueReport(1, 3, true);
    case "envelope-2-3":
      return overdueReport(3, 4, true);

    case "follow-up-cover": {
      const [contracts, buckets] = await Promise.all([fetchContracts(["active", "overdue"]), overdueBuckets()]);
      const picked = contracts.filter((c) => buckets.has(c.id));
      return {
        columns: [
          { key: "code", label: "เลขที่สัญญา" },
          { key: "customer", label: "ชื่อ-สกุล" },
          { key: "address", label: "ที่อยู่" },
          { key: "phone", label: "โทรศัพท์" },
          { key: "plate", label: "ทะเบียนรถ" },
          { key: "overdue", label: "ยอดค้าง", align: "right", money: true },
        ],
        rows: picked.map((c) => ({
          code: c.code,
          customer: c.customers?.full_name ?? "-",
          address: c.customers?.address ?? "-",
          phone: c.customers?.phone ?? "-",
          plate: c.vehicles?.plate_no ?? "-",
          overdue: buckets.get(c.id)?.amount ?? 0,
        })),
        totalKeys: ["overdue"],
      };
    }

    case "follow-up-log": {
      const { data, error } = await supabase
        .from("collection_activities")
        .select("acted_at, channel, result, detail, promise_date, contracts:contract_id(code, customers:customer_id(full_name))")
        .gte("acted_at", p.from)
        .lte("acted_at", p.to)
        .order("acted_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return {
        columns: [
          { key: "acted_at", label: "วันที่ติดตาม" },
          { key: "code", label: "เลขที่สัญญา" },
          { key: "customer", label: "ชื่อ-สกุล" },
          { key: "channel", label: "ช่องทาง" },
          { key: "result", label: "ผลการติดตาม" },
          { key: "promise", label: "วันนัดชำระ" },
        ],
        rows: (data ?? []).map((r) => ({
          acted_at: formatThaiDate(r.acted_at),
          code: r.contracts?.code ?? "-",
          customer: r.contracts?.customers?.full_name ?? "-",
          channel: COLLECTION_CHANNEL_LABEL[r.channel] ?? r.channel,
          result: r.result ?? r.detail ?? "-",
          promise: r.promise_date ? formatThaiDate(r.promise_date) : "-",
        })),
      };
    }

    case "blacklist": {
      const { data, error } = await supabase
        .from("customers")
        .select("code, full_name, phone, address, note, status")
        .eq("status", "blacklist")
        .order("code")
        .limit(1000);
      if (error) throw error;
      return {
        columns: [
          { key: "code", label: "รหัสลูกค้า" },
          { key: "full_name", label: "ชื่อ-สกุล" },
          { key: "phone", label: "โทรศัพท์" },
          { key: "address", label: "ที่อยู่" },
          { key: "note", label: "หมายเหตุ" },
        ],
        rows: (data ?? []).map((c) => ({
          code: c.code,
          full_name: c.full_name,
          phone: c.phone ?? "-",
          address: c.address ?? "-",
          note: c.note ?? "-",
        })),
      };
    }

    default:
      return { columns: [], rows: [], note: "ไม่พบรายงานนี้" };
  }
}

export const cellText = (col: ReportColumn, value: string | number | undefined): string => {
  if (value === undefined || value === null || value === "") return col.money ? formatMoney(0) : "-";
  return col.money ? formatMoney(Number(value)) : String(value);
};
