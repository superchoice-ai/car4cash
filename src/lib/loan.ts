import { addMonths } from "./format";

export interface LoanTerms {
  /** เงินต้น (สตางค์) */
  principal: number;
  /** อัตราดอกเบี้ยแบบ Flat rate ต่อเดือน (%) */
  interestRate: number;
  /** จำนวนงวด (เดือน) */
  termMonths: number;
}

export interface ScheduleRow {
  seq: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
}

export interface LoanSummary {
  installment: number;
  totalInterest: number;
  totalPayable: number;
  schedule: ScheduleRow[];
}

/**
 * คำนวณตารางผ่อนแบบ Flat rate (ดอกเบี้ยคงที่ต่อเดือนจากเงินต้น)
 * ทุกจำนวนเป็นสตางค์ เพื่อเลี่ยงปัญหาปัดเศษทศนิยม
 */
export function buildSchedule(terms: LoanTerms, firstDueDate: string): LoanSummary {
  const { principal, interestRate, termMonths } = terms;
  const months = Math.max(1, Math.floor(termMonths));

  const interestPerMonth = Math.round((principal * interestRate) / 100);
  const totalInterest = interestPerMonth * months;
  const totalPayable = principal + totalInterest;
  const installment = Math.round(totalPayable / months);

  const principalPerMonth = Math.floor(principal / months);

  const schedule: ScheduleRow[] = [];
  let principalLeft = principal;
  let paidTotal = 0;

  for (let i = 1; i <= months; i++) {
    const isLast = i === months;
    const principalAmount = isLast ? principalLeft : principalPerMonth;
    const totalAmount = isLast ? totalPayable - paidTotal : installment;
    const interestAmount = totalAmount - principalAmount;
    principalLeft -= principalAmount;
    paidTotal += totalAmount;
    schedule.push({
      seq: i,
      dueDate: addMonths(firstDueDate, i - 1),
      principalAmount,
      interestAmount,
      totalAmount,
    });
  }

  return { installment, totalInterest, totalPayable, schedule };
}

/** ค่าปรับล่าช้า = ยอดค้าง x อัตรา%/วัน x จำนวนวันเกินกำหนด */
export function calcPenalty(outstanding: number, ratePerDay: number, overdueDays: number): number {
  if (overdueDays <= 0 || outstanding <= 0) return 0;
  return Math.round((outstanding * ratePerDay * overdueDays) / 100);
}

/** วงเงินสูงสุดตาม LTV ของราคาประเมิน */
export function maxLoanByLtv(appraisedValue: number, ltv: number): number {
  return Math.round(appraisedValue * ltv);
}

export interface LoanDefaults {
  interest_rate: number;
  terms: number[];
  penalty_rate_per_day: number;
  fee_percent: number;
  ltv_car: number;
  ltv_motorcycle: number;
  branch_approval_limit: number;
}

export const FALLBACK_DEFAULTS: LoanDefaults = {
  interest_rate: 1.25,
  terms: [12, 18, 24, 36],
  penalty_rate_per_day: 0.05,
  fee_percent: 1.0,
  ltv_car: 0.7,
  ltv_motorcycle: 0.5,
  branch_approval_limit: 300000,
};
