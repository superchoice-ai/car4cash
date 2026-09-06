import { formatMoney, formatThaiDate } from "@/lib/format";
import "./ContractPromisPrint.css";

export type CompanyConfig = {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  tax_id?: string | null;
};

type ContractPrintData = {
  code: string;
  principal: number;
  interest_rate: number;
  term_months: number;
  installment_amount: number;
  total_payable?: number | null;
  start_date: string;
  first_due_date?: string | null;
  end_date?: string | null;
  customers?: {
    full_name?: string | null;
    national_id?: string | null;
    phone?: string | null;
    address?: string | null;
    district?: string | null;
    province?: string | null;
    postcode?: string | null;
    birth_date?: string | null;
  } | null;
  vehicles?: {
    plate_no?: string | null;
    plate_province?: string | null;
    brand?: string | null;
    model?: string | null;
    vehicle_type?: string | null;
    chassis_no?: string | null;
  } | null;
  branches?: {
    name?: string | null;
    address?: string | null;
  } | null;
};

export const FALLBACK_COMPANY: Required<Pick<CompanyConfig, "name" | "address">> = {
  name: "บริษัท SuperChoice AI แอสเซท จำกัด",
  address: "40/6 ถ.จุลจอมเกล้า ต.ท่าข้าม อ.พุนพิน จ.สุราษฎร์ธานี",
};

function ageFromBirthDate(value?: string | null) {
  if (!value) return "—";
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return String(Math.max(age, 0));
}

function thaiBahtText(satang: number) {
  const baht = Math.round((satang ?? 0) / 100);
  if (!Number.isFinite(baht) || baht < 0) return "";
  if (baht === 0) return "ศูนย์บาทถ้วน";
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const places = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
  const readUnderMillion = (n: number) => {
    if (n === 0) return "";
    const s = String(n).padStart(6, "0");
    let out = "";
    for (let i = 0; i < 6; i++) {
      const d = Number(s[i]);
      if (!d) continue;
      const pos = 5 - i;
      if (pos === 1 && d === 2) out += "ยี่";
      else if (pos === 1 && d === 1) out += "";
      else if (pos === 0 && d === 1 && out) out += "เอ็ด";
      else out += digits[d];
      out += places[pos];
    }
    return out;
  };
  const read = (n: number): string => {
    if (n < 1_000_000) return readUnderMillion(n);
    const high = Math.floor(n / 1_000_000);
    const low = n % 1_000_000;
    return `${read(high)}ล้าน${readUnderMillion(low)}`;
  };
  return `${read(baht)}บาทถ้วน`;
}

function Field({ children, min = "4rem" }: { children: React.ReactNode; min?: string }) {
  return <span className="contract-field" style={{ minWidth: min }}>{children || "—"}</span>;
}

