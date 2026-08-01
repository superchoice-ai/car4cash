/**
 * ตัวช่วยย้ายข้อมูลจากระบบเดิม (MS Access — bd.mdb ของโปรแกรม VB6)
 * รองรับไฟล์ CSV ที่ export จาก Access โดยตรง หรือจาก mdb-export
 * เงินในระบบใหม่เก็บเป็น "สตางค์" ส่วนระบบเดิมเก็บเป็น "บาท" (จำนวนเต็ม)
 */

export type LegacyDatasetKey =
  | "prawat"
  | "id_cus"
  | "begi"
  | "dok"
  | "pub"
  | "tidtam"
  | "pagun"
  | "tabeen"
  | "bill"
  | "end";

export interface LegacyDataset {
  key: LegacyDatasetKey;
  /** ชื่อตารางในระบบเดิม */
  table: string;
  label: string;
  description: string;
  target: "legacy_customers" | "legacy_receipts";
  /** คอลัมน์ที่ต้องมีในไฟล์ */
  required: string[];
}

export const LEGACY_DATASETS: LegacyDataset[] = [
  {
    key: "prawat",
    table: "prawat",
    label: "ประวัติลูกค้า / สัญญา (prawat)",
    description: "รหัสลูกค้า ชื่อ ที่อยู่ วงเงิน รถ ทะเบียน ค่างวด จำนวนเดือน ผู้ค้ำ คงเหลือ",
    target: "legacy_customers",
    required: ["code"],
  },
  {
    key: "id_cus",
    table: "id_cus",
    label: "เลขบัตรประชาชน/ที่อยู่ (id_cus)",
    description: "เติมเลขบัตรประชาชนและที่อยู่ตามทะเบียนบ้านให้ลูกค้าที่นำเข้าแล้ว",
    target: "legacy_customers",
    required: ["code"],
  },
  {
    key: "end",
    table: "end",
    label: "ลูกค้าปิดบัญชี (end)",
    description: "ทำเครื่องหมายลูกค้าที่ปิดบัญชีแล้วในระบบเดิม",
    target: "legacy_customers",
    required: ["code"],
  },
  {
    key: "begi",
    table: "begi",
    label: "เงินต้น (begi)",
    description: "ยอดเงินต้นที่รับชำระต่อใบเสร็จ พร้อมเงินทอน",
    target: "legacy_receipts",
    required: ["code", "b_bill"],
  },
  { key: "dok", table: "dok", label: "ดอกเบี้ย (dok)", description: "ยอดดอกเบี้ยต่อใบเสร็จ", target: "legacy_receipts", required: ["code", "b_bill"] },
  { key: "pub", table: "pub", label: "ค่าปรับ (pub)", description: "ค่าปรับล่าช้าต่อใบเสร็จ", target: "legacy_receipts", required: ["code", "b_bill"] },
  { key: "tidtam", table: "tidtam", label: "ค่าติดตาม (tidtam)", description: "ค่าติดตามทวงถามต่อใบเสร็จ", target: "legacy_receipts", required: ["code", "b_bill"] },
  { key: "pagun", table: "pagun", label: "ค่าประกัน (pagun)", description: "ค่าประกันต่อใบเสร็จ", target: "legacy_receipts", required: ["code", "b_bill"] },
  { key: "tabeen", table: "tabeen", label: "ค่าทะเบียน (tabeen)", description: "ค่าทะเบียนต่อใบเสร็จ", target: "legacy_receipts", required: ["code", "b_bill"] },
  { key: "bill", table: "bill", label: "หัวใบเสร็จ/หมายเหตุ (bill)", description: "วันที่และหมายเหตุของแต่ละใบเสร็จ", target: "legacy_receipts", required: ["code", "b_bill"] },
];

/** อ่าน CSV แบบรองรับเครื่องหมายคำพูดและขึ้นบรรทัดใหม่ในเซลล์ */
export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  return rows
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, idx) => {
        obj[h] = (r[idx] ?? "").trim();
      });
      return obj;
    });
}

