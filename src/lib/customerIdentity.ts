import { supabase } from "@/integrations/supabase/client";

type DuplicateIdentityRow = {
  conflict_field: "national_id" | "phone";
  customer_id: string;
  customer_code: string;
  customer_name: string;
};

export function normalizeIdentityDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export async function assertCustomerIdentityAvailable(
  nationalId: string,
  phone: string,
  excludeCustomerId?: string,
) {
  const rpc = supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: DuplicateIdentityRow[] | null; error: { message: string } | null }>;

  const { data, error } = await rpc("check_customer_identity_duplicate", {
    _national_id: normalizeIdentityDigits(nationalId),
    _phone: normalizeIdentityDigits(phone),
    _exclude_customer_id: excludeCustomerId ?? null,
  });
  if (error) throw new Error(error.message);

  const conflict = data?.[0];
  if (!conflict) return;

  const field = conflict.conflict_field === "national_id" ? "เลขบัตรประชาชน" : "เบอร์โทรศัพท์";
  throw new Error(`${field}นี้มีในระบบแล้ว (${conflict.customer_code} · ${conflict.customer_name}) กรุณาแก้ข้อมูลที่กำลังกรอก หรือตรวจและแก้ข้อมูลลูกค้าเดิมผ่านขั้นตอนที่ระบบอนุญาต`);
}

export function customerDuplicateSaveMessage(message: string) {
  if (message.includes("customers_national_id_normalized_uidx")) return "เลขบัตรประชาชนนี้มีในระบบแล้ว กรุณาตรวจสอบลูกค้าเดิม";
  if (message.includes("customers_phone_normalized_uidx")) return "เบอร์โทรศัพท์นี้มีในระบบแล้ว กรุณาตรวจสอบลูกค้าเดิม";
  if (message.toLowerCase().includes("duplicate key") || message.includes("23505")) return "เลขบัตรประชาชนหรือเบอร์โทรศัพท์นี้มีในระบบแล้ว กรุณาตรวจสอบลูกค้าเดิม";
  return message;
}

