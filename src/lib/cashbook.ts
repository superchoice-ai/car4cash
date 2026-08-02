import type { Database } from "@/integrations/supabase/types";

export type CashDirection = Database["public"]["Enums"]["cash_direction"];
export type CashCategory = Database["public"]["Enums"]["cash_category"];

export interface CashCategoryConfig {
  key: CashCategory;
  label: string;
  /** ทิศทางที่อนุญาตให้ใช้หมวดนี้ */
  directions: CashDirection[];
}

/** ลำดับตามปุ่มในระบบเดิม (TCA) */
export const CASH_CATEGORIES: CashCategoryConfig[] = [
  { key: "principal", label: "เงินต้น", directions: ["income"] },
  { key: "interest", label: "ดอกเบี้ย", directions: ["income", "expense"] },
  { key: "penalty", label: "ค่าปรับ", directions: ["income", "expense"] },
  { key: "insurance", label: "ค่าประกัน", directions: ["income", "expense"] },
  { key: "registration", label: "ค่าทะเบียน", directions: ["income", "expense"] },
  { key: "follow_up", label: "ค่าติดตาม", directions: ["income", "expense"] },
  { key: "salary", label: "เงินเดือน", directions: ["expense"] },
  { key: "office", label: "ค่าสำนักงาน", directions: ["expense"] },
  { key: "loan_repay", label: "คืนเงินกู้", directions: ["expense"] },
  { key: "inter_branch", label: "ต่างสาขา", directions: ["income", "expense"] },
  { key: "other", label: "อื่นๆ", directions: ["income", "expense"] },
];

export const CASH_CATEGORY_LABEL: Record<CashCategory, string> = CASH_CATEGORIES.reduce(
  (acc, c) => {
    acc[c.key] = c.label;
    return acc;
  },
  {} as Record<CashCategory, string>,
);

export const CASH_DIRECTION_LABEL: Record<CashDirection, string> = {
  income: "รายรับ",
  expense: "รายจ่าย",
};

export const categoriesFor = (direction: CashDirection): CashCategoryConfig[] =>
  CASH_CATEGORIES.filter((c) => c.directions.includes(direction));

/** หมวดที่ใช้ในฟอร์มรับชำระ (ตรงกับช่องในใบเสร็จระบบเดิม) */
export const INCOME_RECEIPT_CATEGORIES: CashCategory[] = [
  "principal",
  "interest",
  "penalty",
  "insurance",
  "registration",
  "follow_up",
];

export interface CashLineInput {
  category: CashCategory;
  amount: number;
  note?: string | null;
}

export const sumLines = (lines: { amount: number | string }[]): number =>
  lines.reduce((s, l) => s + Number(l.amount), 0);

/** รวมยอดแยกตามหมวด */
export function totalsByCategory(
  lines: { category: CashCategory; amount: number | string }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of lines) out[l.category] = (out[l.category] ?? 0) + Number(l.amount);
  return out;
}