/** แปลงวันที่ระบบเดิม "dd/mm/yy" (พ.ศ. 2 หลัก) เป็น ISO "yyyy-mm-dd" */
export function parseLegacyDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) {
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return iso ? s : null;
  }
  const day = parseInt(m[1]!, 10);
  const month = parseInt(m[2]!, 10);
  let year = parseInt(m[3]!, 10);
  // ระบบเดิมเก็บ พ.ศ. 2 หลัก เช่น 56 = 2556 (ถ้าล้ำอนาคตให้ถอยหลัง 100 ปี)
  if (year < 100) year += 2500;
  const nowBe = new Date().getFullYear() + 543;
  if (year > nowBe + 1) year -= 100;
  const ce = year - 543;

  if (month < 1 || month > 12 || day < 1 || day > 31 || ce < 1950 || ce > 2100) return null;
  return `${ce}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** ระบบเดิมเก็บเงินเป็นบาทจำนวนเต็ม -> แปลงเป็นสตางค์ */
export function bahtToSatang(raw: string | undefined | null): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[, ]/g, ""));
  return isFinite(n) ? Math.round(n * 100) : 0;
}

const num = (raw: string | undefined) => {
  const n = parseInt((raw ?? "").replace(/[^\d-]/g, ""), 10);
  return isFinite(n) ? n : null;
};

const clean = (raw: string | undefined) => {
  const v = (raw ?? "").replace(/\s+/g, " ").trim();
  return v === "" || v === "-" ? null : v;
};

export interface LegacyCustomerRow {
  branch_id: string;
  legacy_code: string;
  old_code?: string | null;
  full_name?: string | null;
  address?: string | null;
  national_id?: string | null;
  tel?: string | null;
  car_brand?: string | null;
  car_type?: string | null;
  plate_no?: string | null;
  loan_amount?: number;
  hire_price?: number;
  installment_amount?: number;
  term_months?: number | null;
  outstanding?: number;
  contract_date?: string | null;
  tax_due_date?: string | null;
  guarantor_name?: string | null;
  guarantor_tel?: string | null;
  note?: string | null;
  status?: string;
}

export interface LegacyReceiptRow {
  branch_id: string;
  legacy_code: string;
  bill_no: string;
  full_name?: string | null;
  paid_on?: string | null;
  paid_on_raw?: string | null;
  principal_amount?: number;
  interest_amount?: number;
  penalty_amount?: number;
  follow_up_amount?: number;
  insurance_amount?: number;
  registration_amount?: number;
  change_amount?: number;
  note?: string | null;
}

export interface MappedRows {
  target: "legacy_customers" | "legacy_receipts";
  customers: LegacyCustomerRow[];
  receipts: LegacyReceiptRow[];
  skipped: number;
}

/** แปลงแถว CSV ของแต่ละตารางเดิมให้เป็นแถวของตารางพักข้อมูล */
export function mapLegacyRows(
  dataset: LegacyDatasetKey,
  rows: Record<string, string>[],
  branchId: string,
): MappedRows {
  const customers: LegacyCustomerRow[] = [];
  const receipts: LegacyReceiptRow[] = [];
  let skipped = 0;

  const receiptBase = (r: Record<string, string>): LegacyReceiptRow | null => {
    const code = clean(r["code"]);
    const bill = clean(r["b_bill"]);
    if (!code || !bill) return null;
    return {
      branch_id: branchId,
      legacy_code: code,
      bill_no: bill,
      full_name: clean(r["name"]),
      paid_on: parseLegacyDate(r["date"]),
      paid_on_raw: clean(r["date"]),
    };
  };

  for (const r of rows) {
    switch (dataset) {
      case "prawat": {
        const code = clean(r["code"]);
        if (!code) {
          skipped++;
          break;
        }
        customers.push({
          branch_id: branchId,
          legacy_code: code,
          old_code: clean(r["oldcode"]),
          full_name: clean(r["name"]),
          address: clean(r["address"]),
          tel: clean(r["tel"]),
          car_brand: clean(r["car"]),
          car_type: clean(r["type"]),
          plate_no: clean(r["tabean"]),
          loan_amount: bahtToSatang(r["money"]),
          hire_price: bahtToSatang(r["price"]),
          installment_amount: bahtToSatang(r["pay"]),
          term_months: num(r["month"]),
          outstanding: bahtToSatang(r["hler"]),
          contract_date: clean(r["date_in"]),
          tax_due_date: clean(r["date_pasy"]),
          guarantor_name: clean(r["kum"]),
          guarantor_tel: clean(r["tel"]),
          note: clean(r["even"]),
          status: "imported",
        });
        break;
      }
      case "id_cus": {
        const code = clean(r["code"]);
        if (!code) {
          skipped++;
          break;
        }
        const addr = [r["address"], r["moo"] ? `ม.${r["moo"]}` : "", r["soi"], r["road"], r["tumbon"], r["aumper"], r["province"]]
          .map((v) => clean(v))
          .filter(Boolean)
          .join(" ");
        customers.push({
          branch_id: branchId,
          legacy_code: code,
          national_id: clean(r["id"]),
          address: addr || null,
        });
        break;
      }
      case "end": {
        const code = clean(r["code"]);
        if (!code) {
          skipped++;
          break;
        }
        customers.push({
          branch_id: branchId,
          legacy_code: code,
          full_name: clean(r["name"]),
          status: "closed",
          note: clean(r["bill"]) ? `ปิดบัญชีใบเสร็จ ${clean(r["bill"])}` : null,
        });
        break;
      }
      default: {
        const base = receiptBase(r);
        if (!base) {
          skipped++;
          break;
        }
        if (dataset === "begi") {
          base.principal_amount = bahtToSatang(r["begi"]);
          base.change_amount = bahtToSatang(r["ton"]);
        } else if (dataset === "dok") base.interest_amount = bahtToSatang(r["dok"]);
        else if (dataset === "pub") base.penalty_amount = bahtToSatang(r["pub"]);
        else if (dataset === "tidtam") base.follow_up_amount = bahtToSatang(r["tidtam"]);
        else if (dataset === "pagun") base.insurance_amount = bahtToSatang(r["pagun"]);
        else if (dataset === "tabeen") base.registration_amount = bahtToSatang(r["tabeen"]);
        else if (dataset === "bill") base.note = clean(r["comment"]);
        receipts.push(base);
      }
    }
  }

  const meta = LEGACY_DATASETS.find((d) => d.key === dataset)!;
  return { target: meta.target, customers, receipts, skipped };
}

export const receiptTotal = (r: {
  principal_amount?: number | null;
  interest_amount?: number | null;
  penalty_amount?: number | null;
  follow_up_amount?: number | null;
  insurance_amount?: number | null;
  registration_amount?: number | null;
}): number =>
  Number(r.principal_amount ?? 0) +
  Number(r.interest_amount ?? 0) +
  Number(r.penalty_amount ?? 0) +
  Number(r.follow_up_amount ?? 0) +
  Number(r.insurance_amount ?? 0) +
  Number(r.registration_amount ?? 0);
