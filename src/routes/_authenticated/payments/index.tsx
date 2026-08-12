import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, Calculator } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { PageHeader, EmptyState } from "@/components/Common";
import { SearchableCombobox, StandardSearch, includesThaiSearch } from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatThaiDate, todayISO, toSatang, toBaht } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import type { CashCategory } from "@/lib/cashbook";

export const Route = createFileRoute("/_authenticated/payments/")({ component: PaymentsPage });
const FEE_FIELDS: { key: CashCategory; label: string }[] = [{ key: "insurance", label: "ค่าประกัน" }, { key: "registration", label: "ค่าทะเบียน" }, { key: "follow_up", label: "ค่าติดตาม" }];

function PaymentsPage() {
  const { profile, isHQ } = useAuth();
  const { branchId } = useBranchFilter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [contractId, setContractId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [principalPart, setPrincipalPart] = useState("");
  const [interestPart, setInterestPart] = useState("");
  const [penaltyPart, setPenaltyPart] = useState("");
  const [fees, setFees] = useState<Partial<Record<CashCategory, string>>>({});
  const [changeAmount, setChangeAmount] = useState("");

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments", branchId],
    queryFn: async () => {
      let q = supabase.from("payments").select("*, contracts:contract_id(code, customers:customer_id(full_name,national_id,phone,line_id)), branches:branch_id(name)").order("created_at", { ascending: false }).limit(300);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q; if (error) throw error; return data ?? [];
    },
  });

  const { data: activeContracts } = useQuery({
    queryKey: ["contracts-active", branchId],
    queryFn: async () => {
      let q = supabase.from("contracts").select("id, code, outstanding, installment_amount, customer_id, vehicles:vehicle_id(plate_no), customers:customer_id(full_name,national_id,phone,line_id)").in("status", ["active", "overdue"]).order("code");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q; return data ?? [];
    },
  });

  const { data: openInstallments } = useQuery({ queryKey: ["installments-open", contractId], enabled: !!contractId, queryFn: async () => { const { data, error } = await supabase.from("installments").select("*").eq("contract_id", contractId).neq("status", "paid").order("seq"); if (error) throw error; return data ?? []; } });

  const autoAllocate = () => {
    const amt = toSatang(amount || "0"); if (amt <= 0) return toast.error("กรุณากรอกจำนวนเงินตัดค่างวดก่อน");
    let remaining = amt, p = 0, i = 0;
    for (const ins of openInstallments ?? []) { if (remaining <= 0) break; const due = Number(ins.total_amount) - Number(ins.paid_amount); const applied = Math.min(remaining, due); remaining -= applied; const ratio = Number(ins.total_amount) > 0 ? applied / Number(ins.total_amount) : 0; p += Math.round(Number(ins.principal_amount) * ratio); i += Math.round(Number(ins.interest_amount) * ratio); }
    setPrincipalPart(String(toBaht(p))); setInterestPart(String(toBaht(i))); toast.success("คำนวณช่องเงินต้น/ดอกเบี้ยให้แล้ว");
  };

  const feeTotal = FEE_FIELDS.reduce((s, f) => s + toSatang(fees[f.key] || "0"), 0);
  const receiptTotal = toSatang(amount || "0") + feeTotal;
  const resetForm = () => { setAmount(""); setReference(""); setNote(""); setPrincipalPart(""); setInterestPart(""); setPenaltyPart(""); setFees({}); setChangeAmount(""); };

  const receive = useMutation({
    mutationFn: async () => {
      if (!profile?.branch_id) throw new Error("บัญชีของคุณยังไม่ได้สังกัดสาขา");
      if (!contractId) throw new Error("กรุณาเลือกสัญญา");
      const amt = toSatang(amount || "0"); if (amt <= 0) throw new Error("กรุณากรอกจำนวนเงิน");
      const { data: receiptNo, error: rErr } = await supabase.rpc("next_doc_no", { _branch: profile.branch_id, _doc_type: "RCP" }); if (rErr) throw rErr;
      const { data: installments, error: iErr } = await supabase.from("installments").select("*").eq("contract_id", contractId).neq("status", "paid").order("seq"); if (iErr) throw iErr;
      let remaining = amt, autoPrincipal = 0, autoInterest = 0; let firstInstallmentId: string | null = null;
      for (const ins of installments ?? []) { if (remaining <= 0) break; const due = ins.total_amount - ins.paid_amount; const applied = Math.min(remaining, due); remaining -= applied; if (!firstInstallmentId) firstInstallmentId = ins.id; const ratio = ins.total_amount > 0 ? applied / ins.total_amount : 0; autoPrincipal += Math.round(ins.principal_amount * ratio); autoInterest += Math.round(ins.interest_amount * ratio); const newPaid = ins.paid_amount + applied; const { error } = await supabase.from("installments").update({ paid_amount: newPaid, status: newPaid >= ins.total_amount ? "paid" : "partial", paid_date: newPaid >= ins.total_amount ? paidAt : null }).eq("id", ins.id); if (error) throw error; }
      const pPart = principalPart.trim() ? toSatang(principalPart) : autoPrincipal; const iPart = interestPart.trim() ? toSatang(interestPart) : autoInterest; const penPart = toSatang(penaltyPart || "0");
      const { data: created, error: pErr } = await supabase.from("payments").insert({ branch_id: profile.branch_id, receipt_no: receiptNo as string, contract_id: contractId, installment_id: firstInstallmentId, paid_at: paidAt, amount: amt, principal_part: pPart, interest_part: iPart, penalty_part: penPart, method, reference: reference || null, note: note || null, received_by: profile.id }).select("id").single(); if (pErr) throw pErr;
      const contract: any = (activeContracts ?? []).find((c: any) => c.id === contractId); const newOutstanding = Math.max(0, (contract?.outstanding ?? 0) - amt); const { error: cErr } = await supabase.from("contracts").update({ outstanding: newOutstanding, status: newOutstanding === 0 ? "closed" : "active" }).eq("id", contractId); if (cErr) throw cErr;
      const lines = [{ category: "principal" as CashCategory, amount: pPart }, { category: "interest" as CashCategory, amount: iPart }, { category: "penalty" as CashCategory, amount: penPart }, ...FEE_FIELDS.map((f) => ({ category: f.key, amount: toSatang(fees[f.key] || "0") }))].filter((l) => l.amount > 0);
      const total = amt + feeTotal;
      const { data: entry, error: eErr } = await supabase.from("cash_entries").insert({ branch_id: profile.branch_id, direction: "income", doc_no: receiptNo as string, entry_date: paidAt, party_name: contract?.customers?.full_name ?? "", customer_id: contract?.customer_id ?? null, contract_id: contractId, payment_id: created.id, method, total_amount: total, change_amount: toSatang(changeAmount || "0"), note: note || null, created_by: profile.id }).select("id").single(); if (eErr) throw eErr;
      if (lines.length) { const { error: lErr } = await supabase.from("cash_entry_lines").insert(lines.map((l) => ({ entry_id: entry.id, branch_id: profile.branch_id!, direction: "income" as const, category: l.category, amount: l.amount }))); if (lErr) throw lErr; }
    },
    onSuccess: () => { toast.success("บันทึกการรับชำระเรียบร้อย"); setOpen(false); resetForm(); void qc.invalidateQueries(); }, onError: (e: Error) => toast.error(e.message),
  });

  const selected: any = (activeContracts ?? []).find((c: any) => c.id === contractId);
  const contractOptions = (activeContracts ?? []).map((c: any) => ({ value: c.id, label: `${c.code} — ${c.customers?.full_name} — คงค้าง ฿${formatMoney(c.outstanding)}`, keywords: [c.code, c.customers?.full_name, c.customers?.national_id, c.customers?.phone, c.customers?.line_id, c.vehicles?.plate_no] }));
  const filtered = (payments ?? []).filter((p: any) => includesThaiSearch(search, [p.receipt_no, p.contracts?.code, p.contracts?.customers?.full_name, p.contracts?.customers?.national_id, p.contracts?.customers?.phone, p.contracts?.customers?.line_id, p.reference, p.branches?.name, PAYMENT_METHOD_LABEL[p.method]]));

  return <div>
    <PageHeader title="รับชำระเงิน" description="บันทึกค่างวด ตัดยอด และลงสมุดรายรับอัตโนมัติ" actions={<Button onClick={() => setOpen(true)}><Receipt className="size-4" /> รับชำระใหม่</Button>} />
    <Card className="mb-4"><CardContent className="p-4"><StandardSearch value={search} onChange={setSearch} placeholder="ค้นหาใบเสร็จ / สัญญา / ชื่อไทย / เลขบัตร / โทร / LINEID / อ้างอิง / สาขา" /></CardContent></Card>
    <Card><CardContent className="p-0">{isLoading ? <div className="p-6">กำลังโหลด...</div> : filtered.length === 0 ? <div className="p-6"><EmptyState title="ไม่พบรายการรับชำระ" /></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>เลขที่ใบเสร็จ</TableHead><TableHead>สัญญา</TableHead><TableHead>ลูกค้า</TableHead><TableHead>วันที่ชำระ</TableHead><TableHead>ช่องทาง</TableHead>{isHQ && <TableHead>สาขา</TableHead>}<TableHead className="text-right">เงินต้น</TableHead><TableHead className="text-right">ดอกเบี้ย</TableHead><TableHead className="text-right">จำนวนเงิน</TableHead></TableRow></TableHeader><TableBody>{filtered.map((p: any) => <TableRow key={p.id} className={p.voided ? "opacity-50 line-through" : ""}><TableCell className="font-medium">{p.receipt_no}</TableCell><TableCell>{p.contracts?.code ?? "-"}</TableCell><TableCell>{p.contracts?.customers?.full_name ?? "-"}</TableCell><TableCell>{formatThaiDate(p.paid_at)}</TableCell><TableCell>{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</TableCell>{isHQ && <TableCell>{p.branches?.name ?? "-"}</TableCell>}<TableCell className="text-right">{formatMoney(p.principal_part)}</TableCell><TableCell className="text-right">{formatMoney(p.interest_part)}</TableCell><TableCell className="text-right font-medium">฿{formatMoney(p.amount)}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>บันทึกการรับชำระ</DialogTitle><DialogDescription>พิมพ์ชื่อไทยหรือข้อมูลบางส่วนเพื่อค้นหาสัญญา</DialogDescription></DialogHeader><div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1"><div><Label>สัญญา *</Label><SearchableCombobox value={contractId} onValueChange={setContractId} options={contractOptions} placeholder="ค้นหา/เลือกสัญญา" searchPlaceholder="เลขสัญญา / ชื่อ / เลขบัตร / โทร / LINEID / ทะเบียน" />{selected && <p className="mt-1 text-xs text-muted-foreground">ค่างวด ฿{formatMoney(selected.installment_amount)} · คงค้าง ฿{formatMoney(selected.outstanding)}</p>}</div><div className="grid gap-3 sm:grid-cols-2"><div><Label>จำนวนเงิน *</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div><div><Label>วันที่ชำระ</Label><Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div></div><div className="rounded-md border p-3"><div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium">แยกช่องรายรับ</p><Button type="button" variant="outline" size="sm" onClick={autoAllocate}><Calculator className="size-4" /> คำนวณ</Button></div><div className="grid gap-3 sm:grid-cols-3"><div><Label className="text-xs">เงินต้น</Label><Input type="number" value={principalPart} onChange={(e) => setPrincipalPart(e.target.value)} /></div><div><Label className="text-xs">ดอกเบี้ย</Label><Input type="number" value={interestPart} onChange={(e) => setInterestPart(e.target.value)} /></div><div><Label className="text-xs">ค่าปรับ</Label><Input type="number" value={penaltyPart} onChange={(e) => setPenaltyPart(e.target.value)} /></div>{FEE_FIELDS.map((f) => <div key={f.key}><Label className="text-xs">{f.label}</Label><Input type="number" value={fees[f.key] ?? ""} onChange={(e) => setFees((s) => ({...s,[f.key]:e.target.value}))} /></div>)}<div><Label className="text-xs">เงินทอน</Label><Input type="number" value={changeAmount} onChange={(e) => setChangeAmount(e.target.value)} /></div></div><p className="mt-3 text-right text-sm font-bold">รวมรับ ฿{formatMoney(receiptTotal)}</p></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>ช่องทาง</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PAYMENT_METHOD_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div><div><Label>เลขที่อ้างอิง</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div></div><div><Label>หมายเหตุ</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button><Button onClick={() => receive.mutate()} disabled={receive.isPending}>บันทึกและออกใบเสร็จ</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
