/** ตัวช่วยจัดรูปแบบข้อมูลภาษาไทย — เงินเก็บเป็น "สตางค์" (จำนวนเต็ม) เสมอ */

export const toSatang = (baht: number | string): number => {
  const n = typeof baht === "string" ? parseFloat(baht.replace(/,/g, "")) : baht;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
};

export const toBaht = (satang: number | null | undefined): number => (satang ?? 0) / 100;

export const formatMoney = (satang: number | null | undefined, withSymbol = false): string => {
  const v = toBaht(satang);
  const s = v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return withSymbol ? `฿${s}` : s;
};

export const formatMoneyShort = (satang: number | null | undefined): string => {
  const v = toBaht(satang);
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ล้าน`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toLocaleString("th-TH", { maximumFractionDigits: 1 })}K`;
  return v.toLocaleString("th-TH", { maximumFractionDigits: 0 });
};

export const formatNumber = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString("th-TH");

/** แปลงวันที่เป็นรูปแบบไทย พ.ศ. */
export const formatThaiDate = (
  value: string | Date | null | undefined,
  style: "short" | "long" = "short",
): string => {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: style === "long" ? "long" : "2-digit",
    year: "numeric",
    calendar: "buddhist",
  });
};

export const formatThaiDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "-";
  return `${formatThaiDate(d)} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`;
};

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const addMonths = (iso: string, months: number): string => {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (a: string, b: string): number =>
  Math.floor((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);

export const thaiIdMask = (id: string | null | undefined): string => {
  if (!id) return "-";
  const s = id.replace(/\D/g, "");
  if (s.length !== 13) return id;
  return `${s[0]}-${s.slice(1, 5)}-${s.slice(5, 10)}-${s.slice(10, 12)}-${s[12]}`;
};

export const isValidThaiId = (id: string): boolean => {
  const s = id.replace(/\D/g, "");
  if (s.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(s[i]!, 10) * (13 - i);
  return (11 - (sum % 11)) % 10 === parseInt(s[12]!, 10);
};
