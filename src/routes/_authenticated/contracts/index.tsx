import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FilePlus2, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { PageHeader, EmptyState, StatusPill } from "@/components/Common";
import { ContractPromisPrint } from "@/components/ContractPromisPrint";
import { SearchableCombobox, StandardSearch, includesThaiSearch } from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatThaiDate, todayISO, addMonths } from "@/lib/format";
import { CONTRACT_STATUS_LABEL } from "@/lib/labels";
import { buildSchedule } from "@/lib/loan";

export const Route = createFileRoute("/_authenticated/contracts/")({ component: ContractsPage });

function ContractsPage() {
  const { profile, isHQ } = useAuth();
  const { branchId } = useBranchFilter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [previewContract, setPreviewContract] = useState<any | null>(null);
  const [printContractRecord, setPrintContractRecord] = useState<any | null>(null);
  const [appId, setAppId] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [firstDue, setFirstDue] = useState(addMonths(todayISO(), 1));

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts", branchId],
    queryFn: async () => {
      let q = supabase
        .from("contracts")
        .select("*, customers:customer_id(full_name,national_id,phone,line_id,address,district,province,postcode,birth_date), vehicles:vehicle_id(plate_no,plate_province,brand,model,vehicle_type,chassis_no), branches:branch_id(name,address)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: approvedApps } = useQuery({
    queryKey: ["approved-apps", branchId],
    queryFn: async () => {
      let q = supabase
        .from("loan_applications")
        .select("id, code, customer_id, vehicle_id, approved_amount, requested_amount, interest_rate, term_months, fee_amount, document_no, customers:customer_id(full_name,national_id,phone,line_id)")
        .eq("status", "approved");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const createContract = useMutation({
    mutationFn: async () => {
      if (!profile?.branch_id) throw new Error("บัญชีของคุณยังไม่ได้สังกัดสาขา");
      const app: any = (approvedApps ?? []).find((a: any) => a.id === appId);
      if (!app) throw new Error("กรุณาเลือกคำขอที่อนุมัติแล้ว");
      const principal = app.approved_amount ?? app.requested_amount;
      const summary = buildSchedule({ principal, interestRate: Number(app.interest_rate), termMonths: app.term_months }, firstDue);
      const { data: code, error: cErr } = await supabase.rpc("next_doc_no", { _branch: profile.branch_id, _doc_type: "CTR" });
      if (cErr) throw cErr;
      const lastDue = summary.schedule[summary.schedule.length - 1]!.dueDate;
      const { data: contract, error } = await supabase
        .from("contracts")
        .insert({ branch_id: profile.branch_id, code: code as string, application_id: app.id, customer_id: app.customer_id, vehicle_id: app.vehicle_id, principal, interest_rate: Number(app.interest_rate), term_months: app.term_months, installment_amount: summary.installment, total_payable: summary.totalPayable, outstanding: summary.totalPayable, fee_amount: app.fee_amount ?? 0, start_date: startDate, first_due_date: firstDue, end_date: lastDue, created_by: profile.id })
        .select("id")
        .single();
      if (error) throw error;
      const { error: iErr } = await supabase.from("installments").insert(summary.schedule.map((s) => ({ branch_id: profile.branch_id!, contract_id: contract.id, seq: s.seq, due_date: s.dueDate, principal_amount: s.principalAmount, interest_amount: s.interestAmount, total_amount: s.totalAmount })));
      if (iErr) throw iErr;
      const { error: dErr } = await supabase.from("disbursements").insert({ branch_id: profile.branch_id, contract_id: contract.id, paid_at: startDate, amount: principal - (app.fee_amount ?? 0), method: "transfer", paid_by: profile.id });
      if (dErr) throw dErr;
      await supabase.from("loan_applications").update({ status: "contracted" }).eq("id", app.id);
      await supabase.from("vehicles").update({ book_status: "received" }).eq("id", app.vehicle_id!);
    },
    onSuccess: () => { toast.success("สร้างสัญญาและตารางผ่อนชำระเรียบร้อย"); setOpen(false); setAppId(""); void qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!printContractRecord) return;
    document.body.classList.add("printing-contract");
    const cleanup = () => {
      document.body.classList.remove("printing-contract");
      setPrintContractRecord(null);
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    const timer = window.setTimeout(() => window.print(), 80);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", cleanup);
      document.body.classList.remove("printing-contract");
    };
  }, [printContractRecord]);

  const filtered = (contracts ?? []).filter((c: any) =>
    (statusFilter === "all" || c.status === statusFilter) &&
    includesThaiSearch(search, [c.code, c.customers?.full_name, c.customers?.national_id, c.customers?.phone, c.customers?.line_id, c.vehicles?.plate_no, c.branches?.name, c.status, CONTRACT_STATUS_LABEL[c.status]])
  );
  const appOptions = (approvedApps ?? []).map((a: any) => ({ value: a.id, label: `${a.code} — ${a.customers?.full_name} — ฿${formatMoney(a.approved_amount ?? a.requested_amount)}`, keywords: [a.code, a.customers?.full_name, a.customers?.national_id, a.customers?.phone, a.customers?.line_id, a.document_no] }));

  return <div>
    <PageHeader title="สัญญาสินเชื่อ" description="จัดทำสัญญาจากคำขอที่อนุมัติ พร้อมตารางผ่อนชำระอัตโนมัติ" actions={<Button onClick={() => setOpen(true)}><FilePlus2 className="size-4" /> ทำสัญญาใหม่</Button>} />

    <Card className="mb-4"><CardContent className="flex flex-wrap gap-3 p-4">
      <StandardSearch value={search} onChange={setSearch} placeholder="ค้นหาเลขสัญญา / ชื่อไทย / เลขบัตร / โทร / LINEID / ทะเบียน / สาขา" />
      <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">ทุกสถานะ</SelectItem>{Object.entries(CONTRACT_STATUS_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
    </CardContent></Card>

    <Card><CardContent className="p-0">{isLoading ? <div className="p-6">กำลังโหลด...</div> : filtered.length === 0 ? <div className="p-6"><EmptyState title="ไม่พบสัญญา" /></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>เลขที่สัญญา</TableHead><TableHead>ลูกค้า</TableHead><TableHead>ทะเบียนรถ</TableHead><TableHead className="text-right">เงินต้น</TableHead><TableHead className="text-right">ค่างวด</TableHead><TableHead className="text-right">คงค้าง</TableHead>{isHQ && <TableHead>สาขา</TableHead>}<TableHead>เริ่มสัญญา</TableHead><TableHead>สถานะ</TableHead><TableHead className="text-right">จัดการ</TableHead></TableRow></TableHeader><TableBody>{filtered.map((c: any) => <TableRow key={c.id}><TableCell className="font-medium"><Link to="/contracts/$contractId" params={{ contractId: c.id }} className="text-primary hover:underline">{c.code}</Link></TableCell><TableCell>{c.customers?.full_name ?? "-"}</TableCell><TableCell>{c.vehicles?.plate_no ?? "-"}</TableCell><TableCell className="text-right">฿{formatMoney(c.principal)}</TableCell><TableCell className="text-right">฿{formatMoney(c.installment_amount)}</TableCell><TableCell className="text-right font-medium">฿{formatMoney(c.outstanding)}</TableCell>{isHQ && <TableCell>{c.branches?.name ?? "-"}</TableCell>}<TableCell>{formatThaiDate(c.start_date)}</TableCell><TableCell><StatusPill status={c.status} label={CONTRACT_STATUS_LABEL[c.status] ?? c.status} /></TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => setPreviewContract(c)}><Eye className="size-3.5" /> Preview</Button><Button size="icon" variant="ghost" title="พิมพ์สัญญารายบุคคล" onClick={() => setPrintContractRecord(c)}><Printer className="size-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>

    <Dialog open={!!previewContract} onOpenChange={(v) => !v && setPreviewContract(null)}>
      <DialogContent className="max-h-[96vh] overflow-hidden sm:max-w-[min(96vw,1100px)]">
        <DialogHeader className="no-print"><DialogTitle>Preview สัญญากู้ยืมเงิน {previewContract?.code}</DialogTitle><DialogDescription>สัญญา A4 ภาษาไทย ดึงข้อมูลรายบุคคลจากฐานข้อมูลโดยตรง และจัดรูปแบบสำหรับ Print / Save as PDF</DialogDescription></DialogHeader>
        <div className="max-h-[78vh] overflow-auto rounded-md bg-muted p-4">{previewContract && <ContractPromisPrint contract={previewContract} />}</div>
        <DialogFooter className="no-print"><Button variant="outline" onClick={() => setPreviewContract(null)}>ปิด</Button><Button onClick={() => previewContract && setPrintContractRecord(previewContract)}><Printer className="size-4" /> พิมพ์ / Save PDF</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <div className="contract-direct-print" aria-hidden="true">
      {printContractRecord && <ContractPromisPrint contract={printContractRecord} />}
    </div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>ทำสัญญาใหม่</DialogTitle><DialogDescription>พิมพ์ชื่อไทยหรือข้อมูลบางส่วนเพื่อค้นหาคำขอที่อนุมัติแล้ว</DialogDescription></DialogHeader><div className="grid gap-3"><div className="space-y-1.5"><Label>คำขอที่อนุมัติแล้ว *</Label><SearchableCombobox value={appId} onValueChange={setAppId} options={appOptions} placeholder="ค้นหา/เลือกคำขอ" searchPlaceholder="ชื่อ / เลขคำขอ / เลขบัตร / โทร / LINEID / Document No." /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>วันเริ่มสัญญา</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div><div><Label>วันครบกำหนดงวดแรก</Label><Input type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button><Button onClick={() => createContract.mutate()} disabled={createContract.isPending}>สร้างสัญญา</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
