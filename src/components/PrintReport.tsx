import type { ReactNode } from "react";

/**
 * กรอบรายงานกระดาษ A4 ภาษาไทย — หัวกระดาษเหมือนรายงาน Crystal Reports เดิม
 * ใช้ร่วมกันทุกรายงานเพื่อให้หน้าตาเป็นแบบเดียวกัน
 */
export function PrintReport({
  title,
  subtitle,
  branchName,
  periodText,
  columns,
  children,
  footerNote,
  signatures = ["ผู้จัดทำ", "ผู้ตรวจสอบ", "ผู้อนุมัติ"],
}: {
  title: string;
  subtitle?: string;
  branchName?: string | null;
  periodText?: string;
  /** จำนวนคอลัมน์ (ใช้กำหนดแนวกระดาษ) */
  columns?: number;
  children: ReactNode;
  footerNote?: string;
  signatures?: string[];
}) {
  const wide = (columns ?? 0) > 7;

  return (
    <div className={`rounded-lg border bg-card p-6 print:border-0 print:p-0 ${wide ? "text-xs" : "text-sm"}`}>
      <header className="mb-4 text-center">
        <h2 className="text-lg font-bold">บริษัท ธารทรัพย์ จำกัด</h2>
        <p className="font-medium">{title}</p>
        {subtitle && <p className="text-sm">{subtitle}</p>}
        <p className="text-xs text-muted-foreground">
          {branchName ?? "ทุกสาขา"}
          {periodText ? ` · ${periodText}` : ""}
        </p>
      </header>

      <div className="overflow-x-auto">{children}</div>

      {footerNote && <p className="mt-3 text-xs text-muted-foreground">{footerNote}</p>}

      <div className="mt-10 hidden grid-cols-3 gap-6 text-center text-xs print:grid">
        {signatures.map((s) => (
          <div key={s}>
            <div className="mx-auto mb-1 w-40 border-b border-dotted" />
            <p>({s})</p>
          </div>
        ))}
      </div>
    </div>
  );
}
