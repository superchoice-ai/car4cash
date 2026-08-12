import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "ผู้ดูแลระบบ (สนง.ใหญ่)",
  manager: "ผู้จัดการสาขา",
  approver: "ผู้อนุมัติ",
  staff: "พนักงาน",
  viewer: "ผู้ดูข้อมูล",
};

export const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  active: "ปกติ",
  inactive: "ไม่ใช้งาน",
  blacklist: "ลูกค้าไม่พึงประสงค์",
};

export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  draft: "ร่าง",
  submitted: "ยื่นคำขอ",
  pending_approval: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
  contracted: "ทำสัญญาแล้ว",
};

export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  active: "ปกติ",
  closed: "ปิดบัญชี",
  overdue: "ค้างชำระ",
  defaulted: "หนี้เสีย",
  cancelled: "ยกเลิก",
};

export const INSTALLMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: "ยังไม่ชำระ",
  partial: "ชำระบางส่วน",
  paid: "ชำระแล้ว",
  overdue: "เกินกำหนด",
  waived: "ยกเว้น",
};

export const APPROVAL_TYPE_LABEL: Record<string, string> = {
  delete_record: "ขอเปลี่ยนสถานะ/ยกเลิกข้อมูล",
  loan_approval: "ขออนุมัติสินเชื่อ",
  contract_cancel: "ขอยกเลิกสัญญา",
  restructure: "ขอปรับโครงสร้างหนี้",
  payment_void: "ขอยกเลิกใบเสร็จ",
  other: "ขอแก้ไขข้อมูล",
};

export const APPROVAL_STATUS_LABEL: Record<string, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติ",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
};

export const BOOK_STATUS_LABEL: Record<string, string> = {
  pending: "รอรับเล่ม",
  received: "รับเล่มแล้ว",
  returned: "คืนเล่มแล้ว",
  seized: "ยึดรถ",
};

export const VEHICLE_TYPE_LABEL: Record<string, string> = {
  car: "รถยนต์",
  motorcycle: "รถจักรยานยนต์",
  truck: "รถบรรทุก",
  other: "อื่นๆ",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "เงินสด",
  transfer: "โอนเงิน",
  cheque: "เช็ค",
  promptpay: "พร้อมเพย์",
};

export const COLLECTION_CHANNEL_LABEL: Record<string, string> = {
  phone: "โทรศัพท์",
  line: "LINE",
  visit: "ลงพื้นที่",
  letter: "จดหมาย",
  sms: "SMS",
};

export const EVENT_LABEL: Record<string, string> = {
  approval_requested: "มีคำขออนุมัติใหม่",
  approval_decided: "ผลการอนุมัติ",
  loan_approved: "อนุมัติวงเงินลูกค้า",
  payment_due: "ครบกำหนดชำระ",
  overdue: "ค้างชำระ",
  backup_result: "ผลการสำรองข้อมูล",
  maintenance: "ระบบปิดปรับปรุง",
  payment_received: "รับชำระเงิน",
  contract_created: "สร้างสัญญาใหม่",
};