export function ContractPromisPrint({ contract, company }: { contract: ContractPrintData; company?: CompanyConfig | null }) {
  const customer = contract.customers ?? {};
  const vehicle = contract.vehicles ?? {};
  const companyName = company?.name?.trim() || FALLBACK_COMPANY.name;
  const companyAddress = company?.address?.trim() || FALLBACK_COMPANY.address;
  const address = [customer.address, customer.district, customer.province, customer.postcode].filter(Boolean).join(" ") || "—";
  const carText = [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "—";
  const dueDay = contract.first_due_date ? new Date(`${contract.first_due_date}T00:00:00`).getDate() : "—";
  const contractPlace = contract.branches?.address?.trim() || "—";

  return (
    <article className="contract-print-sheet" aria-label={`สัญญากู้ยืมเงิน ${contract.code}`}>
      <header className="contract-heading">
        <div className="contract-no">เลขที่ <b>{contract.code}</b></div>
        <h1>สัญญากู้ยืมเงิน</h1>
        <p>ทำที่ {contractPlace}</p>
        <p>วันที่ <Field min="8rem">{formatThaiDate(contract.start_date, "long")}</Field></p>
      </header>

      <section className="contract-party">
        <p>สัญญาฉบับนี้ทำขึ้นระหว่าง นาย/นาง/นางสาว <Field min="14rem">{customer.full_name}</Field> อายุ <Field min="2.5rem">{ageFromBirthDate(customer.birth_date)}</Field> ปี เลขบัตรประจำตัวประชาชน <Field min="10rem">{customer.national_id}</Field> โทรศัพท์ <Field min="7rem">{customer.phone}</Field></p>
        <p>ที่อยู่ <Field min="25rem">{address}</Field> ซึ่งต่อไปในสัญญานี้เรียกว่า “ผู้กู้” ฝ่ายหนึ่ง กับ {companyName} สำนักงานตั้งอยู่เลขที่ {companyAddress} ซึ่งต่อไปในสัญญานี้เรียกว่า “ผู้ให้กู้” อีกฝ่ายหนึ่ง คู่สัญญาทั้งสองฝ่ายตกลงกันดังข้อความต่อไปนี้</p>
      </section>

      <section className="contract-clauses">
        <p><b>ข้อ 1.</b> ผู้กู้ตกลงกู้เงินของผู้ให้กู้ และรับเงินจำนวนดังกล่าวครบถ้วนแล้วนับแต่วันทำสัญญาฉบับนี้ เป็นจำนวนเงิน <Field min="7rem">{formatMoney(contract.principal)}</Field> บาท (<Field min="15rem">{thaiBahtText(contract.principal)}</Field>)</p>
        <p><b>ข้อ 2.</b> ผู้กู้ยอมให้ดอกเบี้ยตามอัตราที่กฎหมายกำหนด โดยอัตราตามสัญญานี้เท่ากับ <Field min="3rem">{Number(contract.interest_rate).toLocaleString("th-TH", { maximumFractionDigits: 4 })}</Field> ต่อเดือน ทั้งนี้ให้เป็นไปภายใต้กฎหมายที่ใช้บังคับ</p>
        <p><b>ข้อ 3.</b> ผู้กู้ตกลงผ่อนชำระเงินกู้เป็นรายเดือน จำนวน <Field min="2.5rem">{contract.term_months}</Field> เดือน ชำระงวดละ <Field min="6rem">{formatMoney(contract.installment_amount)}</Field> บาท งวดแรกครบกำหนดวันที่ <Field min="7rem">{formatThaiDate(contract.first_due_date, "long")}</Field> และชำระภายในวันที่ <Field min="2rem">{dueDay}</Field> ของทุกเดือน</p>
        <p><b>ข้อ 4.</b> ผู้กู้ตกลงชำระหนี้ตามสัญญานี้ให้ครบถ้วนทั้งเงินต้นและดอกเบี้ย ภายในวันที่ <Field min="7rem">{formatThaiDate(contract.end_date, "long")}</Field> เว้นแต่จะมีการชำระเสร็จก่อนกำหนดหรือมีข้อตกลงเป็นหนังสือเป็นอย่างอื่น</p>
        <p><b>ข้อ 5.</b> หากผู้กู้ผิดนัดชำระหนี้ตามกำหนด ผู้ให้กู้มีสิทธิเรียกให้ชำระเงินต้น ดอกเบี้ย และหนี้ที่ถึงกำหนดตามสัญญาได้ตามสิทธิและภายใต้อัตราที่กฎหมายกำหนด รวมถึงสิทธิเรียกค่าเสียหายอันเกิดจากการผิดนัดตามกฎหมาย</p>
        <p><b>ข้อ 6.</b> หากผู้กู้ผิดนัดหรือผิดข้อตกลงข้อใดข้อหนึ่ง ผู้กู้ยอมรับผิดชดใช้ค่าเสียหายและค่าใช้จ่ายที่จำเป็นและเกิดขึ้นจริงในการติดตามทวงถาม ตลอดจนค่าธรรมเนียม ค่าทนายความ และค่าใช้จ่ายในการดำเนินคดีเท่าที่กฎหมายอนุญาต</p>
        <p><b>ข้อ 7.</b> เพื่อเป็นหลักประกันการกู้ยืมเงิน ผู้กู้ตกลงมอบคู่มือจดทะเบียนรถ เลขทะเบียน <Field min="6rem">{vehicle.plate_no}</Field> จังหวัด <Field min="5rem">{vehicle.plate_province}</Field> รถ <Field min="8rem">{carText}</Field> เลขตัวถัง <Field min="7rem">{vehicle.chassis_no}</Field> พร้อมเอกสารที่เกี่ยวข้องไว้แก่ผู้ให้กู้ตามที่คู่สัญญาตกลง โดยค่าธรรมเนียมและภาษีให้เป็นไปตามกฎหมายและข้อตกลงที่ชอบด้วยกฎหมาย</p>
        <p><b>ข้อ 8.</b> หากผู้กู้ผิดนัดตามสัญญานี้ ผู้กู้ตกลงส่งมอบรถที่เป็นหลักประกันให้แก่ผู้ให้กู้ตามขั้นตอนและวิธีการที่กฎหมายอนุญาต เพื่อดำเนินการตามสิทธิของผู้ให้กู้ โดยการดำเนินการใด ๆ ต้องเป็นไปตามกฎหมายและไม่ตัดสิทธิของผู้กู้ตามกฎหมาย</p>
        <p><b>ข้อ 9.</b> ผู้กู้ตกลงไม่นำรถหรือเอกสารหลักประกันตามสัญญานี้ไปจำหน่าย จำนำ โอน หรือก่อภาระผูกพันแก่บุคคลอื่นในลักษณะที่กระทบสิทธิของผู้ให้กู้ เว้นแต่ได้รับความยินยอมเป็นหนังสือจากผู้ให้กู้ ทั้งนี้การใช้สิทธิของคู่สัญญาให้เป็นไปตามกฎหมาย</p>
        <p>เอกสารหรือการติดต่อเกี่ยวกับสัญญานี้ให้ส่งตามที่อยู่ที่ระบุไว้ในสัญญา หรือที่อยู่ล่าสุดซึ่งคู่สัญญาได้แจ้งเป็นหนังสือ คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญานี้โดยตลอดแล้ว จึงลงลายมือชื่อไว้เป็นหลักฐาน</p>
      </section>

      <section className="contract-summary">
        <div><span>เลขที่สัญญา</span><b>{contract.code}</b></div>
        <div><span>ทะเบียนรถ</span><b>{vehicle.plate_no ?? "—"}</b></div>
        <div><span>เงินต้น</span><b>฿{formatMoney(contract.principal)}</b></div>
        <div><span>ค่างวด</span><b>฿{formatMoney(contract.installment_amount)}</b></div>
      </section>

      <footer className="contract-signatures">
        <div><div className="signature-line" /><p>ลงชื่อ ........................................................ ผู้กู้</p><p>({customer.full_name ?? "........................................................"})</p></div>
        <div><div className="signature-line" /><p>ลงชื่อ ........................................................ ผู้ให้กู้</p><p>({companyName})</p></div>
        <div><div className="signature-line" /><p>ลงชื่อ ........................................................ พยาน</p><p>(........................................................)</p></div>
        <div><div className="signature-line" /><p>ลงชื่อ ........................................................ พยาน</p><p>(........................................................)</p></div>
      </footer>

      <div className="contract-footer-note">เอกสารสร้างจากระบบ · สาขา {contract.branches?.name ?? "—"} · สัญญา {contract.code}</div>
    </article>
  );
}
