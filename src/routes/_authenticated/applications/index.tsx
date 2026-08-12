import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Search, Pencil, Trash2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { PageHeader, EmptyState, StatusPill } from "@/components/Common";
import { SearchableCombobox, StandardSearch, includesThaiSearch } from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatThaiDate, toSatang, toBaht } from "@/lib/format";
import { APPLICATION_STATUS_LABEL, VEHICLE_TYPE_LABEL } from "@/lib/labels";
import { FALLBACK_DEFAULTS, buildSchedule, maxLoanByLtv } from "@/lib/loan";

export const Route = createFileRoute("/_authenticated/applications/")({ component: ApplicationsPage });

function ApplicationsPage() {
  const { profile, isHQ } = useAuth();
  const { branchId } = useBranchFilter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [historyQuery, setHistoryQuery] = useState("");
  const [editingApp, setEditingApp] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ requested_amount: "", approved_amount: "", interest_rate: "", term_months: "", purpose: "", document_no: "" });

  const { data: apps, isLoading } = useQuery({
    queryKey: ["applications", branchId],
    queryFn: async () => {
      let q = supabase.from("loan_applications")
        .select("*, customers:customer_id(code, full_name, national_id, phone, line_id), vehicles:vehicle_id(plate_no, brand, model, appraised_value, registration_due_date), branches:branch_id(name)")
        .order("created_at", { ascending: false }).limit(300);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-lite", branchId],
    queryFn: async () => {
      let q = supabase.from("customers").select("id, code, full_name, national_id, phone, line_id").eq("status", "active").order("full_name");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: history } = useQuery({
    queryKey: ["global-customer-history", historyQuery], enabled: historyQuery.trim().length >= 2,
    queryFn: async () => {
      const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: any[] | null; error: { message: string } | null }>;
      const { data, error } = await rpc("global_customer_history_search", { _q: historyQuery });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const [form, setForm] = useState({ customer_id: "", vehicle_type: "car", brand: "", model: "", year: "", plate_no: "", plate_province: "สุราษฎร์ธานี", chassis_no: "", appraised_value: "", requested_amount: "", term_months: "12", interest_rate: String(FALLBACK_DEFAULTS.interest_rate), purpose: "", registration_due_date: "", guarantor_name: "", document_no: "" });

  const { data: selectedCustomerBalance = 0 } = useQuery({
    queryKey: ["customer-current-balance", form.customer_id], enabled: !!form.customer_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("outstanding").eq("customer_id", form.customer_id).in("status", ["active", "overdue", "defaulted"]);
      if (error) throw error;
      return (data ?? []).reduce((sum, c) => sum + Number(c.outstanding ?? 0), 0);
    },
  });

  const { data: editHasPayments = false } = useQuery({
    queryKey: ["application-payment-lock", editingApp?.id], enabled: !!editingApp?.id,
    queryFn: async () => {
      const { data: contracts, error: cErr } = await supabase.from("contracts").select("id").eq("application_id", editingApp.id);
      if (cErr) throw cErr;
      const ids = (contracts ?? []).map((c) => c.id);
      if (!ids.length) return false;
      const { count, error } = await supabase.from("payments").select("id", { count: "exact", head: true }).in("contract_id", ids).eq("voided", false);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  const preview = useMemo(() => {
    const principal = toSatang(form.requested_amount || "0"); if (!principal) return null;
    return buildSchedule({ principal, interestRate: parseFloat(form.interest_rate) || 0, termMonths: parseInt(form.term_months, 10) || 12 }, new Date().toISOString().slice(0, 10));
  }, [form.requested_amount, form.interest_rate, form.term_months]);
  const ltvCap = useMemo(() => maxLoanByLtv(toSatang(form.appraised_value || "0"), form.vehicle_type === "motorcycle" ? FALLBACK_DEFAULTS.ltv_motorcycle : FALLBACK_DEFAULTS.ltv_car), [form.appraised_value, form.vehicle_type]);

  const createApp = useMutation({
    mutationFn: async () => {
      if (!profile?.branch_id) throw new Error("บัญชีของคุณยังไม่ได้สังกัดสาขา");
      if (!form.customer_id) throw new Error("กรุณาเลือกลูกค้า");
      if (!form.plate_no.trim()) throw new Error("กรุณากรอกทะเบียนรถ");
      const requested = toSatang(form.requested_amount || "0"); if (requested <= 0) throw new Error("กรุณากรอกวงเงินที่ขอ");
      if (ltvCap > 0 && requested > ltvCap) throw new Error(`วงเงินเกินเพดาน LTV (สูงสุด ฿${formatMoney(ltvCap)})`);
      const { data: vehicle, error: vErr } = await supabase.from("vehicles").insert({ branch_id: profile.branch_id, customer_id: form.customer_id, vehicle_type: form.vehicle_type, brand: form.brand || null, model: form.model || null, year: form.year ? parseInt(form.year, 10) : null, plate_no: form.plate_no.trim(), plate_province: form.plate_province || null, chassis_no: form.chassis_no || null, appraised_value: toSatang(form.appraised_value || "0"), registration_due_date: form.registration_due_date || null } as never).select("id").single();
      if (vErr) throw vErr;
      const { data: code, error: cErr } = await supabase.rpc("next_doc_no", { _branch: profile.branch_id, _doc_type: "APP" }); if (cErr) throw cErr;
      const { data: app, error } = await supabase.from("loan_applications").insert({ branch_id: profile.branch_id, code: code as string, customer_id: form.customer_id, vehicle_id: vehicle.id, requested_amount: requested, interest_rate: parseFloat(form.interest_rate), term_months: parseInt(form.term_months, 10), fee_amount: Math.round((requested * FALLBACK_DEFAULTS.fee_percent) / 100), purpose: form.purpose || null, status: "submitted", created_by: profile.id, document_no: form.document_no || null } as never).select("id").single();
      if (error) throw error;
      if (form.guarantor_name.trim()) { const { error: gErr } = await supabase.from("loan_guarantors").insert({ branch_id: profile.branch_id, application_id: app.id, full_name: form.guarantor_name.trim() } as never); if (gErr) throw gErr; }
    },
    onSuccess: () => { toast.success("บันทึกคำขอสินเชื่อเรียบร้อย"); setOpen(false); setConfirmOpen(false); void qc.invalidateQueries(); }, onError: (e: Error) => toast.error(e.message),
  });

  const submitApproval = useMutation({ mutationFn: async (app: any) => { const { error: uErr } = await supabase.from("loan_applications").update({ status: "pending_approval" }).eq("id", app.id); if (uErr) throw uErr; const { error } = await supabase.from("approval_requests").insert({ branch_id: app.branch_id, type: "loan_approval", entity_table: "loan_applications", entity_id: app.id, entity_label: app.code, reason: `ขออนุมัติวงเงิน ฿${formatMoney(app.requested_amount)}`, requested_by: profile?.id ?? null }); if (error) throw error; }, onSuccess: () => { toast.success("ส่งเรื่องขออนุมัติแล้ว"); void qc.invalidateQueries(); }, onError: (e: Error) => toast.error(e.message) });

  const requestException = useMutation({
    mutationFn: async ({ app, operation, changes }: { app: any; operation: "edit" | "cancel"; changes?: Record<string, unknown> }) => {
      const { error } = await supabase.from("approval_requests").insert({ branch_id: app.branch_id, type: operation === "cancel" ? "delete_record" : "other", entity_table: "loan_applications", entity_id: app.id, entity_label: app.code, reason: operation === "cancel" ? "ขอยกเลิกคำขอสินเชื่อ (ตรวจสอบบัญชีปิดก่อนดำเนินการ)" : "ขอแก้ไขคำขอสินเชื่อกรณีพิเศษ", payload: { operation, changes: changes ?? {} }, requested_by: profile?.id ?? null } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("ส่งคำขอไปยังผู้อนุมัติแล้ว"); setEditingApp(null); void qc.invalidateQueries(); }, onError: (e: Error) => toast.error(e.message),
  });

  const beginEdit = (app: any) => { setEditingApp(app); setEditForm({ requested_amount: String(toBaht(app.requested_amount ?? 0)), approved_amount: app.approved_amount != null ? String(toBaht(app.approved_amount)) : "", interest_rate: String(app.interest_rate ?? ""), term_months: String(app.term_months ?? ""), purpose: app.purpose ?? "", document_no: app.document_no ?? "" }); };
  const submitEditRequest = () => { if (!editingApp) return; const changes: Record<string, unknown> = { purpose: editForm.purpose, document_no: editForm.document_no }; if (!editHasPayments) { changes.requested_amount = toSatang(editForm.requested_amount || "0"); changes.approved_amount = editForm.approved_amount ? toSatang(editForm.approved_amount) : null; changes.interest_rate = Number(editForm.interest_rate); changes.term_months = Number(editForm.term_months); } requestException.mutate({ app: editingApp, operation: "edit", changes }); };

  const filtered = (apps ?? []).filter((a: any) => (statusFilter === "all" || a.status === statusFilter) && includesThaiSearch(search, [a.code, a.customers?.full_name, a.customers?.national_id, a.customers?.phone, a.customers?.line_id, a.vehicles?.plate_no, a.vehicles?.brand, a.vehicles?.model, a.document_no, a.branches?.name, APPLICATION_STATUS_LABEL[a.status]]));
  const customerOptions = (customers ?? []).map((c: any) => ({ value: c.id, label: `${c.code} — ${c.full_name}`, keywords: [c.full_name, c.national_id, c.phone, c.line_id] }));

  return <div>
    <PageHeader title="คำขอสินเชื่อ" description="ยื่นคำขอ ประเมินรถ และติดตามผลการอนุมัติ" actions={<Button onClick={() => setOpen(true)}><Plus className="size-4" /> สร้างคำขอใหม่</Button>} />
    <Card className="mb-4"><CardContent className="flex flex-wrap gap-3 p-4"><StandardSearch value={search} onChange={setSearch} placeholder="ค้นหาชื่อ / เลขคำขอ / เลขบัตร / โทร / LINEID / ทะเบียน / Document No." /><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">ทุกสถานะ</SelectItem>{Object.entries(APPLICATION_STATUS_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></CardContent></Card>
    <Card><CardContent className="p-0">{isLoading ? <div className="p-6">กำลังโหลด...</div> : filtered.length === 0 ? <div className="p-6"><EmptyState title="ไม่พบคำขอสินเชื่อ" /></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>เลขที่คำขอ</TableHead><TableHead>ลูกค้า</TableHead><TableHead>รถ</TableHead><TableHead className="text-right">วงเงิน</TableHead><TableHead>งวด</TableHead>{isHQ && <TableHead>สาขา</TableHead>}<TableHead>สถานะ</TableHead><TableHead>วันที่</TableHead><TableHead className="text-right">จัดการ</TableHead></TableRow></TableHeader><TableBody>{filtered.map((a: any) => <TableRow key={a.id}><TableCell className="font-medium">{a.code}</TableCell><TableCell>{a.customers?.full_name ?? "-"}</TableCell><TableCell>{a.vehicles?.plate_no} · {a.vehicles?.brand} {a.vehicles?.model}</TableCell><TableCell className="text-right">฿{formatMoney(a.requested_amount)}</TableCell><TableCell>{a.term_months} ด.</TableCell>{isHQ && <TableCell>{a.branches?.name ?? "-"}</TableCell>}<TableCell><StatusPill status={a.status} label={APPLICATION_STATUS_LABEL[a.status] ?? a.status} /></TableCell><TableCell>{formatThaiDate(a.created_at)}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-1">{a.status === "submitted" && <Button size="sm" variant="outline" onClick={() => submitApproval.mutate(a)}><Send className="size-3.5" /> ขออนุมัติ</Button>}<Button size="icon" variant="ghost" title="ขอแก้ไข" onClick={() => beginEdit(a)}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" title="ขอยกเลิก" onClick={() => requestException.mutate({ app: a, operation: "cancel" })}><Trash2 className="size-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>สร้างคำขอสินเชื่อ</DialogTitle><DialogDescription>ช่องค้นหาลูกค้ารองรับภาษาไทยและข้อมูลบางส่วน</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-2"><Label>ลูกค้า *</Label><SearchableCombobox value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })} options={customerOptions} placeholder="ค้นหา/เลือกลูกค้า" searchPlaceholder="พิมพ์ชื่อ รหัส เลขบัตร โทร หรือ LINEID" /></div><div><Label>ยอดคงเหลือปัจจุบัน</Label><Input value={`฿${formatMoney(selectedCustomerBalance)}`} readOnly className="bg-muted" /></div>
      <div><Label>ประเภทรถ</Label><Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(VEHICLE_TYPE_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div><div><Label>ยี่ห้อ</Label><Input value={form.brand} onChange={(e) => setForm({...form,brand:e.target.value})} /></div><div><Label>รุ่น</Label><Input value={form.model} onChange={(e) => setForm({...form,model:e.target.value})} /></div><div><Label>ปีจดทะเบียน</Label><Input type="number" value={form.year} onChange={(e) => setForm({...form,year:e.target.value})} /></div><div><Label>ทะเบียนรถ *</Label><Input value={form.plate_no} onChange={(e) => setForm({...form,plate_no:e.target.value})} /></div><div><Label>จังหวัดทะเบียน</Label><Input value={form.plate_province} onChange={(e) => setForm({...form,plate_province:e.target.value})} /></div><div><Label>เลขตัวถัง</Label><Input value={form.chassis_no} onChange={(e) => setForm({...form,chassis_no:e.target.value})} /></div>
      <div><Label>วันที่ครบกำหนดต่อทะเบียน</Label><Input type="date" value={form.registration_due_date} onChange={(e) => setForm({...form,registration_due_date:e.target.value})} /></div><div><Label>ชื่อ-สกุลผู้ค้ำประกัน</Label><Input value={form.guarantor_name} onChange={(e) => setForm({...form,guarantor_name:e.target.value})} /></div><div><Label>เลขที่ใบกำกับ (Document No.)</Label><Input value={form.document_no} onChange={(e) => setForm({...form,document_no:e.target.value})} /></div>
      <div><Label>ราคาประเมิน</Label><Input type="number" value={form.appraised_value} onChange={(e) => setForm({...form,appraised_value:e.target.value})} />{ltvCap>0 && <p className="text-xs text-muted-foreground">LTV สูงสุด ฿{formatMoney(ltvCap)}</p>}</div><div><Label>วงเงินที่ขอ *</Label><Input type="number" value={form.requested_amount} onChange={(e) => setForm({...form,requested_amount:e.target.value})} /></div><div><Label>จำนวนงวด</Label><Select value={form.term_months} onValueChange={(v) => setForm({...form,term_months:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FALLBACK_DEFAULTS.terms.map((t) => <SelectItem key={t} value={String(t)}>{t} เดือน</SelectItem>)}</SelectContent></Select></div><div><Label>ดอกเบี้ย (%/เดือน)</Label><Input type="number" step="0.01" value={form.interest_rate} onChange={(e) => setForm({...form,interest_rate:e.target.value})} /></div><div className="sm:col-span-2"><Label>วัตถุประสงค์</Label><Textarea value={form.purpose} onChange={(e) => setForm({...form,purpose:e.target.value})} rows={2} /></div>
    </div>{preview && <div className="rounded-lg bg-muted/60 p-3 text-sm">ค่างวดประมาณ ฿{formatMoney(preview.installment)} · ยอดชำระรวม ฿{formatMoney(preview.totalPayable)}</div>}
    <div className="rounded-lg border p-3"><div className="mb-2 flex items-center gap-2 font-medium"><Search className="size-4" /> ตรวจประวัติทุกสาขา</div><Input value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} placeholder="ชื่อ / เลขบัตร / เบอร์โทร / LINEID" />{historyQuery.trim().length>=2 && <div className="mt-2 max-h-36 overflow-auto text-xs">{(history??[]).length===0 ? <p className="text-muted-foreground">ไม่พบประวัติ</p> : (history??[]).map((h:any,i:number) => <div key={`${h.reference_no}-${i}`} className="border-b py-1">{h.full_name} · {h.history_type === "guarantor" ? "ผู้ค้ำประกัน" : "ผู้กู้"} · {h.reference_no} · {h.branch_name}</div>)}</div>}</div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button><Button onClick={() => setConfirmOpen(true)}>ตรวจสอบก่อนบันทึก</Button></DialogFooter></DialogContent></Dialog>

    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>ยืนยันการบันทึกคำขอใหม่</AlertDialogTitle><AlertDialogDescription>ตรวจสอบข้อมูลให้ถูกต้อง หากยืนยันจะไม่สามารถแก้ไขหรือลบได้ การแก้ไขกรณีพิเศษภายหลังต้องผ่าน workflow ผู้อนุมัติ</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>กลับไปตรวจสอบ</AlertDialogCancel><AlertDialogAction onClick={() => createApp.mutate()}>ยืนยันและบันทึก</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

    <Dialog open={!!editingApp} onOpenChange={(v) => !v && setEditingApp(null)}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>ขอแก้ไขคำขอสินเชื่อ {editingApp?.code}</DialogTitle><DialogDescription>รายการแก้ไขจะถูกส่งให้ผู้อนุมัติ ไม่แก้ฐานข้อมูลทันที</DialogDescription></DialogHeader>{editHasPayments && <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"><LockKeyhole className="mt-0.5 size-4" /><span>มีการชำระแล้วอย่างน้อย 1 งวด: ล็อกวงเงินต้น/วงเงินอนุมัติ ดอกเบี้ย และจำนวนงวด แก้ไขได้เฉพาะข้อมูลอื่น</span></div>}<div className="grid gap-3 sm:grid-cols-2"><div><Label>วงเงินที่ขอ (บาท)</Label><Input type="number" value={editForm.requested_amount} disabled={editHasPayments} onChange={(e) => setEditForm({...editForm,requested_amount:e.target.value})} /></div><div><Label>วงเงินอนุมัติ (บาท)</Label><Input type="number" value={editForm.approved_amount} disabled={editHasPayments} onChange={(e) => setEditForm({...editForm,approved_amount:e.target.value})} /></div><div><Label>ดอกเบี้ย (%/เดือน)</Label><Input type="number" value={editForm.interest_rate} disabled={editHasPayments} onChange={(e) => setEditForm({...editForm,interest_rate:e.target.value})} /></div><div><Label>จำนวนงวด</Label><Input type="number" value={editForm.term_months} disabled={editHasPayments} onChange={(e) => setEditForm({...editForm,term_months:e.target.value})} /></div><div><Label>Document No.</Label><Input value={editForm.document_no} onChange={(e) => setEditForm({...editForm,document_no:e.target.value})} /></div><div className="sm:col-span-2"><Label>วัตถุประสงค์</Label><Textarea value={editForm.purpose} onChange={(e) => setEditForm({...editForm,purpose:e.target.value})} /></div></div><DialogFooter><Button variant="outline" onClick={() => setEditingApp(null)}>ยกเลิก</Button><Button onClick={submitEditRequest}>ส่งขออนุมัติแก้ไข</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
